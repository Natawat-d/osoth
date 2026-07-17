import mongoose from "mongoose";

export const RESERVE_ACTIVE_STATUSES = [
  "booked",
  "arrived",
  "ready",
  "in_progress",
];

const ReserveSchema = new mongoose.Schema(
  {
    reserve_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    HN_number: { type: String, default: null, index: true },
    contact: {
      nick_name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    customer_course_ID: { type: String, default: null },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    time_start: { type: String, required: true }, // "13:00"
    time_end: { type: String, required: true },
    unix_start: { type: Number, required: true },
    unix_end: { type: Number, required: true },
    room_ID: { type: String, required: true },
    doctor_ID: { type: String, default: null },
    BT_ID: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "booked",
        "arrived",
        "ready",
        "in_progress",
        "done",
        "cancelled",
        "no_show",
      ],
      default: "booked",
      index: true,
    },
    is_walk_in: { type: Boolean, default: false },
    reschedule_history: {
      type: [
        {
          from_date: String,
          from_time_start: String,
          from_time_end: String,
          from_room_ID: String,
          moved_at: Date,
          moved_by: String,
          _id: false,
        },
      ],
      default: [],
    },
    status_history: {
      type: [{ status: String, at: Date, by: String, _id: false }],
      default: [],
    },
    opd_ID: { type: String, default: null },
    created_by: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

ReserveSchema.index({ branch_ID: 1, date: 1, room_ID: 1 });
ReserveSchema.index({ branch_ID: 1, date: 1, doctor_ID: 1 });

export default mongoose.models.Reserve ||
  mongoose.model("Reserve", ReserveSchema);
