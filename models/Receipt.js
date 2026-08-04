import mongoose from "mongoose";

// ใบเสร็จรับเงิน — เลขรันต่อเนื่องต่อปี พ.ศ. (RC2569-00001) ห้ามข้าม/ห้ามลบ
// ยกเลิก = สถานะ voided (เลขคงอยู่ตามหลักบัญชี) + กลับรายการเงินด้วย JE reversal
const ReceiptSchema = new mongoose.Schema(
  {
    receipt_ID: { type: String, required: true, unique: true }, // รหัสภายใน
    receipt_no: { type: String, required: true, unique: true }, // เลขที่ใบเสร็จ (โชว์ลูกค้า)
    branch_ID: { type: String, required: true, index: true },
    HN_number: { type: String, default: null, index: true },
    customer_name: { type: String, default: "" },
    // snapshot บริษัท ณ วันที่ออก — ใบเสร็จต้องนิ่งแม้ภายหลังแก้ข้อมูลบริษัท
    company: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      tax_id: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    items: {
      type: [{ description: String, amount: Number, _id: false }],
      default: [],
    },
    payments: {
      type: [{ payment_ID: String, method: String, amount: Number, _id: false }],
      default: [],
    },
    total: { type: Number, required: true },
    ref: {
      customer_course_ID: { type: String, default: null },
      opd_ID: { type: String, default: null },
      reserve_ID: { type: String, default: null },
    },
    issued_at: { type: Date, required: true },
    issued_by: { type: String, default: "" },
    status: { type: String, enum: ["issued", "voided"], default: "issued" },
    void_reason: { type: String, default: "" },
    void_by: { type: String, default: "" },
    void_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

ReceiptSchema.index({ branch_ID: 1, issued_at: -1 });

export default mongoose.models.Receipt || mongoose.model("Receipt", ReceiptSchema);
