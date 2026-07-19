import Course from "@/models/Course";
import Promotion from "@/models/Promotion";
import CustomerCourse from "@/models/CustomerCourse";
import Payment from "@/models/Payment";
import StaffEarning from "@/models/StaffEarning";
import User from "@/models/User";
import Opd from "@/models/Opd";
import Product from "@/models/Product";
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
    payment_status: paidNow >= total ? "paid" : paidNow > 0 ? "partial" : "unpaid",
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

// จ่ายงวดผ่อน
export async function payInstallment({
  customer_course_ID,
  amount,
  method,
  received_by = "",
}) {
  const cc = await CustomerCourse.findOne({ customer_course_ID });
  if (!cc) throw httpError(404, "ไม่พบ course ของลูกค้า");
  if (cc.balance_due <= 0) throw httpError(409, "course นี้จ่ายครบแล้ว");
  if (amount <= 0 || amount > cc.balance_due)
    throw httpError(400, `ยอดจ่ายต้องอยู่ระหว่าง 1 ถึง ${cc.balance_due}`);

  const now = new Date();
  const payment = await Payment.create({
    payment_ID: await genId("PAY", 6),
    branch_ID: cc.branch_ID,
    HN_number: cc.HN_number,
    type: "installment",
    ref: { customer_course_ID, opd_ID: null },
    amount,
    method,
    paid_at: now,
    received_by,
  });

  const paid = cc.paid_amount + amount;
  const due = cc.total_price - paid;
  await CustomerCourse.updateOne(
    { customer_course_ID },
    {
      $set: {
        paid_amount: paid,
        balance_due: due,
        payment_status: due <= 0 ? "paid" : "partial",
      },
    }
  );
  return { payment, balance_due: due };
}

// add_on: ทำเพิ่มหน้างาน — สินค้าในคลัง (ตัด stock ตอนปิดเคส)
// ครั้งแรกของคอร์ส (session 1): รวมเป็นบิลเดียวกับคอร์ส (นับเข้าฐานคอม sale)
// ครั้งต่อไป: แยกบิล · recommended_by = คนแนะ (sale/หมอ) เอาไปคิดคอม
export async function addAddOn({
  opd_ID,
  product_ID,
  qty = 1,
  method,
  recommended_by = null,
  received_by = "",
}) {
  const opd = await Opd.findOne({ opd_ID });
  if (!opd) throw httpError(404, "ไม่พบเคส OPD");
  if (opd.status === "closed") throw httpError(409, "เคสปิดแล้ว เพิ่ม add_on ไม่ได้");
  const product = await Product.findOne({ product_ID, active: true }).lean();
  if (!product) throw httpError(404, "ไม่พบสินค้า");

  const price = (product.selling_price || 0) * qty;
  const firstVisit = opd.session_no === 1; // ครั้งแรกของคอร์ส → รวมบิลคอร์ส
  const now = new Date();

  // ครั้งแรก: รวมเป็น "payment เดียวจริงๆ" กับคอร์ส — เพิ่มยอดใน payment course_purchase เดิม
  let payment;
  const coursePay = firstVisit && opd.customer_course_ID
    ? await Payment.findOne({ type: "course_purchase", "ref.customer_course_ID": opd.customer_course_ID }).sort({ paid_at: -1 })
    : null;
  if (coursePay) {
    coursePay.amount += price;       // รวมยอด add-on เข้าบิลคอร์สก้อนเดียว
    await coursePay.save();
    payment = coursePay;
  } else {
    // ครั้งต่อไป (หรือยังไม่มี payment คอร์ส) = add_on แยกบิล
    payment = await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID: opd.branch_ID,
      HN_number: opd.HN_number,
      type: firstVisit ? "course_purchase" : "add_on",
      ref: { customer_course_ID: firstVisit ? opd.customer_course_ID : null, opd_ID },
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
          product_ID,
          name: product.name,
          qty,
          cc_used: 0,
          price,
          recommended_by: recommended_by || null,
          first_visit: firstVisit,
          payment_ID: payment.payment_ID,
        },
      },
    }
  );
  return { payment, price };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
