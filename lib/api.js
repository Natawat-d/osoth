import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { readToken, verifyToken } from "@/lib/auth";

// wrapper มาตรฐานของทุก API route: ต่อ db + จัดการ error เป็น JSON เดียวกัน
// ค่าเริ่มต้น "ต้อง login" ทุก route — ยกเว้นประกาศ { public: true } (landing/ลูกค้า anonymous)
// (ชั้นสิทธิ์ละเอียดยังใช้ requireRole/requireOwner ในแต่ละ route เหมือนเดิม)
export function apiHandler(fn, { public: isPublic = false } = {}) {
  return async (req, ctx) => {
    try {
      await dbConnect();
      if (!isPublic) {
        const auth = getAuth(req);
        if (!auth.user_ID)
          throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
      }
      const data = await fn(req, ctx);
      return NextResponse.json({ ok: true, data });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return NextResponse.json(
        { ok: false, error: err.message || "server error", code: err.code },
        { status }
      );
    }
  };
}

// route สาธารณะ (landing/ลูกค้า anonymous/สมัคร owner) — ไม่บังคับ login
export const publicApiHandler = (fn) => apiHandler(fn, { public: true });

// ตรวจจำนวนเงิน/จำนวนชิ้นจาก client — กันติดลบ/0/NaN/Infinity ก่อนถึงชั้นเงินทุกจุด
export function assertAmount(v, label = "จำนวนเงิน", { allowZero = false, integer = false } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)))
    throw Object.assign(new Error(`${label} ไม่ถูกต้อง`), { status: 400 });
  if (n < 0 || (!allowZero && n === 0))
    throw Object.assign(new Error(`${label} ต้องมากกว่า 0`), { status: 400 });
  return Math.round(n * 100) / 100;
}

// auth จริง: ตัวตน (user_ID/role) มาจาก JWT ใน cookie/Bearer เท่านั้น
// branch_ID: owner (super_admin) สลับสาขาได้ผ่าน x-branch-id (preference) — คนอื่นล็อกที่สาขาตัวเอง
export function getAuth(req) {
  const payload = verifyToken(readToken(req) || "");
  if (!payload) return { user_ID: null, role: null, branch_ID: null };
  const headerBranch = req.headers.get("x-branch-id");
  const branch_ID = payload.role === "super_admin"
    ? (headerBranch !== null ? headerBranch : payload.branch_ID)
    : payload.branch_ID;
  return { user_ID: payload.user_ID, role: payload.role, branch_ID: branch_ID || null };
}

// V3 (5 roles): admin = จอง+รับลูกค้า+OPD ครบ (ขาย/รับเงิน/ปิดเคสใน OPD ได้)
//               sale  = จอง+รับลูกค้า+ขายคอร์สตอนจอง (ไม่ทำ OPD)
//               งานบริหารทั้งหมด (stock/finance/catalog/HR) = owner เท่านั้น
const ROLE_PERMS = {
  super_admin: ["*"],
  admin: ["queue", "booking", "opd", "close_case", "sell_course", "customer", "my_earning"],
  sale: ["queue", "booking", "sell_course", "customer", "my_earning"],
  doctor: ["my_queue", "record_procedure", "my_earning"],
  BT: ["my_queue", "record_procedure", "my_earning"],
};

export function requireRole(req, perms) {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  const mine = ROLE_PERMS[auth.role] || [];
  if (mine.includes("*")) return auth;
  const allowed = perms.some((p) => mine.includes(p));
  if (!allowed)
    throw Object.assign(new Error(`role ${auth.role} ไม่มีสิทธิ์ทำรายการนี้`), {
      status: 403,
    });
  return auth;
}
