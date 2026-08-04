import CustomerCourse from "@/models/CustomerCourse";
import Customer from "@/models/Customer";
import ApBill from "@/models/ApBill";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { trialBalance, profitLoss, budgetVsActual, rebuildJournal } from "@/services/gl";

// GET /api/gl/reports/[kind]?from=&to=&year=
// kind: trial-balance | pnl | ar | ap-aging | budget-vs-actual
// ก่อนคำนวณ → lazy-sync journal จากธุรกรรมล่าสุดเสมอ (idempotent เร็ว เพราะ post เฉพาะที่ขาด)
const KINDS = ["trial-balance", "pnl", "ar", "ap-aging", "budget-vs-actual"];

export const GET = apiHandler(async (req, { params }) => {
  requireOwner(req);
  const { kind } = await params;
  if (!KINDS.includes(kind))
    throw Object.assign(new Error("ไม่รู้จักรายงานนี้"), { status: 404 });
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "0000-01-01";
  const to = sp.get("to") || "9999-12-31";

  await rebuildJournal(); // journal ครบก่อนออกรายงานเสมอ (เอกสารเสียถูกข้าม — ไม่ทำรายงานพัง)

  if (kind === "trial-balance") return trialBalance({ from, to });
  if (kind === "pnl") return profitLoss({ from, to });
  if (kind === "budget-vs-actual")
    return budgetVsActual({ year: Number(sp.get("year")) || new Date().getFullYear() });

  if (kind === "ar") {
    // ลูกหนี้ = คอร์สค้างชำระ (ระบบขายเป็นจ่ายเต็ม — ค้าง = ขายแล้วยังไม่จ่าย)
    const debtors = await CustomerCourse.find({
      payment_status: { $ne: "paid" },
      status: { $in: ["active", "completed"] },
      balance_due: { $gt: 0 },
    }).sort({ purchased_at: 1 }).lean();
    const hns = [...new Set(debtors.map((d) => d.HN_number))];
    const customers = await Customer.find({ HN_number: { $in: hns } }).lean();
    const cname = Object.fromEntries(customers.map((c) => [c.HN_number, c.full_name]));
    const rows = debtors.map((d) => ({
      customer_course_ID: d.customer_course_ID,
      HN_number: d.HN_number,
      customer: cname[d.HN_number] || d.HN_number,
      course: d.course_snapshot?.name || d.course_ID,
      total_price: d.total_price,
      balance_due: d.balance_due,
      purchased_at: d.purchased_at,
      days: Math.floor((Date.now() - new Date(d.purchased_at)) / 86400000),
    }));
    return { rows, total: rows.reduce((s, r) => s + r.balance_due, 0) };
  }

  if (kind === "ap-aging") {
    const bills = await ApBill.find({ status: { $ne: "paid" } }).sort({ bill_date: 1 }).lean();
    const rows = bills.map((b) => {
      const paid = (b.payments || []).reduce((s, p) => s + p.amount, 0);
      return {
        bill_ID: b.bill_ID, supplier: b.supplier_name || b.supplier_ID || "-",
        description: b.description, bill_date: b.bill_date, due_date: b.due_date,
        amount: b.amount, paid, outstanding: b.amount - paid,
        overdue: b.due_date && b.due_date < new Date().toISOString().slice(0, 10),
      };
    });
    return { rows, total: rows.reduce((s, r) => s + r.outstanding, 0) };
  }

  throw Object.assign(new Error("ไม่รู้จักรายงานนี้"), { status: 404 });
});
