import Opd from "@/models/Opd";
import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole } from "@/lib/api";
import { purchaseCourse, payCourseFull } from "@/services/sales";

// POST /api/opd/[id]/course — เลือก/ขายคอร์สให้เคสนี้ + รับเงิน "เต็มจำนวน"
// ไม่มีมัดจำ/ผ่อน — จ่ายเต็มราคา แต่แยกได้หลายช่องทาง (สด/โอน/บัตร)
// body: { course_ID?, existing_customer_course_ID?, payments: [{ amount, method }], price_override? }
const err = (status, message) => Object.assign(new Error(message), { status });

export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue", "sell_course"]);
  const { id } = await params;
  const body = await req.json();
  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw err(404, "ไม่พบเคส");
  if (opd.status === "closed") throw err(409, "เคสปิดแล้ว");
  if (opd.customer_course_ID) throw err(409, "เคสนี้เลือกคอร์สแล้ว");

  // ปรับราคาหน้างาน — เฉพาะ admin/owner
  const priceOverride = body.price_override != null ? Number(body.price_override) : null;
  if (priceOverride != null && !["super_admin", "admin"].includes(auth.role))
    throw err(403, "ปรับราคาได้เฉพาะ admin/owner");

  const payments = (Array.isArray(body.payments) ? body.payments : [])
    .map((p) => ({ amount: Number(p.amount) || 0, method: p.method || "cash" }))
    .filter((p) => p.amount > 0);
  const paidSum = payments.reduce((s, p) => s + p.amount, 0);

  let cc;
  if (body.existing_customer_course_ID) {
    // ใช้คอร์สเดิมที่ลูกค้ามีอยู่ — ถ้ายังค้าง ต้องจ่ายให้ครบ "เต็มยอดคงค้าง"
    cc = await CustomerCourse.findOne({ customer_course_ID: body.existing_customer_course_ID });
    if (!cc) throw err(404, "ไม่พบคอร์สของลูกค้า");
    if (cc.status !== "active") throw err(409, `คอร์สสถานะ ${cc.status} ใช้ไม่ได้`);
    if (!cc.HN_number) { cc.HN_number = opd.HN_number; await cc.save(); }
    if (cc.balance_due > 0 && paidSum > 0) {
      // จ่ายต้องเต็มยอดค้าง (ไม่มีผ่อน) — payCourseFull ตรวจให้
      await payCourseFull({ customer_course_ID: cc.customer_course_ID, payments, received_by: auth.user_ID });
      cc = await CustomerCourse.findOne({ customer_course_ID: cc.customer_course_ID });
    }
  } else {
    // ขายคอร์สใหม่ + รับเงินเต็มจำนวน (แยกช่องทางได้)
    // คอมของ course → sale ที่ "ดูแลเคส" (opd.sale_ID) ไม่ใช่คน login
    // จ่ายมา = ต้องเต็มจำนวน · ไม่จ่าย = แนบคอร์สไว้ก่อน (unpaid) แล้วไปเพิ่ม add-on/ชำระรวมทีหลัง
    const res = await purchaseCourse({
      branch_ID: opd.branch_ID,
      HN_number: opd.HN_number,
      course_ID: body.course_ID,
      sale_ID: opd.sale_ID || auth.user_ID,
      payments,
      requireFull: paidSum > 0,
      price_override: priceOverride,
      received_by: auth.user_ID,
    });
    cc = res.customer_course;
  }

  opd.customer_course_ID = cc.customer_course_ID;
  opd.session_no = cc.uses_total - cc.uses_remaining + 1;
  if (priceOverride != null) opd.price_override = priceOverride;
  await opd.save();
  return { opd, customer_course: cc };
});
