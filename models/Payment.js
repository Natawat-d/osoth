import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    payment_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    HN_number: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ["course_purchase", "installment", "add_on", "deposit"],
      required: true,
    },
    ref: {
      customer_course_ID: { type: String, default: null },
      opd_ID: { type: String, default: null },
      reserve_ID: { type: String, default: null },
    },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cash", "transfer", "card", "deposit"], // deposit = หักจากมัดจำที่วางไว้ตอนจอง
      required: true,
    },
    paid_at: { type: Date, required: true },
    received_by: { type: String, default: "" },
    note: { type: String, default: "" },
    // deferred: คอร์สรับรู้รายได้ตามครั้งใช้ (payment เข้า 2310 รอปิดเคสค่อยรับรู้ 4000)
    deferred: { type: Boolean, default: false },
    receipt_ID: { type: String, default: null }, // ใบเสร็จที่คุมรายการนี้
    // void = ยกเลิกรายการ (คืนเงิน) — ห้ามลบเอกสารเงิน ใช้กลับรายการด้วย JE reversal
    voided: { type: Boolean, default: false },
    void_reason: { type: String, default: "" },
    void_by: { type: String, default: "" },
    void_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

PaymentSchema.index({ branch_ID: 1, paid_at: 1 });

export default mongoose.models.Payment ||
  mongoose.model("Payment", PaymentSchema);
