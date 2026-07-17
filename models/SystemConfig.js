import mongoose from "mongoose";

const SystemConfigSchema = new mongoose.Schema(
  {
    branch_ID: { type: String, default: null }, // null = global
    hn_format: {
      prefix: { type: String, default: "HN" },
      include_year: { type: Boolean, default: true }, // ปี พ.ศ.
      digits: { type: Number, default: 4 },
      reset_yearly: { type: Boolean, default: true },
    },
    default_language: { type: String, enum: ["th", "en"], default: "th" },
    currency: { type: String, default: "THB" },
    // ลาป่วยเกินกี่วันต้องแนบใบรับรองแพทย์
    sick_cert_threshold_days: { type: Number, default: 2 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.SystemConfig ||
  mongoose.model("SystemConfig", SystemConfigSchema);
