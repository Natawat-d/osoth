import mongoose from "mongoose";
import Opd from "@/models/Opd";
import Reserve from "@/models/Reserve";
import CustomerCourse from "@/models/CustomerCourse";
import InventoryItem from "@/models/InventoryItem";
import Product from "@/models/Product";
import User from "@/models/User";
import { pickItemsFIFO } from "./fifo";
import { genId } from "./ids";
import StaffEarning from "@/models/StaffEarning";
import CommissionSetting from "@/models/CommissionSetting";

// "ปิดเคส" — trigger เดียวทำ 5 อย่าง:
// 1. ตัด inventory ตาม FIFO ตาม course_snapshot.products (+ add_on ที่ตัด stock)
// 2. อัปเดต uses/cc/state ของขวด + usage_log
// 3. customer_course.uses_remaining-- (ครบ → completed)
// 4. สร้าง staff_earning ค่ามือหมอ/BT ตาม procedures_done
// 5. reserve.status → done
// ใช้ MongoDB transaction ถ้า server รองรับ (replica set) — ถ้าไม่ ก็รันตามลำดับ
export async function closeCase({ opd_ID, closed_by }) {
  const session = await startSessionIfSupported();
  try {
    let result;
    if (session) {
      await session.withTransaction(async () => {
        result = await doCloseCase({ opd_ID, closed_by, session });
      });
    } else {
      result = await doCloseCase({ opd_ID, closed_by, session: null });
    }
    return result;
  } finally {
    if (session) await session.endSession();
  }
}

async function startSessionIfSupported() {
  try {
    const session = await mongoose.startSession();
    // standalone mongo ไม่รองรับ transaction — ตรวจจาก topology
    const topology = mongoose.connection.client?.topology;
    const desc = topology?.description;
    const isStandalone =
      desc && [...(desc.servers?.values() || [])].some((s) => s.type === "Standalone");
    if (isStandalone) {
      await session.endSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function doCloseCase({ opd_ID, closed_by, session }) {
  const opt = session ? { session } : {};
  const now = new Date();

  const opd = await Opd.findOne({ opd_ID }, null, opt);
  if (!opd) throw httpError(404, "ไม่พบเคส OPD");
  if (opd.status === "closed") throw httpError(409, "เคสนี้ปิดไปแล้ว");
  if (!opd.opd_data?.measured_at)
    throw httpError(400, "ยังไม่ได้บันทึกการวัดตัว (OPD data) — บังคับวัดทุกครั้ง");

  if (!opd.customer_course_ID)
    throw httpError(400, "ต้องเลือก/ขายคอร์สให้เคสนี้ก่อนปิดเคส");
  const cc = await CustomerCourse.findOne(
    { customer_course_ID: opd.customer_course_ID },
    null,
    opt
  );
  if (!cc) throw httpError(404, "ไม่พบ course ของลูกค้า");
  if (cc.uses_remaining <= 0) throw httpError(409, "course นี้ใช้สิทธิ์ครบแล้ว");
  if (cc.expires_at && now > cc.expires_at)
    throw httpError(409, "course นี้หมดอายุแล้ว");
  // ต้องชำระค่าคอร์ส (รวม add-on ครั้งแรก) ให้ครบก่อนปิดเคส — ไม่มีผ่อน จ่ายเต็มจำนวน
  if ((cc.balance_due || 0) > 0)
    throw httpError(400, "ต้องชำระค่าคอร์ส (รวม add-on) ให้ครบก่อนปิดเคส");
  // V3: ต้องแนบใบยินยอมอย่างน้อย 1 ใบก่อนปิดเคส (ทุกเคส แม้คอร์สเดิม)
  if (!opd.consents || opd.consents.length === 0)
    throw httpError(400, "ต้องแนบใบยินยอมการทำหัตถการก่อนปิดเคส (อัปโหลด/เซ็นบนจอ)");

  // ---- 1+2. ตัด stock FIFO (ใช้กับทั้งสูตร course และ add-on ที่เป็นสินค้าคลัง) ----
  const stockUsed = [];
  const cutStock = async (product_ID, cc_needed) => {
    if (!cc_needed || cc_needed <= 0) return;
    const productDoc = await Product.findOne({ product_ID }, null, opt);
    const subUnitSize = productDoc?.sub_unit_size || 1;
    const picks = await pickItemsFIFO({ branch_ID: opd.branch_ID, product_ID, cc_needed });
    for (const { item, lot, cc_take } of picks) {
      const newCc = item.cc_remaining - cc_take;
      const newUses = Math.max(0, item.uses_remaining - 1);
      const nowEmpty = newCc <= 0;
      const openingNow = item.state === "unused";
      const shelfDays = productDoc?.shelf_life_after_open_days || 0;
      await InventoryItem.updateOne(
        { item_ID: item.item_ID },
        {
          $set: {
            cc_remaining: newCc,
            uses_remaining: nowEmpty ? 0 : newUses,
            state: nowEmpty ? "empty" : "in_use",
            ...(openingNow
              ? { opened_at: now, open_expiry_at: shelfDays ? new Date(now.getTime() + shelfDays * 86400000) : null }
              : {}),
          },
          $push: { usage_log: { opd_ID, cc_used: cc_take, used_at: now, closed_by } },
        },
        opt
      );
      const costOfGoods = ((lot?.cost_price_per_unit || 0) * cc_take) / subUnitSize;
      stockUsed.push({
        item_ID: item.item_ID, lot_ID: item.lot_ID, product_ID,
        cc_used: cc_take, cost_of_goods: Math.round(costOfGoods * 100) / 100,
      });
    }
  };
  // สูตร course
  for (const p of cc.course_snapshot?.products || []) await cutStock(p.product_ID, p.sub_unit_per_use);
  // add-on ที่เป็นสินค้าคลัง → ตัด addon_sub_unit_per_use × qty (add-on หัตถการล้วนข้าม)
  for (const a of opd.add_ons || []) {
    if (!a.product_ID) continue;
    const pd = await Product.findOne({ product_ID: a.product_ID }, null, opt);
    if (!pd) continue;
    const per = pd.addon_sub_unit_per_use || pd.sub_unit_size || 1;
    await cutStock(a.product_ID, per * (a.qty || 1));
  }

  // ---- 3. นับครั้ง course ----
  const newRemaining = cc.uses_remaining - 1;
  await CustomerCourse.updateOne(
    { customer_course_ID: cc.customer_course_ID },
    {
      $set: {
        uses_remaining: newRemaining,
        ...(newRemaining <= 0 ? { status: "completed" } : {}),
      },
    },
    opt
  );

  // ---- 4. ค่ามือหมอ/BT ----
  const earnings = [];
  for (const proc of opd.procedures_done || []) {
    if (!proc.performed_by) continue;
    const performer = await User.findOne({ user_ID: proc.performed_by }, null, opt);
    const earning = {
      earning_ID: await genId("EN", 6),
      branch_ID: opd.branch_ID,
      user_ID: proc.performed_by,
      role: performer?.role === "doctor" ? "doctor" : "BT",
      type: "procedure_fee",
      ref: { opd_ID, customer_course_ID: null },
      medical_procedure_ID: proc.medical_procedure_ID,
      amount: proc.cost || 0,
      date: opd.date,
    };
    // ต้องส่งเป็น array เสมอเมื่อมี options — ไม่งั้น mongoose ตีความ options เป็น doc
    await StaffEarning.create([earning], opt);
    earnings.push(earning);
  }

  // ---- 4a. ค่ามือหัตถการที่แนบมากับ add-on → BT/หมอ ของเคสนี้ ----
  for (const a of opd.add_ons || []) {
    if (!a.medical_procedure_ID) continue;
    const performer = a.proc_type === "doctor" ? opd.doctor_ID : opd.BT_ID;
    if (!performer) continue;
    const u = await User.findOne({ user_ID: performer }, null, opt);
    const earning = {
      earning_ID: await genId("EN", 6),
      branch_ID: opd.branch_ID,
      user_ID: performer,
      role: u?.role === "doctor" ? "doctor" : "BT",
      type: "procedure_fee",
      ref: { opd_ID, customer_course_ID: null },
      medical_procedure_ID: a.medical_procedure_ID,
      amount: a.proc_cost || 0,
      date: opd.date,
    };
    await StaffEarning.create([earning], opt);
    earnings.push(earning);
  }

  // ---- 4b. คอม add-on → คนแนะ (sale/หมอ) ตามตารางคอมของสาขา ----
  // ครั้งแรก = รวมเข้าฐานคอมคอร์ส (report) แล้ว → ไม่คิดคอม add-on ซ้ำ
  const commSetting = await CommissionSetting.findOne({ branch_ID: opd.branch_ID }, null, opt);
  for (const a of opd.add_ons || []) {
    if (a.first_visit) continue;
    if (!a.recommended_by) continue;
    const rate = (commSetting?.addon_rates || []).find((r) => r.product_ID === a.product_ID);
    if (!rate) continue;
    const performer = await User.findOne({ user_ID: a.recommended_by }, null, opt);
    const isDoctor = performer?.role === "doctor";
    const cType = isDoctor ? rate.doctor_type : rate.sale_type;
    const cVal = isDoctor ? rate.doctor_value : rate.sale_value;
    const amount = cType === "percent"
      ? Math.round(((a.price || 0) * cVal) / 100)
      : cVal * (a.qty || 1);
    if (amount <= 0) continue;
    const earning = {
      earning_ID: await genId("EN", 6),
      branch_ID: opd.branch_ID,
      user_ID: a.recommended_by,
      role: isDoctor ? "doctor" : "sale",
      type: "addon_commission",
      ref: { opd_ID, customer_course_ID: null },
      amount,
      date: opd.date,
    };
    await StaffEarning.create([earning], opt);
    earnings.push(earning);
  }

  // ---- 5. ปิด OPD + reserve → done ----
  await Opd.updateOne(
    { opd_ID },
    {
      $set: {
        stock_used: stockUsed,
        status: "closed",
        outcome: "treated",
        closed_by,
        closed_at: now,
      },
    },
    opt
  );
  await Reserve.updateOne(
    { reserve_ID: opd.reserve_ID },
    {
      $set: { status: "done" },
      $push: { status_history: { status: "done", at: now, by: closed_by } },
    },
    opt
  );

  return {
    opd_ID,
    stock_used: stockUsed,
    uses_remaining: newRemaining,
    course_completed: newRemaining <= 0,
    earnings_created: earnings.length,
  };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
