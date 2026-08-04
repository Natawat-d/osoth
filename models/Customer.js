import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    HN_number: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true }, // สาขาที่ลงทะเบียนครั้งแรก
    prefix: { type: String, default: "" }, // นาย/นาง/นางสาว
    full_name: { type: String, required: true },
    sure_name: { type: String, default: "" },
    nick_name: { type: String, default: "" },
    id_card: { type: String, default: "" }, // เลขบัตรประชาชน/หนังสือเดินทาง
    nationality: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    email: { type: String, default: "" },
    line_id: { type: String, default: "" },
    birth_date: { type: String, default: "" },
    gender: { type: String, default: "" },
    address: { type: String, default: "" },
    // ผู้ติดต่อกรณีฉุกเฉิน (ตามเอกสารประวัติผู้ใช้บริการ)
    emergency: { type: Object, default: {} }, // { name, relation, phone }
    // ข้อมูลสุขภาพ 9 ข้อ — key: { has: true|false|null, detail } (null = ยังไม่ตอบ)
    health_info: { type: Object, default: {} },
    // ลายเซ็นผู้ใช้บริการในเอกสารประวัติ (dataURL) + วันที่กรอก — กรอกครั้งเดียวต่อ HN ใช้ซ้ำทุกคอร์ส
    history_signature: { type: String, default: "" },
    history_date: { type: String, default: "" },
    drug_allergies: { type: [String], default: [] },
    chronic_diseases: { type: [String], default: [] },
    note: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Customer ||
  mongoose.model("Customer", CustomerSchema);
