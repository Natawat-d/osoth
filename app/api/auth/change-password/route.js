import User from "@/models/User";
import { apiHandler, getAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

// POST /api/auth/change-password { new_password } — บังคับเปลี่ยนครั้งแรกที่ login
export const POST = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.user_ID) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  const { new_password } = await req.json();
  if (!new_password || new_password.length < 4)
    throw Object.assign(new Error("รหัสผ่านต้องอย่างน้อย 4 ตัว"), { status: 400 });
  const u = await User.findOne({ user_ID: auth.user_ID });
  if (!u) throw Object.assign(new Error("ไม่พบผู้ใช้"), { status: 404 });
  u.password_hash = await hashPassword(new_password);
  u.must_change_password = false;
  await u.save();
  return { ok: true };
});
