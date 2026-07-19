import mongoose from "mongoose";

// ลงเวลาเข้า/ออกงาน (As-Is Session 2: check-in/out ~10:30, เปิด 11:00-19:00)
const AttendanceSchema = new mongoose.Schema(
  {
    att_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    user_ID: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD" (local)
    check_in: { type: Date, default: null },
    check_out: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);
AttendanceSchema.index({ user_ID: 1, date: 1 }, { unique: true });

export default mongoose.models.Attendance ||
  mongoose.model("Attendance", AttendanceSchema);
