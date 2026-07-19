import User from "@/models/User";
import { apiHandler } from "@/lib/api";
import { verifyPassword, signToken, setCookieHeader } from "@/lib/auth";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";

const LOCK_FAILS = 5;
const LOCK_MINS = 15;
const safe = (u) => ({ user_ID: u.user_ID, role: u.role, branch_ID: u.branch_ID, full_name: u.full_name, nick_name: u.nick_name, username: u.username });
const err = (status, message) => NextResponse.json({ ok: false, error: message }, { status });

// POST /api/auth/login { username, password } → set httpOnly cookie + return { user, token, must_change_password }
export async function POST(req) {
  await dbConnect();
  try {
    const { username, password } = await req.json();
    const user = await User.findOne({ username: (username || "").trim() });
    if (!user || !user.login_active || !user.active) return err(401, "username หรือรหัสผ่านไม่ถูกต้อง");
    if (user.locked_until && user.locked_until > new Date())
      return err(423, `ถูกล็อกชั่วคราว ลองใหม่ภายหลัง (${LOCK_MINS} นาที)`);

    const ok = await verifyPassword(password || "", user.password_hash);
    if (!ok) {
      user.failed_attempts = (user.failed_attempts || 0) + 1;
      if (user.failed_attempts >= LOCK_FAILS) {
        user.locked_until = new Date(Date.now() + LOCK_MINS * 60000);
        user.failed_attempts = 0;
      }
      await user.save();
      return err(401, "username หรือรหัสผ่านไม่ถูกต้อง");
    }
    // สำเร็จ — reset ตัวนับ
    user.failed_attempts = 0;
    user.locked_until = null;
    await user.save();

    const token = signToken({ user_ID: user.user_ID, role: user.role, branch_ID: user.branch_ID });
    const res = NextResponse.json({ ok: true, data: { user: safe(user), token, must_change_password: !!user.must_change_password } });
    res.headers.set("Set-Cookie", setCookieHeader(token));
    return res;
  } catch (e) {
    return err(500, e.message || "server error");
  }
}
