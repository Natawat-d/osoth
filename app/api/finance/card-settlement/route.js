import CardSettlement from "@/models/CardSettlement";
import { apiHandler, assertAmount } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { genId, localDate } from "@/services/ids";
import { ensureCoA, postFromCardSettlement, assertPeriodOpen, trialBalance } from "@/services/gl";

// GET — รายการเคลียร์บัตร + ยอด 1020 ที่ยังค้างรอเคลียร์
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const [rows, tb] = await Promise.all([
    CardSettlement.find({}).sort({ date: -1 }).limit(100).lean(),
    trialBalance({}),
  ]);
  const acc1020 = tb.rows.find((r) => r.code === "1020");
  return { rows, pending_1020: acc1020?.balance || 0 };
});

// POST { date, amount, fee, note } — บันทึกเงินบัตร/โอนที่ธนาคารจ่ายเข้าบัญชีจริง (หัก MDR)
// JE: Dr 1010 (สุทธิ) + Dr 6400 (ค่าธรรมเนียม) / Cr 1020
export const POST = apiHandler(async (req) => {
  const auth = requireOwner(req);
  const body = await req.json();
  const date = body.date || localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw Object.assign(new Error("date ไม่ถูกต้อง (YYYY-MM-DD)"), { status: 400 });
  await assertPeriodOpen(date);
  const amount = assertAmount(body.amount, "ยอดเคลียร์");
  const fee = assertAmount(body.fee ?? 0, "ค่าธรรมเนียม", { allowZero: true });
  if (fee >= amount)
    throw Object.assign(new Error("ค่าธรรมเนียมต้องน้อยกว่ายอดเคลียร์"), { status: 400 });
  const doc = await CardSettlement.create({
    settle_ID: await genId("CS", 5),
    date, amount, fee,
    net: Math.round((amount - fee) * 100) / 100,
    note: body.note || "",
    recorded_by: auth.user_ID,
  });
  await ensureCoA();
  await postFromCardSettlement(doc);
  return doc;
});
