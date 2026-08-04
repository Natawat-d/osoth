import Opd from "@/models/Opd";
import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole, assertAmount } from "@/lib/api";
import { addAddOn } from "@/services/sales";

// POST /api/opd/[id]/addon — { product_ID?, medical_procedure_ID?, qty, method }
// ครั้งแรก = บวกเข้ายอดคอร์ส (จ่ายรวม) · ครั้งต่อไป = เก็บเงินแยกบิล · หัตถการ = ค่ามือ→BT/หมอ
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const body = await req.json();
  // qty=0 ห้ามกลายเป็น 1 เงียบๆ (เคยเก็บเงินลูกค้าจริงจากช่องที่ถูกเคลียร์ค่า) — ไม่ส่งมา = 1
  const qty = body.qty === undefined || body.qty === null || body.qty === ""
    ? 1
    : assertAmount(body.qty, "จำนวน (qty)", { integer: true });
  return addAddOn({
    opd_ID: id,
    product_ID: body.product_ID || null,
    medical_procedure_ID: body.medical_procedure_ID || null,
    qty,
    method: body.method || "cash",
    recommended_by: body.recommended_by || null,
    received_by: auth.user_ID,
  });
});

// DELETE /api/opd/[id]/addon?index=N — ลบ add-on ที่คีย์ผิด "เฉพาะที่ยังไม่มีการเก็บเงิน"
// - รายการครั้งแรก (บวกเข้ายอดคอร์ส): ลบได้ถ้าคอร์สยังไม่จ่ายส่วนนั้น → ถอนยอดออกจาก total/balance
// - รายการที่เก็บเงินแยกบิลไปแล้ว (มี payment_ID): ลบไม่ได้ — ต้องทำเรื่องคืนเงิน
export const DELETE = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd"]);
  const { id } = await params;
  const index = Number(new URL(req.url).searchParams.get("index"));
  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw Object.assign(new Error("ไม่พบเคส OPD"), { status: 404 });
  if (opd.status === "closed")
    throw Object.assign(new Error("เคสปิดแล้ว แก้ add-on ไม่ได้"), { status: 409 });
  const line = (opd.add_ons || [])[index];
  if (!line) throw Object.assign(new Error("ไม่พบรายการ add-on"), { status: 404 });
  if (line.payment_ID)
    throw Object.assign(new Error("รายการนี้เก็บเงินแยกบิลไปแล้ว — ลบไม่ได้ (ต้องทำเรื่องคืนเงิน)"), { status: 409 });

  if (line.first_visit && line.price > 0 && opd.customer_course_ID) {
    // ถอนยอดออกจากคอร์ส — ทำได้เฉพาะยอดนั้นยังค้างอยู่ (ยังไม่ถูกจ่ายรวมไปแล้ว)
    const cc = await CustomerCourse.findOneAndUpdate(
      { customer_course_ID: opd.customer_course_ID, balance_due: { $gte: line.price } },
      { $inc: { total_price: -line.price, balance_due: -line.price } },
      { new: true }
    );
    if (!cc)
      throw Object.assign(new Error("ยอด add-on นี้ถูกชำระรวมกับคอร์สไปแล้ว — ลบไม่ได้ (ต้องทำเรื่องคืนเงิน)"), { status: 409 });
  }
  opd.add_ons.splice(index, 1);
  await opd.save();
  return { removed: index, add_ons: opd.add_ons };
});
