import Course from "@/models/Course";
import Promotion from "@/models/Promotion";
import CustomerCourse from "@/models/CustomerCourse";
import Payment from "@/models/Payment";
import StaffEarning from "@/models/StaffEarning";
import User from "@/models/User";
import Opd from "@/models/Opd";
import Product from "@/models/Product";
import MedicalProcedure from "@/models/MedicalProcedure";
import { genId, localDate } from "./ids";

// ขาย course: สร้าง customer_course (+snapshot) + บันทึกเงิน + คอม sale
// การชำระเงิน: จ่ายเต็มจำนวน แต่แยกได้หลายช่องทาง (สด/โอน/บัตร) ผ่าน payments[]
export async function purchaseCourse({
  branch_ID,
  HN_number = null,
  reserve_contact = {},
  course_ID,
  promotion_ID = null,
  sale_ID = null,
  first_payment = null, // { amount, method } — รับก้อนเดียว (ยังรองรับ smoke/legacy)
  payments = null,      // [{ amount, method }] — แยกจ่ายหลายช่องทาง (จ่ายเต็ม)
  requireFull = false,  // true = ยอดรวมต้องเท่าราคาเต็มเท่านั้น (ไม่มีมัดจำ/ผ่อน)
  price_override = null, // ราคาปรับหน้างาน (admin ต่อรอง/ลด) — ทับราคา course/โปร
  received_by = "",
}) {
  const course = await Course.findOne({ course_ID, active: true }).lean();
  if (!course) throw httpError(404, "ไม่พบ course");

  // คิดราคาตามโปร (type=discount ลดทับ course เดิม / new_course คือเลือก course โปรมาแต่แรก)
  let total = course.price;
  if (promotion_ID) {
    const promo = await Promotion.findOne({
      promotion_ID,
      active: true,
    }).lean();
    if (promo && promo.type === "discount" && promo.course_ID === course_ID) {
      total =
        promo.discount_type === "percent"
          ? Math.round(course.price * (1 - promo.discount_value / 100))
          : course.price - promo.discount_value;
    }
  }
  // ราคาปรับหน้างาน (admin) ทับทุกอย่าง
  if (price_override != null && Number(price_override) >= 0) total = Number(price_override);

  const now = new Date();
  const expires_at = course.validity_days
    ? new Date(now.getTime() + course.validity_days * 86400000)
    : null;

  let commission_rate = 0;
  if (sale_ID) {
    const sale = await User.findOne({ user_ID: sale_ID }).lean();
    commission_rate = sale?.commission_rate || 0;
  }
  const commission_amount = Math.round(total * (commission_rate / 100));

  // รวมช่องทางจ่าย: ใช้ payments[] ถ้ามี ไม่งั้น fallback เป็น first_payment ก้อนเดียว
  const payLines = (payments && payments.length
    ? payments
    : first_payment && first_payment.amount ? [first_payment] : []
  ).map((p) => ({ amount: Number(p.amount) || 0, method: p.method || "cash" }))
    .filter((p) => p.amount > 0);
  const paidNow = payLines.reduce((s, p) => s + p.amount, 0);
  // ไม่มีผ่อน — จ่ายเต็มจำนวน หรือ ยังไม่จ่าย (0) เท่านั้น (จ่ายบางส่วนไม่ได้)
  if (paidNow > 0 && paidNow !== total)
    throw httpError(400, `ต้องชำระเต็มจำนวน ${total}฿ (ระบบไม่รองรับผ่อน — ผ่อนที่บัตร/EDC เอง)`);
  if (requireFull && paidNow !== total)
    throw httpError(400, `ต้องชำระค่าคอร์สเต็มจำนวน ${total}฿ (รับมา ${paidNow}฿)`);

  const cc = await CustomerCourse.create({
    customer_course_ID: await genId("CC", 6),
    branch_ID,
    HN_number,
    reserve_contact,
    course_ID,
    course_snapshot: {
      name: course.name,
      quantity_used: course.quantity_used,
      price: course.price,
      products: course.products,
      BT_procedures: course.BT_procedures,
      doctor_procedures: course.doctor_procedures,
      duration_minutes: course.duration_minutes,
    },
    promotion_ID,
    total_price: total,
    purchased_at: now,
    expires_at,
    uses_total: course.quantity_used,
    uses_remaining: course.quantity_used,
    status: "active",
    paid_amount: paidNow,
    balance_due: total - paidNow,
    payment_status: paidNow >= total ? "paid" : "unpaid",
    sale_ID,
    commission_rate,
    commission_amount,
  });

  // บันทึก payment แยกตามช่องทาง (จ่ายเต็มแต่คนละบัตร/สด/โอนได้)
  const createdPayments = [];
  for (const line of payLines) {
    const pay = await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID,
      HN_number,
      type: "course_purchase",
      ref: { customer_course_ID: cc.customer_course_ID, opd_ID: null },
      amount: line.amount,
      method: line.method,
      paid_at: now,
      received_by,
    });
    createdPayments.push(pay);
  }
  const payment = createdPayments[0] || null; // backward compat

  // คอม sale ไม่คิดแบบ flat ต่อคอร์สแล้ว — ใช้ "ขั้นบันไดจากยอดขายรวม/เดือน" (หน้า /commission)
  // + คอม add-on (คิดตอนปิดเคส) · cc.sale_ID เก็บไว้ให้รายงาน tier รวมยอด

  return { customer_course: cc, payment, payments: createdPayments };
}

// รับชำระค่าคอร์ส "เต็มยอดคงค้าง" ครั้งเดียว — ไม่มีผ่อน (ผ่อนเป็นเรื่องของบัตร/EDC)
// แยกช่องทางได้ (สด/โอน/บัตร) แต่รวมต้องเท่ายอดค้างพอดี
export async function payCourseFull({ customer_course_ID, payments = [], received_by = "" }) {
  const cc = await CustomerCourse.findOne({ customer_course_ID });
  if (!cc) throw httpError(404, "ไม่พบ course ของลูกค้า");
  if (cc.balance_due <= 0) throw httpError(409, "course นี้จ่ายครบแล้ว");
  const lines = payments
    .map((p) => ({ amount: Number(p.amount) || 0, method: p.method || "cash" }))
    .filter((p) => p.amount > 0);
  const sum = lines.reduce((s, p) => s + p.amount, 0);
  if (sum !== cc.balance_due)
    throw httpError(400, `ต้องชำระเต็มจำนวน ${cc.balance_due}฿ (รับมา ${sum}฿) — ระบบไม่รองรับผ่อน`);

  const now = new Date();
  const created = [];
  for (const line of lines) {
    created.push(await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID: cc.branch_ID,
      HN_number: cc.HN_number,
      type: "installment",
      ref: { customer_course_ID, opd_ID: null },
      amount: line.amount,
      method: line.method,
      paid_at: now,
      received_by,
    }));
  }
  await CustomerCourse.updateOne(
    { customer_course_ID },
    { $set: { paid_amount: cc.paid_amount + sum, balance_due: 0, payment_status: "paid" } }
  );
  return { payments: created, payment: created[0] || null, balance_due: 0 };
}

// add_on: ทำเพิ่มหน้างาน — เลือกได้ทั้ง "สินค้า" (ตัด stock + ราคาขาย) และ/หรือ "หัตถการ" (ค่ามือ → BT/หมอ ของเคส)
// ครั้งแรกของคอร์ส (session 1): บวกราคาเข้ายอดคอร์ส (balance) → จ่ายรวมทีเดียวที่การ์ดชำระเงิน (นับเข้าฐานคอม sale)
// ครั้งต่อไป: เก็บเงินแยกบิลทันที · recommended_by = คนแนะ (sale/หมอ) เอาไปคิดคอม
export async function addAddOn({
  opd_ID,
  product_ID = null,
  medical_procedure_ID = null,
  qty = 1,
  method = "cash",
  recommended_by = null,
  received_by = "",
}) {
  const opd = await Opd.findOne({ opd_ID });
  if (!opd) throw httpError(404, "ไม่พบเคส OPD");
  if (opd.status === "closed") throw httpError(409, "เคสปิดแล้ว เพิ่ม add_on ไม่ได้");
  if (!product_ID && !medical_procedure_ID)
    throw httpError(400, "ต้องเลือกสินค้าหรือหัตถการอย่างน้อย 1 อย่าง");

  const product = product_ID ? await Product.findOne({ product_ID, active: true }).lean() : null;
  if (product_ID && !product) throw httpError(404, "ไม่พบสินค้า");
  const proc = medical_procedure_ID ? await MedicalProcedure.findOne({ medical_procedure_ID, active: true }).lean() : null;
  if (medical_procedure_ID && !proc) throw httpError(404, "ไม่พบหัตถการ");

  // ราคาที่ลูกค้าจ่าย = จากสินค้า (หัตถการคิดแค่ค่ามือให้ BT/หมอ ไม่บวกราคาลูกค้า)
  const price = product ? (product.selling_price || 0) * qty : 0;
  const firstVisit = opd.session_no === 1;
  const now = new Date();

  let payment = null;
  if (firstVisit && price > 0 && opd.customer_course_ID) {
    // ครั้งแรก: บวกเข้ายอดคอร์ส (total + balance) → จ่ายรวมกับคอร์สทีเดียว (ไม่สร้าง payment แยก)
    const cc = await CustomerCourse.findOne({ customer_course_ID: opd.customer_course_ID });
    if (cc) {
      cc.total_price += price;
      cc.balance_due = (cc.balance_due || 0) + price;
      cc.payment_status = cc.balance_due <= 0 ? "paid" : cc.paid_amount > 0 ? "partial" : "unpaid";
      await cc.save();
    }
  } else if (price > 0) {
    // ครั้งต่อไป (หรือไม่มีคอร์ส) = เก็บเงินแยกบิลทันที
    payment = await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID: opd.branch_ID,
      HN_number: opd.HN_number,
      type: "add_on",
      ref: { customer_course_ID: null, opd_ID },
      amount: price,
      method,
      paid_at: now,
      received_by,
    });
  }

  await Opd.updateOne(
    { opd_ID },
    {
      $push: {
        add_ons: {
          product_ID: product_ID || null,
          name: product ? product.name : proc.name,
          qty,
          cc_used: 0,
          price,
          recommended_by: recommended_by || null,
          first_visit: firstVisit,
          medical_procedure_ID: medical_procedure_ID || null,
          proc_name: proc ? proc.name : "",
          proc_type: proc ? proc.type : null,
          proc_cost: proc ? (proc.cost || 0) : 0,
          payment_ID: payment ? payment.payment_ID : null,
        },
      },
    }
  );
  return { payment, price, first_visit: firstVisit, procedure: proc?.name || null };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
