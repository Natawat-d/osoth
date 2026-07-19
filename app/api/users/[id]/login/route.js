import User from "@/models/User";
import { apiHandler, getAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

// เจ้าของเท่านั้น
function requireOwner(req) {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  if (auth.role !== "super_admin") throw Object.assign(new Error("เฉพาะเจ้าของระบบเท่านั้น"), { status: 403 });
  return auth;
}

// POST /api/users/[id]/login { username, password } — เจ้าของตั้ง/แก้ login ให้พนักงาน
// ตั้งรหัสเริ่มต้น + บังคับเปลี่ยนครั้งแรก
export const POST = apiHandler(async (req, { params }) => {
  requireOwner(req);
  const { id } = await params;
  const { username, password } = await req.json();
  const uname = (username || "").trim();
  if (!uname || uname.length < 3) throw Object.assign(new Error("username อย่างน้อย 3 ตัว"), { status: 400 });
  if (!password || password.length < 4) throw Object.assign(new Error("รหัสผ่านอย่างน้อย 4 ตัว"), { status: 400 });

  // username ต้องไม่ซ้ำกับคนอื่น
  const dup = await User.findOne({ username: uname, user_ID: { $ne: id } }).lean();
  if (dup) throw Object.assign(new Error("username นี้ถูกใช้แล้ว"), { status: 409 });

  const u = await User.findOne({ user_ID: id });
  if (!u) throw Object.assign(new Error("ไม่พบผู้ใช้"), { status: 404 });
  u.username = uname;
  u.password_hash = await hashPassword(password);
  u.must_change_password = true;
  u.login_active = true;
  u.failed_attempts = 0;
  u.locked_until = null;
  await u.save();
  return { user_ID: u.user_ID, username: u.username, login_active: u.login_active };
});

// DELETE /api/users/[id]/login — ปิดสิทธิ์ login (ไม่ลบบัญชี)
export const DELETE = apiHandler(async (req, { params }) => {
  requireOwner(req);
  const { id } = await params;
  const u = await User.findOneAndUpdate({ user_ID: id }, { $set: { login_active: false } }, { new: true });
  if (!u) throw Object.assign(new Error("ไม่พบผู้ใช้"), { status: 404 });
  return { user_ID: u.user_ID, login_active: u.login_active };
});
