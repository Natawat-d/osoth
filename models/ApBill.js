import mongoose from "mongoose";

// บิลเจ้าหนี้ (AP) — เกิดจากรับของตาม PO (เครดิต) หรือคีย์เอง
// จ่ายแล้วบันทึก payments[] จนครบ → status paid
const ApBillSchema = new mongoose.Schema(
  {
    bill_ID: { type: String, required: true, unique: true },
    supplier_ID: { type: String, default: null, index: true },
    supplier_name: { type: String, default: "" },
    po_ID: { type: String, default: null },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    bill_date: { type: String, required: true },   // "YYYY-MM-DD"
    due_date: { type: String, default: "" },
    // expense_account: ลงบัญชีฝั่ง Dr อะไร (default 1200 สินค้าคงคลัง สำหรับบิลซื้อของ)
    expense_account: { type: String, default: "1200" },
    payments: {
      type: [
        {
          amount: Number,
          method: { type: String, enum: ["cash", "transfer", "card"], default: "transfer" },
          paid_at: String, // "YYYY-MM-DD"
          paid_by: String,
          _id: false,
        },
      ],
      default: [],
    },
    status: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid", index: true },
    created_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.ApBill || mongoose.model("ApBill", ApBillSchema);
