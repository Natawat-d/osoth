import DoctorSchedule from "@/models/DoctorSchedule";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/schedules?branch_ID=..&doctor_ID=..&date=YYYY-MM-DD
// ไม่ส่ง date = คืนตารางดิบ (assignments+overrides) · ส่ง date = resolve เวรจริงของวันนั้น
// V3.1: ลงเวรเป็นช่วงวันที่ (date_start–date_end) — override รายวัน (ลา/สลับห้อง) ชนะ
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("doctor_ID")) filter.doctor_ID = sp.get("doctor_ID");
  const schedules = await DoctorSchedule.find(filter).lean();

  const date = sp.get("date");
  if (!date) return schedules;

  return schedules
    .map((s) => {
      const override = (s.overrides || []).find((o) => o.date === date);
      if (override) {
        if (override.type === "leave") return null; // ลา = ไม่อยู่
        return {
          doctor_ID: s.doctor_ID, branch_ID: s.branch_ID,
          room_ID: override.room_ID, time_start: override.time_start, time_end: override.time_end,
          source: "override",
        };
      }
      // ช่วงที่ครอบวันนี้ (ถ้าซ้อนหลายช่วง ใช้ช่วงที่ลงล่าสุด = ตัวท้าย)
      const hit = [...(s.assignments || [])].reverse().find((a) => a.date_start <= date && date <= a.date_end);
      if (!hit) return null;
      return {
        doctor_ID: s.doctor_ID, branch_ID: s.branch_ID,
        room_ID: hit.room_ID, time_start: hit.time_start, time_end: hit.time_end,
        source: "assignment",
      };
    })
    .filter(Boolean);
});

// PUT — upsert ตารางของหมอ 1 คน { branch_ID, doctor_ID, assignments, overrides } (owner)
export const PUT = apiHandler(async (req) => {
  requireRole(req, ["crud"]);
  const body = await req.json();
  // ตรวจช่วงวันที่ให้ถูก (เริ่ม ≤ จบ, เวลาเริ่ม < จบ)
  for (const a of body.assignments || []) {
    if (!a.date_start || !a.date_end || a.date_start > a.date_end)
      throw Object.assign(new Error("ช่วงวันที่ไม่ถูกต้อง (วันเริ่มต้องไม่เกินวันจบ)"), { status: 400 });
    if (!a.time_start || !a.time_end || a.time_start >= a.time_end)
      throw Object.assign(new Error("เวลาเริ่มต้องน้อยกว่าเวลาจบ"), { status: 400 });
    if (!a.room_ID) throw Object.assign(new Error("เลือกห้องของแต่ละช่วงด้วย"), { status: 400 });
  }
  return DoctorSchedule.findOneAndUpdate(
    { branch_ID: body.branch_ID, doctor_ID: body.doctor_ID },
    { $set: { assignments: body.assignments || [], overrides: body.overrides || [] } },
    { new: true, upsert: true }
  );
});
