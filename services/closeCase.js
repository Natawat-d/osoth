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

  const cc = await CustomerCourse.findOne(
    { customer_course_ID: opd.customer_course_ID },
    null,
    opt
  );
  if (!cc) throw httpError(404, "ไม่พบ course ของลูกค้า");
  if (cc.uses_remaining <= 0) throw httpError(409, "course นี้ใช้สิทธิ์ครบแล้ว");
  if (cc.expires_at && now > cc.expires_at)
    throw httpError(409, "course นี้หมดอายุแล้ว");

  // ---- 1+2. ตัด stock FIFO ตามสูตรของ course ----
  const stockUsed = [];
  const products = cc.course_snapshot?.products || [];
  for (const p of products) {
    const productDoc = await Product.findOne({ product_ID: p.product_ID }, null, opt);
    const subUnitSize = productDoc?.sub_unit_size || 1;
    const picks = await pickItemsFIFO({
      branch_ID: opd.branch_ID,
      product_ID: p.product_ID,
      cc_needed: p.sub_unit_per_use,
    });
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
              ? {
                  opened_at: now,
                  open_expiry_at: shelfDays
                    ? new Date(now.getTime() + shelfDays * 86400000)
                    : null,
                }
              : {}),
          },
          $push: {
            usage_log: { opd_ID, cc_used: cc_take, used_at: now, closed_by },
          },
        },
        opt
      );
      // ต้นทุนจริงตามสัดส่วนของ lot ที่ตัด
      const costOfGoods =
        ((lot?.cost_price_per_unit || 0) * cc_take) / subUnitSize;
      stockUsed.push({
        item_ID: item.item_ID,
        lot_ID: item.lot_ID,
        product_ID: p.product_ID,
        cc_used: cc_take,
        cost_of_goods: Math.round(costOfGoods * 100) / 100,
      });
    }
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

  // ---- 5. ปิด OPD + reserve → done ----
  await Opd.updateOne(
    { opd_ID },
    {
      $set: {
        stock_used: stockUsed,
        status: "closed",
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
