import mongoose from "mongoose";

// ตั้งค่าคอมมิชชั่นต่อสาขา: (1) ขั้นบันไดยอดขาย sale (2) ตารางคอม add-on (sale/หมอ)
const TierSchema = new mongoose.Schema(
  { min_sales: { type: Number, required: true }, percent: { type: Number, required: true } },
  { _id: false }
);
const AddonRateSchema = new mongoose.Schema(
  {
    product_ID: { type: String, required: true },
    sale_type: { type: String, enum: ["baht", "percent"], default: "baht" },
    sale_value: { type: Number, default: 0 },
    doctor_type: { type: String, enum: ["baht", "percent"], default: "baht" },
    doctor_value: { type: Number, default: 0 },
  },
  { _id: false }
);

const CommissionSettingSchema = new mongoose.Schema(
  {
    branch_ID: { type: String, required: true, unique: true, index: true },
    // whole = ถึงขั้นไหนได้ % ขั้นนั้นทั้งยอด | marginal = คิดเป็นชั้นๆ
    tier_mode: { type: String, enum: ["whole", "marginal"], default: "whole" },
    sale_tiers: { type: [TierSchema], default: [] }, // เรียง min_sales น้อย→มาก
    addon_rates: { type: [AddonRateSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.CommissionSetting ||
  mongoose.model("CommissionSetting", CommissionSettingSchema);
