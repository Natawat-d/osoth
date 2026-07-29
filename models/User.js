import mongoose from "mongoose";

// V3: 5 roles — ตัด acception (admin = จอง+รับลูกค้า+OPD ในตัว)
export const ROLES = [
  "super_admin",
  "admin",
  "sale",
  "BT",
  "doctor",
];

const UserSchema = new mongoose.Schema(
  {
    user_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    full_name: { type: String, required: true },
    nick_name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    commission_rate: { type: Number, default: 0 }, // % — ใช้กับ role sale (legacy)
    color: { type: String, default: "#B3282D" }, // สีบนปฏิทิน (หมอ)
    active: { type: Boolean, default: true },
    profile_picture: { type: String, default: "" }, // path public หรือ data URL (owner ตั้งตอนเพิ่มพนักงาน)
    // ---- ค่าตัว/ค่ามือ (Setup) — doctor/BT แยกจากพนักงานธรรมดา ----
    rate_per_hour: { type: Number, default: 0 }, // ค่าตัวต่อชั่วโมง (doctor/BT)
    hand_fee: { type: Number, default: 0 },       // ค่ามือ BT (ต่อหัตถการ, default)
    doctor_fee: { type: Number, default: 0 },     // DF ค่ามือหมอ (default)
    // ---- sale incentive: ต่อคน + ขั้นบันไดตามยอด ----
    // tiers: [{ min_sales:number, rate:number(%) }] เรียงจากน้อยไปมาก
    incentive_tiers: { type: [{ min_sales: Number, rate: Number }], default: [] },
    // ---- HR เต็ม (Phase 5) ----
    salary: { type: Number, default: 0 },           // เงินเดือน (พนักงานประจำ)
    start_date: { type: String, default: "" },       // วันเริ่มงาน "YYYY-MM-DD"
    id_card: { type: String, default: "" },          // เลขบัตรประชาชน
    address: { type: String, default: "" },
    emergency_contact: { type: String, default: "" }, // ชื่อ+เบอร์ผู้ติดต่อฉุกเฉิน
    manager_ID: { type: String, default: null },      // หัวหน้า (org chart)
    hr_note: { type: String, default: "" },
    // ---- login (owner จัดการ) ----
    username: { type: String, default: null, index: true, sparse: true },
    password_hash: { type: String, default: null }, // bcrypt
    must_change_password: { type: Boolean, default: false }, // บังคับเปลี่ยนครั้งแรก
    login_active: { type: Boolean, default: true },   // เปิด/ปิดสิทธิ์ login
    failed_attempts: { type: Number, default: 0 },
    locked_until: { type: Date, default: null },      // ล็อกชั่วคราวหลังผิด 5 ครั้ง
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
