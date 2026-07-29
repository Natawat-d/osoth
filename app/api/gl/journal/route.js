import JournalEntry from "@/models/JournalEntry";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { postJE, ensureCoA } from "@/services/gl";
import { localDate } from "@/services/ids";

// GET /api/gl/journal?from=&to=&source= — สมุดรายวัน (ล่าสุดก่อน)
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  await ensureCoA();
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("from") || sp.get("to")) {
    filter.date = {};
    if (sp.get("from")) filter.date.$gte = sp.get("from");
    if (sp.get("to")) filter.date.$lte = sp.get("to");
  }
  if (sp.get("source")) filter.source_type = sp.get("source");
  return JournalEntry.find(filter).sort({ date: -1, created_at: -1 }).limit(300).lean();
});

// POST /api/gl/journal — บันทึกรายการ manual { date, memo, lines:[{account_code,debit,credit}] }
export const POST = apiHandler(async (req) => {
  const auth = requireOwner(req);
  await ensureCoA();
  const body = await req.json();
  const lines = (body.lines || []).filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0);
  if (lines.length < 2)
    throw Object.assign(new Error("ต้องมีอย่างน้อย 2 บรรทัด (เดบิต/เครดิต)"), { status: 400 });
  return postJE({
    date: body.date || localDate(),
    memo: body.memo || "",
    lines,
    source_type: "manual",
    source_ID: null,
    posted_by: auth.user_ID,
  });
});
