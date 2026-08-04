import Receipt from "@/models/Receipt";
import Payment from "@/models/Payment";
import CustomerCourse from "@/models/CustomerCourse";
import Reserve from "@/models/Reserve";
import Company from "@/models/Company";
import Customer from "@/models/Customer";
import { nextSeq, pad } from "@/models/Counter";
import { genId } from "./ids";
import { postPaymentVoid, ensureCoA } from "./gl";

// ── ออกใบเสร็จรับเงิน — เลขรันต่อเนื่องต่อปี พ.ศ. (RC2569-00001) ──
// เรียกอัตโนมัติทุกจุดรับเงิน: ขาย/จ่ายคอร์ส, add-on แยกบิล, มัดจำ
export async function issueReceipt({ branch_ID, HN_number = null, customer_name = "", items, payments, ref = {}, issued_by = "" }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  if (!(total > 0)) return null;
  const yearBE = new Date().getFullYear() + 543;
  const seq = await nextSeq(`RC:${yearBE}`);
  const co = await Company.findOne({}).lean();
  if (!customer_name && HN_number) {
    const c = await Customer.findOne({ HN_number }).lean();
    if (c) customer_name = `${c.prefix ? c.prefix + " " : ""}${c.full_name} ${c.sure_name || ""}`.trim();
  }
  const receipt = await Receipt.create({
    receipt_ID: await genId("RCP", 6),
    receipt_no: `RC${yearBE}-${pad(seq, 5)}`,
    branch_ID,
    HN_number,
    customer_name,
    company: {
      name: co?.name || "",
      address: co?.address || "",
      tax_id: co?.tax_id || "",
      phone: co?.phone || "",
    },
    items,
    payments: payments.map((p) => ({ payment_ID: p.payment_ID, method: p.method, amount: p.amount })),
    total,
    ref,
    issued_at: new Date(),
    issued_by,
  });
  // ผูกใบเสร็จกลับเข้า payment (ตามรอยสองทาง)
  const ids = payments.map((p) => p.payment_ID).filter(Boolean);
  if (ids.length)
    await Payment.updateMany({ payment_ID: { $in: ids } }, { $set: { receipt_ID: receipt.receipt_ID } });
  return receipt;
}

// ── void payment เดี่ยว: ธง voided + JE กลับรายการ + คืนสถานะเอกสารที่เกี่ยว ──
export async function voidPayment(payment_ID, { reason, by }) {
  // claim แบบ atomic — void ซ้ำ/พร้อมกัน ทำได้ครั้งเดียว
  const p = await Payment.findOneAndUpdate(
    { payment_ID, voided: { $ne: true } },
    { $set: { voided: true, void_reason: reason, void_by: by, void_at: new Date() } },
    { new: true }
  );
  if (!p) return null; // ไม่พบ/ถูก void แล้ว
  await ensureCoA();
  await postPaymentVoid(p);
  // คืนยอดค้างของคอร์ส (เงินคอร์สถูกยกเลิก → คอร์สกลับเป็นค้างชำระ)
  // ปลอดภัยจาก race เพราะการ void payment นี้ถูก claim ไว้แล้วข้างบน (ครั้งเดียวเท่านั้น)
  if (["course_purchase", "installment"].includes(p.type) && p.ref?.customer_course_ID) {
    const cc = await CustomerCourse.findOne({ customer_course_ID: p.ref.customer_course_ID });
    if (cc) {
      cc.paid_amount = Math.max(0, (cc.paid_amount || 0) - p.amount);
      cc.balance_due = (cc.balance_due || 0) + p.amount;
      cc.payment_status = cc.paid_amount > 0 ? "partial" : "unpaid";
      await cc.save();
    }
  }
  // จ่ายด้วยมัดจำแล้ว void → มัดจำกลับมาค้างอยู่ (held) ใช้ใหม่ได้
  if (p.method === "deposit" && p.ref?.reserve_ID)
    await Reserve.updateOne({ reserve_ID: p.ref.reserve_ID }, { $set: { deposit_status: "held" } });
  // มัดจำที่วางไว้ถูก void → เหมือนไม่เคยวาง
  if (p.type === "deposit" && p.ref?.reserve_ID)
    await Reserve.updateOne(
      { reserve_ID: p.ref.reserve_ID },
      { $set: { deposit: 0, deposit_status: "none", deposit_payment_ID: null } }
    );
  return p;
}

// ── void ใบเสร็จ: เลขคงอยู่ + กลับรายการเงินทุกบรรทัดในใบ ──
export async function voidReceipt(receipt_ID, { reason, by }) {
  const r = await Receipt.findOneAndUpdate(
    { receipt_ID, status: "issued" },
    { $set: { status: "voided", void_reason: reason, void_by: by, void_at: new Date() } },
    { new: true }
  );
  if (!r) throw Object.assign(new Error("ไม่พบใบเสร็จ หรือถูกยกเลิกไปแล้ว"), { status: 409 });
  const voided = [];
  for (const line of r.payments || [])
    if (line.payment_ID) {
      const p = await voidPayment(line.payment_ID, { reason: `void ใบเสร็จ ${r.receipt_no}: ${reason}`, by });
      if (p) voided.push(p.payment_ID);
    }
  return { receipt: r, voided_payments: voided };
}
