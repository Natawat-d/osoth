import mongoose from "mongoose";

const CourseProductSchema = new mongoose.Schema(
  {
    product_ID: { type: String, required: true },
    sub_unit_per_use: { type: Number, required: true }, // โดสต่อครั้ง — ตายตัว
  },
  { _id: false }
);

const CourseProcedureSchema = new mongoose.Schema(
  { medical_procedure_ID: { type: String, required: true } },
  { _id: false }
);

const CourseSchema = new mongoose.Schema(
  {
    course_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true }, // catalog แยกต่อสาขา
    name: { type: String, required: true },
    quantity_used: { type: Number, required: true }, // จำนวนครั้งทั้งหมด
    validity_days: { type: Number, default: 0 }, // 0 = ไม่หมดอายุ
    price: { type: Number, required: true },
    products: { type: [CourseProductSchema], default: [] },
    BT_procedures: { type: [CourseProcedureSchema], default: [] }, // ว่าง = ข้ามขั้น BT
    doctor_procedures: { type: [CourseProcedureSchema], default: [] }, // ว่าง = ข้ามขั้นหมอ
    duration_minutes: { type: Number, default: 60 },
    image: { type: String, default: "" }, // รูปโชว์บน carousel หน้าร้าน (URL หรือ data URL)
    is_promotion_course: { type: Boolean, default: false },
    origin_course_ID: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Course || mongoose.model("Course", CourseSchema);
