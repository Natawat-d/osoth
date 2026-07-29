import Budget from "@/models/Budget";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { genId } from "@/services/ids";

// GET /api/budgets?year=2026 — งบประมาณของปี
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const sp = new URL(req.url).searchParams;
  const year = Number(sp.get("year")) || new Date().getFullYear();
  return Budget.find({ year }).sort({ account_code: 1 }).lean();
});

// POST — ตั้ง/แก้งบ (upsert ต่อ year+account) { year, account_code, monthly[12] }
export const POST = apiHandler(async (req) => {
  requireOwner(req);
  const body = await req.json();
  const year = Number(body.year) || new Date().getFullYear();
  if (!body.account_code) throw Object.assign(new Error("ต้องระบุรหัสบัญชี"), { status: 400 });
  const monthly = Array.isArray(body.monthly) && body.monthly.length === 12
    ? body.monthly.map((v) => Number(v) || 0)
    : Array(12).fill(0);
  return Budget.findOneAndUpdate(
    { year, account_code: body.account_code },
    { $set: { monthly, note: body.note || "" }, $setOnInsert: { budget_ID: await genId("BG", 4), year, account_code: body.account_code } },
    { upsert: true, new: true }
  );
});
