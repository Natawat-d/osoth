import { NextResponse } from "next/server";
import { clearCookieHeader } from "@/lib/auth";

// POST /api/auth/logout → ลบ cookie
export async function POST() {
  const res = NextResponse.json({ ok: true, data: { ok: true } });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
