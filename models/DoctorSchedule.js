import mongoose from "mongoose";

const WeeklySlotSchema = new mongoose.Schema(
  {
    day_of_week: { type: Number, min: 0, max: 6, required: true }, // 0=อาทิตย์
    room_ID: { type: String, required: true },
    time_start: { type: String, required: true }, // "10:00"
    time_end: { type: String, required: true },
  },
  { _id: false }
);

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
    weekly: { type: [WeeklySlotSchema], default: [] },
    overrides: { type: [OverrideSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

DoctorScheduleSchema.index({ branch_ID: 1, doctor_ID: 1 }, { unique: true });

export default mongoose.models.DoctorSchedule ||
  mongoose.model("DoctorSchedule", DoctorScheduleSchema);
