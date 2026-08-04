import mongoose from "mongoose";

// 1 doc = การมา 1 ครั้ง (1 session)
const OpdSchema = new mongoose.Schema(
  {
    opd_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    reserve_ID: { type: String, required: true },
    HN_number: { type: String, required: true, index: true },
    // course เลือกได้ตอนเปิดเคส หรือเลือก/ขายภายในเคสก็ได้ (จ่าย/มัดจำก่อนทำหัตถการ)
    customer_course_ID: { type: String, default: null, index: true },
    session_no: { type: Number, default: 0 },
    // sale ที่ดูแลเคส (คุย/ขาย) — เอาไปคิดคอม (เลือกตอนวัดตัว)
    sale_ID: { type: String, default: null },
    consulted: { type: Boolean, default: false }, // ผ่านปรึกษาหมอก่อนซื้อแล้ว
    consult_doctor_ID: { type: String, default: null },
    // ผลของเคส: treated = ทำจริง | consult_no_sale = ปรึกษาแล้วไม่ซื้อ
    outcome: { type: String, enum: ["treated", "consult_no_sale", null], default: null },
    price_override: { type: Number, default: null }, // ราคาคอร์สที่ปรับหน้างาน (admin)
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
    // add_on — ครั้งแรก = บวกเข้ายอดคอร์ส (จ่ายรวม) · ครั้งต่อไป = แยกบิลทันที
    // เลือกได้ทั้ง สินค้า (ตัด stock + ราคาขาย) และ/หรือ หัตถการ (ค่ามือ → BT/หมอ ของเคส)
    add_ons: {
      type: [
        {
          product_ID: { type: String, default: null }, // สินค้า (ตัด stock) — optional
          name: String,
          qty: Number,
          cc_used: Number,
          price: Number,                                // ราคาที่ลูกค้าจ่าย (จากสินค้า)
          recommended_by: { type: String, default: null }, // คนแนะ (sale/หมอ) → คิดคอม
          first_visit: { type: Boolean, default: false },   // ครั้งแรก = รวมบิลคอร์ส
          // หัตถการที่แนบมากับ add-on — ค่ามือยึดตาม BT/หมอ ของเคสนี้
          medical_procedure_ID: { type: String, default: null },
          proc_name: { type: String, default: "" },
          proc_type: { type: String, enum: ["BT", "doctor", null], default: null },
          proc_cost: { type: Number, default: 0 },      // ค่ามือ → BT/หมอ (คิดตอนปิดเคส)
          payment_ID: { type: String, default: null },
          _id: false,
        },
      ],
      default: [],
    },
    // V3: ใบยินยอมการทำหัตถการ — ต้องมีอย่างน้อย 1 ใบก่อน "ปิดเคส" (ทุกเคสแม้คอร์สเดิม)
    consents: {
      type: [
        {
          kind: { type: String, enum: ["upload", "signature"], required: true }, // สแกน/ถ่ายรูป หรือ เซ็นบนจอ
          file: { type: String, required: true },     // data URL (PDF/รูป/ลายเซ็น) ≤5MB
          filename: { type: String, default: "" },
          mime: { type: String, default: "" },
          size: { type: Number, default: 0 },          // bytes โดยประมาณ
          note: { type: String, default: "" },
          uploaded_by: { type: String, default: "" },
          uploaded_at: { type: Date, default: null },
          _id: false,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["open", "consulting", "measuring", "bt_stage", "doctor_stage", "closed"],
      default: "open",
      index: true,
    },
    closed_by: { type: String, default: null },
    closed_at: { type: Date, default: null },
    // ธง claim ตอนกำลังปิดเคส — กันปิดซ้ำจาก double-click/สอง request พร้อมกัน
    closing_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Opd || mongoose.model("Opd", OpdSchema);
