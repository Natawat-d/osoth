import Payment from "@/models/Payment";
import Opd from "@/models/Opd";
import Reserve from "@/models/Reserve";
import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/finance/reconcile?branch_ID=&date=YYYY-MM-DD
// ปิดยอดสิ้นวัน (GAP-04): รายรับแยกช่องทาง + เงินสดที่ควรมี + exception (ค้างชำระ/คิวค้าง)
export const GET = apiHandler(async (req) => {
  requireRole(req, ["finance"]);
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID");
  const date = sp.get("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    throw Object.assign(new Error("ต้องระบุ date (YYYY-MM-DD)"), { status: 400 });
  const bFilter = branch_ID && branch_ID !== "all" ? { branch_ID } : {};

  const payments = await Payment.find({
    ...bFilter,
    paid_at: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59`) },
  }).lean();
  const byMethod = { cash: 0, transfer: 0, card: 0 };
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const closed = await Opd.countDocuments({ ...bFilter, status: "closed", date });
  const soldToday = await CustomerCourse.countDocuments({
    ...bFilter,
    purchased_at: { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59`) },
  });

  // exceptions: ลูกหนี้ค้างชำระ + คิววันนี้ที่ยังไม่จบ
  const debtors = await CustomerCourse.find({
    ...bFilter, payment_status: { $ne: "paid" }, status: { $in: ["active", "completed"] },
  }).lean();
  const pending = await Reserve.find({
    ...bFilter, date, status: { $in: ["booked", "arrived", "ready", "bt_stage", "doctor_stage"] },
  }).lean();

  return {
    date,
    by_method: byMethod,
    total,
    cash_expected: byMethod.cash || 0,
    payment_count: payments.length,
    cases_closed: closed,
    courses_sold: soldToday,
    exceptions: {
      receivables_total: debtors.reduce((s, c) => s + c.balance_due, 0),
      debtor_count: debtors.length,
      pending_reserves: pending.map((r) => ({
        reserve_ID: r.reserve_ID, time: `${r.time_start}–${r.time_end}`,
        who: r.contact?.nick_name || r.HN_number, status: r.status, room_ID: r.room_ID,
      })),
    },
  };
});
