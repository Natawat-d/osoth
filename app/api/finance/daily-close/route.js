import DailyClose from "@/models/DailyClose";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import { apiHandler, requireRole, assertAmount } from "@/lib/api";
import { genId } from "@/services/ids";
import { ensureCoA, postFromDailyClose, assertPeriodOpen } from "@/services/gl";

// เงินสดที่ควรมีของวัน = รับสด (ไม่รวม voided) − ค่าใช้จ่ายเงินสดของวัน
async function expectedCash(branch_ID, date) {
  const pays = await Payment.find({
    branch_ID,
    method: "cash",
    voided: { $ne: true },
    paid_at: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59`) },
  }).lean();
  const exps = await Expense.find({ branch_ID, date }).lean();
  const cashIn = pays.reduce((s, p) => s + p.amount, 0);
  const cashOut = exps.reduce((s, x) => s + x.amount, 0);
  return Math.round((cashIn - cashOut) * 100) / 100;
}

// GET /api/finance/daily-close?date= — สถานะปิดวัน + เงินสดที่ควรมี (ไว้โชว์ก่อนนับ)
export const GET = apiHandler(async (req) => {
  const auth = requireRole(req, ["finance"]);
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    throw Object.assign(new Error("ต้องระบุ date (YYYY-MM-DD)"), { status: 400 });
  const branch_ID = sp.get("branch_ID") || auth.branch_ID;
  const saved = await DailyClose.findOne({ branch_ID, date }).lean();
  const expected = await expectedCash(branch_ID, date);
  return { date, branch_ID, expected_cash: expected, closed: !!saved, record: saved };
});

// POST /api/finance/daily-close { date, counted_cash, note } — ปิดยอด (วันละครั้ง)
// ส่วนต่างลง JE อัตโนมัติ: ขาด → สูญเสีย(6300) · เกิน → รายได้อื่น(4100)
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["finance"]);
  const body = await req.json();
  const date = body.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    throw Object.assign(new Error("ต้องระบุ date (YYYY-MM-DD)"), { status: 400 });
  await assertPeriodOpen(date);
  const counted = assertAmount(body.counted_cash, "เงินสดที่นับได้", { allowZero: true });
  const branch_ID = body.branch_ID || auth.branch_ID;
  const expected = await expectedCash(branch_ID, date);
  const diff = Math.round((counted - expected) * 100) / 100;
  let doc;
  try {
    doc = await DailyClose.create({
      close_ID: await genId("DC", 5),
      branch_ID, date,
      expected_cash: expected,
      counted_cash: counted,
      diff,
      note: body.note || "",
      closed_by: auth.user_ID,
      closed_at: new Date(),
    });
  } catch (e) {
    if (e.code === 11000)
      throw Object.assign(new Error("วันนี้ปิดยอดไปแล้ว"), { status: 409 });
    throw e;
  }
  await ensureCoA();
  await postFromDailyClose(doc);
  return doc;
});
