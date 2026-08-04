import mongoose from "mongoose";

// ข้อมูลบริษัท (singleton — มี doc เดียวทั้งระบบ, company_ID = "CO-001")
// ตั้งค่าครั้งแรกตอน owner สมัคร (register-owner) · แก้ได้ที่ Setup > Company/Brand
const CompanySchema = new mongoose.Schema(
  {
    company_ID: { type: String, required: true, unique: true, default: "CO-001" },
    // ---- ข้อมูลนิติบุคคล (Setup > Company) ----
    name: { type: String, required: true },
    address: { type: String, default: "" },
    tax_id: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    // ---- แบรนด์ (Setup > Brand) — ใช้กับ about_me / navbar / ใบเสร็จ ----
    // ปิดงวดบัญชี: ห้ามบันทึกเอกสารเงินลงวันที่ <= วันนี้ (แก้ย้อนหลังต้องกลับรายการในงวดปัจจุบัน)
    gl_locked_through: { type: String, default: "" }, // "YYYY-MM-DD" · "" = ไม่ล็อก
    brand: {
      display_name: { type: String, default: "Osoth" },
      logo: { type: String, default: "/brand/logo.jpg" }, // path public หรือ data URL
      primary_color: { type: String, default: "#1560a3" },
      tagline: { type: String, default: "คลินิกความงาม" },
      about: { type: String, default: "" }, // ข้อความแนะนำหน้า about_me
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Company || mongoose.model("Company", CompanySchema);
