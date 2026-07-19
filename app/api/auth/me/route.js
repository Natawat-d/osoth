import User from "@/models/User";
import { apiHandler, getAuth } from "@/lib/api";

// GET /api/auth/me → ข้อมูลผู้ใช้ปัจจุบัน (จาก JWT) — ใช้ตอนโหลดแอปเพื่อคืน session
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.user_ID) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  const u = await User.findOne({ user_ID: auth.user_ID }).lean();
  if (!u || !u.login_active || !u.active) throw Object.assign(new Error("บัญชีถูกปิดใช้งาน"), { status: 401 });
  return {
    user: { user_ID: u.user_ID, role: u.role, branch_ID: u.branch_ID, full_name: u.full_name, nick_name: u.nick_name, username: u.username },
    must_change_password: !!u.must_change_password,
  };
});
