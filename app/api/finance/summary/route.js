import Payment from "@/models/Payment";
import Opd from "@/models/Opd";
import StaffEarning from "@/models/StaffEarning";
import Expense from "@/models/Expense";
import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole } from "@/lib/api";
import { localDate } from "@/services/ids";

// GET /api/finance/summary?branch_ID=..&from=YYYY-MM-DD&to=YYYY-MM-DD
// กำไรคงเหลือ = รายรับ − COGS(ทุนจริงตาม lot) − ค่าแรงผันแปร − รายจ่ายอื่น
export const GET = apiHandler(async (req) => {
  requireRole(req, ["finance"]);
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID");
  const from = sp.get("from") || "0000-01-01";
  const to = sp.get("to") || "9999-12-31";
  // branch_ID = "all" หรือว่าง = รวมทุกสาขา
  const bFilter = branch_ID && branch_ID !== "all" ? { branch_ID } : {};

  // รายรับ — จาก payment จริง (แยกตาม type/method)
  const payments = await Payment.find({
    ...bFilter,
    paid_at: {
      $gte: new Date(`${from}T00:00:00`),
      $lte: new Date(`${to}T23:59:59`),
    },
  }).lean();
  const income = payments.reduce((s, p) => s + p.amount, 0);
  const incomeByType = groupSum(payments, "type");
  const incomeByMethod = groupSum(payments, "method");

  // COGS — ทุนจริงของ lot ที่ถูกตัดในเคสที่ปิดช่วงนั้น
  const closedOpds = await Opd.find({
    ...bFilter,
    status: "closed",
    date: { $gte: from, $lte: to },
  }).lean();
  const cogs = closedOpds.reduce(
    (s, o) => s + (o.stock_used || []).reduce((x, u) => x + (u.cost_of_goods || 0), 0),
    0
  );

  // ค่าแรงผันแปร (ค่ามือ + คอม) — แยกรายคน
  const earnings = await StaffEarning.find({
    ...bFilter,
    date: { $gte: from, $lte: to },
  }).lean();
  const laborCost = earnings.reduce((s, e) => s + e.amount, 0);
  const byStaff = {};
  for (const e of earnings) {
    byStaff[e.user_ID] = byStaff[e.user_ID] || {
      user_ID: e.user_ID,
      role: e.role,
      cases: 0,
      total: 0,
    };
    byStaff[e.user_ID].cases += 1;
    byStaff[e.user_ID].total += e.amount;
  }

  // รายจ่ายอื่น
  const expenses = await Expense.find({
    ...bFilter,
    date: { $gte: from, $lte: to },
  }).lean();
  const otherExpense = expenses.reduce((s, e) => s + e.amount, 0);

  // ลูกหนี้ค้างผ่อน (ณ ปัจจุบัน ไม่ขึ้นกับช่วงเวลา)
  const debtors = await CustomerCourse.find({
    ...bFilter,
    payment_status: { $ne: "paid" },
    status: { $in: ["active", "completed"] },
  }).lean();
  const receivables = debtors.reduce((s, c) => s + c.balance_due, 0);

  // ---- time-series รายวัน (กราฟเส้น) ----
  const dayKey = (d) => (typeof d === "string" ? d.slice(0, 10) : localDate(new Date(d)));
  const series = {};
  const bump = (day, field, v) => {
    series[day] = series[day] || { date: day, income: 0, cogs: 0, labor: 0, expense: 0 };
    series[day][field] += v;
  };
  for (const p of payments) bump(dayKey(p.paid_at), "income", p.amount);
  for (const o of closedOpds)
    bump(dayKey(o.date), "cogs", (o.stock_used || []).reduce((x, u) => x + (u.cost_of_goods || 0), 0));
  for (const e of earnings) bump(dayKey(e.date), "labor", e.amount);
  for (const e of expenses) bump(dayKey(e.date), "expense", e.amount);
  const seriesArr = Object.values(series)
    .map((d) => ({ ...d, cogs: round2(d.cogs), net: round2(d.income - d.cogs - d.labor - d.expense) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---- ยอดขายแยกคอร์ส (กราฟวง — ปริมาณที่ขาย แยกประเภท) ----
  const sold = await CustomerCourse.find({
    ...bFilter,
    purchased_at: { $gte: new Date(`${from}T00:00:00`), $lte: new Date(`${to}T23:59:59`) },
  }).lean();
  const byCourse = {};
  for (const c of sold) {
    const name = c.course_snapshot?.name || c.course_ID;
    byCourse[name] = byCourse[name] || { name, count: 0, revenue: 0 };
    byCourse[name].count += 1;
    byCourse[name].revenue += c.total_price;
  }
  const salesByCourse = Object.values(byCourse).sort((a, b) => b.revenue - a.revenue);

  return {
    range: { from, to },
    income,
    income_by_type: incomeByType,
    income_by_method: incomeByMethod,
    cogs: round2(cogs),
    labor_cost: laborCost,
    other_expense: otherExpense,
    net: round2(income - cogs - laborCost - otherExpense),
    cases_closed: closedOpds.length,
    by_staff: Object.values(byStaff),
    receivables,
    debtor_count: debtors.length,
    series: seriesArr,
    sales_by_course: salesByCourse,
    courses_sold: sold.length,
  };
});

function groupSum(arr, key) {
  const out = {};
  for (const a of arr) out[a[key]] = (out[a[key]] || 0) + a.amount;
  return out;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
