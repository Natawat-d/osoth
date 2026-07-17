import mongoose from "mongoose";

// คำขอลา (ลากิจ = personal, ลาป่วย = sick) — พนักงานยื่น admin อนุมัติ
const LeaveRequestSchema = new mongoose.Schema(
  {
    leave_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    user_ID: { type: String, required: true, index: true }, // ผู้ขอลา
    type: { type: String, enum: ["personal", "sick"], required: true },
    date_from: { type: String, required: true }, // "YYYY-MM-DD"
    date_to: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: "" },
    medical_cert: { type: String, default: "" }, // ใบรับรองแพทย์ (ลาป่วยเกินกำหนด) — URL/dataURL
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewed_by: { type: String, default: null },
    reviewed_at: { type: Date, default: null },
    review_note: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", LeaveRequestSchema);
