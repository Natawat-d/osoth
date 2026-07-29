import PayrollRun from "@/models/PayrollRun";
import { apiHandler, getAuth } from "@/lib/api";
import { requireOwner } from "@/lib/owner";

const MAX = 3 * 1024 * 1024; // 3MB

// POST /api/payroll/slip — owner แนบสลิปโอนเงินเดือน "รายคน" (แนบได้แม้งวดจ่ายแล้ว)
// { period, user_ID, file: dataURL }  · file = "" = ลบสลิป
export const POST = apiHandler(async (req) => {
  requireOwner(req);
  const { period, user_ID, file = "" } = await req.json();
  const run = await PayrollRun.findOne({ period });
  if (!run) throw Object.assign(new Error("ยังไม่มีงวดนี้ — บันทึกงวดก่อน"), { status: 404 });
  const row = run.rows.find((r) => r.user_ID === user_ID);
  if (!row) throw Object.assign(new Error("ไม่พบพนักงานในงวดนี้"), { status: 404 });
  if (file) {
    if (!file.startsWith("data:")) throw Object.assign(new Error("ไฟล์ต้องเป็น data URL"), { status: 400 });
    const b64 = file.slice(file.indexOf(",") + 1);
    if ((b64.length * 3) / 4 > MAX) throw Object.assign(new Error("สลิปใหญ่เกิน 3MB"), { status: 400 });
  }
  row.slip = file;
  row.slip_at = file ? new Date() : null;
  await run.save();
  return { period, user_ID, has_slip: !!file };
});

// GET /api/payroll/slip?period=YYYY-MM — พนักงานดูงวดของตัวเอง (สลิปเงินเดือน + สลิปโอน)
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.user_ID) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  const period = new URL(req.url).searchParams.get("period");
  if (!/^\d{4}-\d{2}$/.test(period || ""))
    throw Object.assign(new Error("ต้องระบุ period (YYYY-MM)"), { status: 400 });
  const run = await PayrollRun.findOne({ period }).lean();
  const row = run?.rows?.find((r) => r.user_ID === auth.user_ID);
  if (!row) return { period, found: false };
  return { period, found: true, status: run.status, paid_at: run.paid_at, row };
});
