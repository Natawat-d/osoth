import LeaveRequest from "@/models/LeaveRequest";
import SystemConfig from "@/models/SystemConfig";
import { apiHandler, getAuth } from "@/lib/api";
import { genId } from "@/services/ids";

const MANAGERS = ["super_admin", "admin"];

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.floor((b - a) / 86400000) + 1; // inclusive
}

// GET /api/leaves?branch_ID=&user_ID=&status=&type=&from=&to=
// manager เห็นทั้งสาขา, พนักงานเห็นเฉพาะของตัวเอง
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้"), { status: 401 });
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (MANAGERS.includes(auth.role)) {
    if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
    if (sp.get("user_ID")) filter.user_ID = sp.get("user_ID");
  } else {
    filter.user_ID = auth.user_ID; // พนักงาน = ของตัวเองเท่านั้น
  }
  if (sp.get("status")) filter.status = sp.get("status");
  if (sp.get("type")) filter.type = sp.get("type");
  // ทับช่วงวันที่ (สำหรับ absence รายวัน)
  if (sp.get("from") && sp.get("to")) {
    filter.date_from = { $lte: sp.get("to") };
    filter.date_to = { $gte: sp.get("from") };
  }
  return LeaveRequest.find(filter).sort({ created_at: -1 }).lean();
});

// POST /api/leaves — พนักงานยื่นคำขอลา (ของตัวเอง)
export const POST = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้"), { status: 401 });
  const body = await req.json();
  if (!body.date_from || !body.date_to)
    throw Object.assign(new Error("ต้องระบุวันที่ลา"), { status: 400 });
  const days = daysBetween(body.date_from, body.date_to);
  if (days < 1) throw Object.assign(new Error("ช่วงวันที่ไม่ถูกต้อง"), { status: 400 });

  // ลาป่วยเกินกำหนด → ต้องแนบใบรับรองแพทย์
  const config = (await SystemConfig.findOne({ branch_ID: null })) || {};
  const threshold = config.sick_cert_threshold_days ?? 2;
  if (body.type === "sick" && days > threshold && !body.medical_cert)
    throw Object.assign(
      new Error(`ลาป่วยเกิน ${threshold} วัน ต้องแนบใบรับรองแพทย์`),
      { status: 400 }
    );

  return LeaveRequest.create({
    leave_ID: await genId("LV", 5),
    branch_ID: body.branch_ID || auth.branch_ID,
    user_ID: auth.user_ID, // ยื่นให้ตัวเองเท่านั้น
    type: body.type,
    date_from: body.date_from,
    date_to: body.date_to,
    days,
    reason: body.reason || "",
    medical_cert: body.medical_cert || "",
    status: "pending",
  });
});
