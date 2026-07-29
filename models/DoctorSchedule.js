import mongoose from "mongoose";

// V3.1: ลงเวรหมอเป็น "ช่วงวันที่" (วันไหนถึงวันไหน เวลาอะไร ห้องอะไร) — ไม่ fix รายสัปดาห์ทั้งเดือนแล้ว
// หมอ 1 คนมีได้หลายช่วง (เช่น 1–15 ส.ค. ห้อง 1 เช้า · 20–25 ส.ค. ห้อง VIP บ่าย)
const AssignmentSchema = new mongoose.Schema(
  {
    date_start: { type: String, required: true }, // "YYYY-MM-DD"
    date_end: { type: String, required: true },   // รวมวันสุดท้าย
    time_start: { type: String, required: true }, // "10:00"
    time_end: { type: String, required: true },
    room_ID: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

// ข้อยกเว้นรายวัน: ลา (ไม่อยู่) หรือ custom (สลับห้อง/เวลาเฉพาะวัน) — ชนะ assignment
const OverrideSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    type: { type: String, enum: ["leave", "custom"], required: true },
    room_ID: { type: String, default: null },
    time_start: { type: String, default: null },
    time_end: { type: String, default: null },
  },
  { _id: false }
);

const DoctorScheduleSchema = new mongoose.Schema(
  {
    branch_ID: { type: String, required: true, index: true },
    doctor_ID: { type: String, required: true, index: true },
    assignments: { type: [AssignmentSchema], default: [] },
    overrides: { type: [OverrideSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

DoctorScheduleSchema.index({ branch_ID: 1, doctor_ID: 1 }, { unique: true });

export default mongoose.models.DoctorSchedule ||
  mongoose.model("DoctorSchedule", DoctorScheduleSchema);
