import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { readToken, verifyToken } from "@/lib/auth";

// wrapper มาตรฐานของทุก API route: ต่อ db + จัดการ error เป็น JSON เดียวกัน
export function apiHandler(fn) {
  return async (req, ctx) => {
    try {
      await dbConnect();
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

const ROLE_PERMS = {
  super_admin: ["*"],
  admin: ["queue", "close_case", "stock", "opd", "booking", "finance", "crud"],
  acception: ["queue", "opd", "booking"],
  sale: ["booking", "sell_course"],
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
