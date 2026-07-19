import mongoose from "mongoose";

export const ROLES = [
  "super_admin",
  "admin",
  "acception",
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
    commission_rate: { type: Number, default: 0 }, // % — ใช้กับ role sale
    color: { type: String, default: "#B3282D" }, // สีบนปฏิทิน (หมอ)
    active: { type: Boolean, default: true },
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
