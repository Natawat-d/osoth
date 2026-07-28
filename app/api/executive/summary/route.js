import Payment from "@/models/Payment";
import Opd from "@/models/Opd";
import StaffEarning from "@/models/StaffEarning";
import Expense from "@/models/Expense";
import CustomerCourse from "@/models/CustomerCourse";
import Branch from "@/models/Branch";
import User from "@/models/User";
import { apiHandler, getAuth } from "@/lib/api";
import { localDate } from "@/services/ids";

const r2 = (n) => Math.round(n * 100) / 100;
const dayKey = (d) => (typeof d === "string" ? d.slice(0, 10) : localDate(new Date(d)));

// GET /api/executive/summary?from=&to=  — เจ้าของ (super_admin) เท่านั้น
// วิเคราะห์การเงินทุกสาขาในทีเดียว: รายรับ/ต้นทุน/ค่ามือ/คอม/กำไร แยกรายสาขา + รวม + กราฟ
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (auth.role !== "super_admin")
    throw Object.assign(new Error("เฉพาะผู้บริหาร (เจ้าของระบบ)"), { status: 403 });

  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "0000-01-01";
  const to = sp.get("to") || "9999-12-31";
  const dRange = { $gte: new Date(`${from}T00:00:00`), $lte: new Date(`${to}T23:59:59`) };
  const sRange = { $gte: from, $lte: to };

  const [branches, payments, closedOpds, earnings, expenses, sold, debtors, users] = await Promise.all([
    Branch.find({ active: true }).lean(),
    Payment.find({ paid_at: dRange }).lean(),
    Opd.find({ status: "closed", date: sRange }).lean(),
    StaffEarning.find({ date: sRange }).lean(),
    Expense.find({ date: sRange }).lean(),
    CustomerCourse.find({ purchased_at: dRange }).lean(),
    CustomerCourse.find({ payment_status: { $ne: "paid" }, status: { $in: ["active", "completed"] } }).lean(),
    User.find({ active: true }).lean(),
  ]);

  const userName = Object.fromEntries(users.map((u) => [u.user_ID, u.nick_name || u.full_name]));

  // โครงต่อสาขา
  const mk = () => ({ income: 0, tx: 0, cogs: 0, fee: 0, commission: 0, expense: 0, cases: 0, courses_sold: 0, receivables: 0 });
  const byBranch = {};
  for (const b of branches) byBranch[b.branch_ID] = { branch_ID: b.branch_ID, name: b.name, ...mk() };
  const bucket = (id) => (byBranch[id] = byBranch[id] || { branch_ID: id, name: id, ...mk() });

  for (const p of payments) { const b = bucket(p.branch_ID); b.income += p.amount; b.tx += 1; }
  for (const o of closedOpds) {
    const b = bucket(o.branch_ID);
    b.cogs += (o.stock_used || []).reduce((x, u) => x + (u.cost_of_goods || 0), 0);
    b.cases += 1;
  }
  for (const e of earnings) {
    const b = bucket(e.branch_ID);
    if (e.type === "procedure_fee") b.fee += e.amount;
    else b.commission += e.amount; // commission + addon_commission
  }
  for (const e of expenses) bucket(e.branch_ID).expense += e.amount;
  for (const c of sold) bucket(c.branch_ID).courses_sold += 1;
  for (const c of debtors) bucket(c.branch_ID).receivables += c.balance_due || 0;

  const branchRows = Object.values(byBranch).map((b) => ({
    ...b,
    cogs: r2(b.cogs),
    labor: r2(b.fee + b.commission),
    net: r2(b.income - b.cogs - b.fee - b.commission - b.expense),
    receivables: r2(b.receivables),
  })).sort((a, b) => b.income - a.income);

  const total = branchRows.reduce((t, b) => ({
    income: t.income + b.income, tx: t.tx + b.tx, cogs: t.cogs + b.cogs, fee: t.fee + b.fee,
    commission: t.commission + b.commission, expense: t.expense + b.expense,
    net: t.net + b.net, cases: t.cases + b.cases, courses_sold: t.courses_sold + b.courses_sold,
    receivables: t.receivables + b.receivables,
  }), { income: 0, tx: 0, cogs: 0, fee: 0, commission: 0, expense: 0, net: 0, cases: 0, courses_sold: 0, receivables: 0 });
  for (const k of Object.keys(total)) total[k] = r2(total[k]);
  total.labor = r2(total.fee + total.commission);
  total.avg_tx = total.tx > 0 ? r2(total.income / total.tx) : 0;

  // time-series รายวัน (รวมทุกสาขา)
  const series = {};
  const bump = (day, f, v) => { series[day] = series[day] || { date: day, income: 0, cogs: 0, labor: 0, expense: 0 }; series[day][f] += v; };
  for (const p of payments) bump(dayKey(p.paid_at), "income", p.amount);
  for (const o of closedOpds) bump(dayKey(o.date), "cogs", (o.stock_used || []).reduce((x, u) => x + (u.cost_of_goods || 0), 0));
  for (const e of earnings) bump(dayKey(e.date), "labor", e.amount);
  for (const e of expenses) bump(dayKey(e.date), "expense", e.amount);
  const seriesArr = Object.values(series)
    .map((d) => ({ ...d, cogs: r2(d.cogs), net: r2(d.income - d.cogs - d.labor - d.expense) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // รายรับแยกช่องทาง (รวม)
  const byMethod = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;

  // ยอดขายแยกคอร์ส (รวม)
  const byCourse = {};
  for (const c of sold) {
    const name = c.course_snapshot?.name || c.course_ID;
    byCourse[name] = byCourse[name] || { name, count: 0, revenue: 0 };
    byCourse[name].count += 1;
    byCourse[name].revenue += c.total_price;
  }
  const salesByCourse = Object.values(byCourse).sort((a, b) => b.revenue - a.revenue);

  // ท็อปพนักงาน (ค่ามือ+คอม รวม)
  const byStaff = {};
  for (const e of earnings) {
    byStaff[e.user_ID] = byStaff[e.user_ID] || { user_ID: e.user_ID, name: userName[e.user_ID] || e.user_ID, role: e.role, branch_ID: e.branch_ID, fee: 0, commission: 0 };
    if (e.type === "procedure_fee") byStaff[e.user_ID].fee += e.amount;
    else byStaff[e.user_ID].commission += e.amount;
  }
  const topStaff = Object.values(byStaff)
    .map((s) => ({ ...s, total: r2(s.fee + s.commission) }))
    .sort((a, b) => b.total - a.total).slice(0, 12);

  return {
    range: { from, to },
    branches: branchRows,
    total,
    series: seriesArr,
    income_by_method: byMethod,
    sales_by_course: salesByCourse,
    top_staff: topStaff,
    branch_count: branchRows.length,
  };
});
