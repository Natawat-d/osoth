import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";

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

// mock auth: อ่านตัวตนจาก header ที่ client แนบมา (x-user-id / x-user-role / x-branch-id)
// โครงนี้เปลี่ยนเป็น NextAuth/JWT ภายหลังได้โดย API route ไม่ต้องแก้
export function getAuth(req) {
  return {
    user_ID: req.headers.get("x-user-id") || null,
    role: req.headers.get("x-user-role") || null,
    branch_ID: req.headers.get("x-branch-id") || null,
  };
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
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้ (mock login)"), { status: 401 });
  const mine = ROLE_PERMS[auth.role] || [];
  if (mine.includes("*")) return auth;
  const allowed = perms.some((p) => mine.includes(p));
  if (!allowed)
    throw Object.assign(new Error(`role ${auth.role} ไม่มีสิทธิ์ทำรายการนี้`), {
      status: 403,
    });
  return auth;
}
