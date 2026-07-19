import User from "@/models/User";
import { apiHandler, getAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

// POST /api/users/[id]/reset-password { password } — เจ้าของรีเซ็ตรหัสให้พนักงาน (บังคับเปลี่ยนใหม่)
export const POST = apiHandler(async (req, { params }) => {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  if (auth.role !== "super_admin") throw Object.assign(new Error("เฉพาะเจ้าของระบบเท่านั้น"), { status: 403 });
  const { id } = await params;
  const { password } = await req.json();
  if (!password || password.length < 4) throw Object.assign(new Error("รหัสผ่านอย่างน้อย 4 ตัว"), { status: 400 });
  const u = await User.findOne({ user_ID: id });
  if (!u) throw Object.assign(new Error("ไม่พบผู้ใช้"), { status: 404 });
  if (!u.username) throw Object.assign(new Error("ผู้ใช้นี้ยังไม่มี username — ตั้ง login ก่อน"), { status: 400 });
  u.password_hash = await hashPassword(password);
  u.must_change_password = true;
  u.login_active = true;
  u.failed_attempts = 0;
  u.locked_until = null;
  await u.save();
  return { user_ID: u.user_ID, ok: true };
});
