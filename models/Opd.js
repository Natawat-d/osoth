import mongoose from "mongoose";

// 1 doc = การมา 1 ครั้ง (1 session)
const OpdSchema = new mongoose.Schema(
  {
    opd_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    reserve_ID: { type: String, required: true },
    HN_number: { type: String, required: true, index: true },
    customer_course_ID: { type: String, required: true, index: true },
    session_no: { type: Number, required: true },
    date: { type: String, required: true, index: true },
    room_ID: { type: String, required: true },
    time_start: { type: String, default: "" },
    time_end: { type: String, default: "" },
    // วัดตัว — บังคับก่อนไปขั้นถัดไป
    opd_data: {
      blood_pressure: { type: String, default: "" },
      heart_rate: { type: Number, default: 0 },
      weight_kg: { type: Number, default: 0 },
      height_cm: { type: Number, default: 0 },
      fat_mass: { type: Number, default: 0 },
      muscle_mass: { type: Number, default: 0 },
      other: { type: String, default: "" },
      measured_by: { type: String, default: "" },
      measured_at: { type: Date, default: null },
    },
    BT_ID: { type: String, default: null },
    doctor_ID: { type: String, default: null },
    procedures_done: {
      type: [
        {
          medical_procedure_ID: String,
          name: String,
          type: { type: String, enum: ["BT", "doctor"] },
          performed_by: String,
          cost: Number,
          _id: false,
        },
      ],
      default: [],
    },
    // การตัด stock จริง — เขียนตอนปิดเคส
    stock_used: {
      type: [
        {
          item_ID: String,
          lot_ID: String,
          product_ID: String,
          cc_used: Number,
          cost_of_goods: Number, // ทุนจริงตามสัดส่วน lot
          _id: false,
        },
      ],
      default: [],
    },
    // add_on — เก็บเงินทันที แยกบิล
    add_ons: {
      type: [
        {
          product_ID: String,
          name: String,
          qty: Number,
          cc_used: Number,
          price: Number,
          payment_ID: String,
          _id: false,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["open", "measuring", "bt_stage", "doctor_stage", "closed"],
      default: "open",
      index: true,
    },
    closed_by: { type: String, default: null },
    closed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Opd || mongoose.model("Opd", OpdSchema);
