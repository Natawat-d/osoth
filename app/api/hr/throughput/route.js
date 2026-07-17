import StaffEarning from "@/models/StaffEarning";
import User from "@/models/User";
import MedicalProcedure from "@/models/MedicalProcedure";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/hr/throughput?branch_ID=&from=&to=
// อัตราการเข้าทำเคสต่อพนักงาน — ใครทำหัตถการอะไรกี่ครั้ง + รายได้
export const GET = apiHandler(async (req) => {
  requireRole(req, ["crud"]); // admin/super_admin
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID");
  const from = sp.get("from") || "0000-01-01";
  const to = sp.get("to") || "9999-12-31";

  const filter = { date: { $gte: from, $lte: to } };
  if (branch_ID && branch_ID !== "all") filter.branch_ID = branch_ID;

  const earnings = await StaffEarning.find(filter).lean();
  const users = await User.find({}).lean();
  const procs = await MedicalProcedure.find({}).lean();
  const userMap = Object.fromEntries(users.map((u) => [u.user_ID, u]));
  const procMap = Object.fromEntries(procs.map((p) => [p.medical_procedure_ID, p]));

  const byUser = {};
  for (const e of earnings) {
    const u = (byUser[e.user_ID] = byUser[e.user_ID] || {
      user_ID: e.user_ID,
      name: userMap[e.user_ID]?.full_name || e.user_ID,
      role: e.role,
      cases: 0,          // จำนวนหัตถการที่ทำ (procedure_fee)
      commissions: 0,    // จำนวนรายการคอม
      total: 0,
      procedures: {},    // นับตามชนิดหัตถการ
    });
    u.total += e.amount;
    if (e.type === "procedure_fee") {
      u.cases += 1;
      const pname = procMap[e.medical_procedure_ID]?.name || e.medical_procedure_ID || "อื่นๆ";
      u.procedures[pname] = (u.procedures[pname] || 0) + 1;
    } else {
      u.commissions += 1;
    }
  }

  const rows = Object.values(byUser)
    .map((u) => ({ ...u, procedures: Object.entries(u.procedures).map(([name, count]) => ({ name, count })) }))
    .sort((a, b) => b.cases - a.cases);

  return {
    range: { from, to },
    total_cases: rows.reduce((s, r) => s + r.cases, 0),
    rows,
  };
});
