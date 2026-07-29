import mongoose from "mongoose";

// งบประมาณ (Budget) — ตั้งต่อบัญชี GL ต่อปี แยกรายเดือน 12 ช่อง
const BudgetSchema = new mongoose.Schema(
  {
    budget_ID: { type: String, required: true, unique: true },
    year: { type: Number, required: true, index: true }, // ค.ศ.
    account_code: { type: String, required: true },
    monthly: { type: [Number], default: () => Array(12).fill(0) }, // ม.ค.–ธ.ค.
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

BudgetSchema.index({ year: 1, account_code: 1 }, { unique: true });

export default mongoose.models.Budget || mongoose.model("Budget", BudgetSchema);
