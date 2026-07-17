import Course from "@/models/Course";
import Promotion from "@/models/Promotion";
import CustomerCourse from "@/models/CustomerCourse";
import Payment from "@/models/Payment";
import StaffEarning from "@/models/StaffEarning";
import User from "@/models/User";
import Opd from "@/models/Opd";
import Product from "@/models/Product";
import { genId } from "./ids";

// ขาย course: สร้าง customer_course (+snapshot) + บันทึกเงินงวดแรก + คอม sale
export async function purchaseCourse({
  branch_ID,
  HN_number = null,
  reserve_contact = {},
  course_ID,
  promotion_ID = null,
  sale_ID = null,
  first_payment = null, // { amount, method } — null = ยังไม่จ่าย (ผ่อน/ค้าง)
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

  const paidNow = first_payment?.amount || 0;
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

  let payment = null;
  if (paidNow > 0) {
    payment = await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID,
      HN_number,
      type: "course_purchase",
      ref: { customer_course_ID: cc.customer_course_ID, opd_ID: null },
      amount: paidNow,
      method: first_payment.method || "cash",
      paid_at: now,
      received_by,
    });
  }

  if (sale_ID && commission_amount > 0) {
    await StaffEarning.create({
      earning_ID: await genId("EN", 6),
      branch_ID,
      user_ID: sale_ID,
      role: "sale",
      type: "commission",
      ref: { opd_ID: null, customer_course_ID: cc.customer_course_ID },
      amount: commission_amount,
      date: now.toISOString().slice(0, 10),
    });
  }

  return { customer_course: cc, payment };
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

// add_on: ทำเพิ่มหน้างาน — เก็บเงินทันที แยกบิล ผูกกับ OPD ครั้งนั้น
export async function addAddOn({
  opd_ID,
  product_ID,
  qty = 1,
  method,
  received_by = "",
}) {
  const opd = await Opd.findOne({ opd_ID });
  if (!opd) throw httpError(404, "ไม่พบเคส OPD");
  if (opd.status === "closed") throw httpError(409, "เคสปิดแล้ว เพิ่ม add_on ไม่ได้");
  const product = await Product.findOne({ product_ID, active: true }).lean();
  if (!product) throw httpError(404, "ไม่พบสินค้า");

  const price = (product.selling_price || 0) * qty;
  const now = new Date();
  const payment = await Payment.create({
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
