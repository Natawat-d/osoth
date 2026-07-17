import DoctorSchedule from "@/models/DoctorSchedule";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/schedules?branch_ID=..&doctor_ID=..&date=YYYY-MM-DD
// ถ้าส่ง date มา จะ resolve ตารางจริงของวันนั้น (weekly + override)
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("doctor_ID")) filter.doctor_ID = sp.get("doctor_ID");
  const schedules = await DoctorSchedule.find(filter).lean();

  const date = sp.get("date");
  if (!date) return schedules;

  // resolve: override รายวันชนะ weekly template
  const dow = new Date(`${date}T00:00:00`).getDay();
  return schedules
    .map((s) => {
      const override = (s.overrides || []).find((o) => o.date === date);
      if (override) {
        if (override.type === "leave") return null; // ลา = ไม่อยู่
        return {
          doctor_ID: s.doctor_ID,
          branch_ID: s.branch_ID,
          room_ID: override.room_ID,
          time_start: override.time_start,
          time_end: override.time_end,
          source: "override",
        };
      }
      const slot = (s.weekly || []).find((w) => w.day_of_week === dow);
      if (!slot) return null;
      return {
        doctor_ID: s.doctor_ID,
        branch_ID: s.branch_ID,
        room_ID: slot.room_ID,
        time_start: slot.time_start,
        time_end: slot.time_end,
        source: "weekly",
      };
    })
    .filter(Boolean);
});

// PUT — upsert ตารางของหมอ 1 คน { branch_ID, doctor_ID, weekly, overrides }
export const PUT = apiHandler(async (req) => {
  requireRole(req, ["crud"]);
  const body = await req.json();
  return DoctorSchedule.findOneAndUpdate(
    { branch_ID: body.branch_ID, doctor_ID: body.doctor_ID },
    { $set: { weekly: body.weekly || [], overrides: body.overrides || [] } },
    { new: true, upsert: true }
  );
});
