import mongoose from "mongoose";

// ค่ามือ/คอมมิชชั่น — สร้างอัตโนมัติตอนปิดเคส/ขาย course
const StaffEarningSchema = new mongoose.Schema(
  {
    earning_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    user_ID: { type: String, required: true, index: true },
    role: { type: String, enum: ["doctor", "BT", "sale"], required: true },
    type: {
      type: String,
      enum: ["procedure_fee", "commission"],
      required: true,
    },
    ref: {
      opd_ID: { type: String, default: null },
      customer_course_ID: { type: String, default: null },
    },
    medical_procedure_ID: { type: String, default: null },
    amount: { type: Number, required: true },
    date: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

StaffEarningSchema.index({ user_ID: 1, date: 1 });

export default mongoose.models.StaffEarning ||
  mongoose.model("StaffEarning", StaffEarningSchema);
