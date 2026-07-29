import User from "@/models/User";
import Company from "@/models/Company";
import Branch from "@/models/Branch";
import { apiHandler } from "@/lib/api";
import { hashPassword, signToken, setCookieHeader } from "@/lib/auth";
import { genId } from "@/services/ids";
import { MAIN_BRANCH, MAIN_BRANCH_NAME } from "@/lib/branch";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";

const bad = (status, message) => Object.assign(new Error(message), { status });

// POST /api/auth/register-owner
//   { company:{name,address,tax_id,phone,email}, owner:{full_name,username,password,nick_name,phone,profile_picture} }
// สมัคร owner คนแรกของระบบ — อนุญาตเฉพาะตอนยังไม่มี super_admin (first-run เท่านั้น)
// สร้าง: Company (CO-001) + Branch หลัก (BR-001) + owner user (super_admin) แล้ว auto-login
export async function POST(req) {
  await dbConnect();
  try {
    const existing = await User.countDocuments({ role: "super_admin" });
    if (existing > 0) throw bad(403, "ระบบมีเจ้าของอยู่แล้ว — ไม่สามารถสมัครซ้ำได้");

    const body = await req.json();
    const c = body.company || {};
    const o = body.owner || {};
    if (!c.name?.trim()) throw bad(400, "กรุณากรอกชื่อบริษัท");
    if (!o.full_name?.trim()) throw bad(400, "กรุณากรอกชื่อ-นามสกุลเจ้าของ");
    if (!o.username?.trim()) throw bad(400, "กรุณากรอกชื่อผู้ใช้ (username)");
    if (!o.password || o.password.length < 4) throw bad(400, "รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร");

    const dupUser = await User.findOne({ username: o.username.trim() });
    if (dupUser) throw bad(409, "ชื่อผู้ใช้นี้ถูกใช้แล้ว");

    // 1) Company (singleton)
    await Company.findOneAndUpdate(
      { company_ID: "CO-001" },
      {
        company_ID: "CO-001",
        name: c.name.trim(),
        address: c.address || "",
        tax_id: c.tax_id || "",
        phone: c.phone || "",
        email: c.email || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2) สาขาหลัก (single-branch)
    await Branch.findOneAndUpdate(
      { branch_ID: MAIN_BRANCH },
      {
        branch_ID: MAIN_BRANCH,
        name: MAIN_BRANCH_NAME,
        address: c.address || "",
        phone: c.phone || "",
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 3) owner (super_admin)
    const user_ID = await genId("US", 3);
    const password_hash = await hashPassword(o.password);
    const owner = await User.create({
      user_ID,
      branch_ID: MAIN_BRANCH,
      role: "super_admin",
      full_name: o.full_name.trim(),
      nick_name: o.nick_name || "",
      phone: o.phone || "",
      email: o.email || "",
      profile_picture: o.profile_picture || "",
      username: o.username.trim(),
      password_hash,
      must_change_password: false, // owner ตั้งรหัสเองแล้ว
      login_active: true,
      active: true,
    });

    const token = signToken({ user_ID: owner.user_ID, role: owner.role, branch_ID: owner.branch_ID });
    const safe = {
      user_ID: owner.user_ID, role: owner.role, branch_ID: owner.branch_ID,
      full_name: owner.full_name, nick_name: owner.nick_name, username: owner.username,
    };
    const res = NextResponse.json({ ok: true, data: { user: safe, token, must_change_password: false } });
    res.headers.set("Set-Cookie", setCookieHeader(token));
    return res;
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return NextResponse.json({ ok: false, error: e.message || "server error" }, { status });
  }
}
