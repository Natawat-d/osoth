import GlAccount from "@/models/GlAccount";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { ensureCoA } from "@/services/gl";

// GET /api/gl/accounts — ผังบัญชีทั้งหมด (seed มาตรฐานอัตโนมัติครั้งแรก)
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  await ensureCoA();
  return GlAccount.find({}).sort({ code: 1 }).lean();
});

// POST /api/gl/accounts — เพิ่ม/แก้บัญชี (upsert ด้วย code)
export const POST = apiHandler(async (req) => {
  requireOwner(req);
  const body = await req.json();
  if (!body.code?.trim() || !body.name?.trim())
    throw Object.assign(new Error("ต้องมีรหัสบัญชี (code) และชื่อ"), { status: 400 });
  if (!["asset", "liability", "equity", "revenue", "expense"].includes(body.type))
    throw Object.assign(new Error("type ไม่ถูกต้อง"), { status: 400 });
  return GlAccount.findOneAndUpdate(
    { code: body.code.trim() },
    {
      $set: {
        name: body.name.trim(),
        type: body.type,
        group: body.group || "",
        parent_code: body.parent_code || null,
        active: body.active !== false,
      },
      $setOnInsert: { code: body.code.trim(), system: false },
    },
    { upsert: true, new: true }
  );
});
