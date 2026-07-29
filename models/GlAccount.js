import mongoose from "mongoose";

// ผังบัญชี (Chart of Accounts) — บัญชีคู่เต็ม
// type: ธรรมชาติบัญชี (asset/liability/equity/revenue/expense)
// group: หมวดที่ Owner ขอใน GL setup (CAPEX/PEC/OPEX/FREIGHT/…) — ใช้จัดกลุ่มรายงาน/Budget
const GlAccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // เช่น "1000"
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["asset", "liability", "equity", "revenue", "expense"],
      required: true,
    },
    group: { type: String, default: "" }, // CAPEX | PEC | OPEX | FREIGHT | COGS | LABOR | REVENUE | ...
    parent_code: { type: String, default: null },
    system: { type: Boolean, default: false }, // บัญชีที่ระบบ post อัตโนมัติ — ห้ามลบ
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.GlAccount || mongoose.model("GlAccount", GlAccountSchema);
