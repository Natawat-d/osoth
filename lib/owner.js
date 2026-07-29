import { getAuth } from "@/lib/api";

// guard เฉพาะเจ้าของระบบ (owner/super_admin) — ใช้กับโมดูล V2 (Setup/Finance/HR)
export function requireOwner(req) {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  if (auth.role !== "super_admin")
    throw Object.assign(new Error("เฉพาะเจ้าของระบบเท่านั้น"), { status: 403 });
  return auth;
}
