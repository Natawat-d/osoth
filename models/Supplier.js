import mongoose from "mongoose";

// เจ้าหนี้/ผู้ขาย (supplier master) — ใช้กับ PO + AP
const SupplierSchema = new mongoose.Schema(
  {
    supplier_ID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tax_id: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    credit_days: { type: Number, default: 30 }, // เครดิตเทอม (วัน)
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Supplier || mongoose.model("Supplier", SupplierSchema);
