import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.AUTH_SECRET || "osoth-dev-secret-change-in-prod";
const COOKIE = "osoth_token";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 วัน (วินาที)

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, hash) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));

// payload: { user_ID, role, branch_ID }
export const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: MAX_AGE });
export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

// อ่าน token จาก cookie หรือ Authorization: Bearer (ให้ test/สคริปต์ใช้ Bearer ได้)
export function readToken(req) {
  const bearer = req.headers.get("authorization");
  if (bearer && bearer.startsWith("Bearer ")) return bearer.slice(7);
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const cookieName = COOKIE;
export const cookieMaxAge = MAX_AGE;
// header ตั้ง httpOnly cookie
export function setCookieHeader(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
