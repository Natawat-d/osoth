import mongoose from "mongoose";

// 1 doc = การซื้อ course 1 ครั้งของลูกค้า
const CustomerCourseSchema = new mongoose.Schema(
  {
    customer_course_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    HN_number: { type: String, default: null, index: true }, // null ได้ก่อนมี HN
    reserve_contact: {
      nick_name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    course_ID: { type: String, required: true },
    // snapshot กันแก้ catalog ย้อนหลังแล้วข้อมูลเก่าเพี้ยน
    course_snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    promotion_ID: { type: String, default: null },
    total_price: { type: Number, required: true },
    purchased_at: { type: Date, required: true },
    expires_at: { type: Date, default: null },
    uses_total: { type: Number, required: true },
    uses_remaining: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    // การเงิน — รองรับผ่อนชำระ
    paid_amount: { type: Number, default: 0 },
    balance_due: { type: Number, default: 0 },
    // ไม่มีผ่อน — จ่ายเต็ม (paid) หรือ ยังไม่จ่าย (unpaid) เท่านั้น
    payment_status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    // คอมมิชชั่น (snapshot ณ วันขาย)
    sale_ID: { type: String, default: null },
    commission_rate: { type: Number, default: 0 },
    commission_amount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.CustomerCourse ||
  mongoose.model("CustomerCourse", CustomerCourseSchema);
