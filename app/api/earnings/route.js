import StaffEarning from "@/models/StaffEarning";
import { apiHandler, getAuth, requireRole } from "@/lib/api";

// GET /api/earnings?user_ID=..&from=..&to=..
// หมอ/BT/sale เห็นเฉพาะของตัวเอง — admin/super_admin เห็นทุกคน
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.role)
    throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้"), { status: 401 });
  const sp = new URL(req.url).searchParams;
  const isManager = ["super_admin", "admin"].includes(auth.role);
  const user_ID = isManager
    ? sp.get("user_ID") || auth.user_ID
    : auth.user_ID; // บังคับดูได้แค่ตัวเอง

  const filter = { user_ID };
  if (sp.get("from") || sp.get("to")) {
    filter.date = {};
    if (sp.get("from")) filter.date.$gte = sp.get("from");
    if (sp.get("to")) filter.date.$lte = sp.get("to");
  }
  const rows = await StaffEarning.find(filter).sort({ date: -1 }).lean();
  return {
    user_ID,
    total: rows.reduce((s, r) => s + r.amount, 0),
    cases: rows.length,
    rows,
  };
});
