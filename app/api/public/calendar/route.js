import Branch from "@/models/Branch";
import Room from "@/models/Room";
import Reserve from "@/models/Reserve";
import DoctorSchedule from "@/models/DoctorSchedule";
import User from "@/models/User";
import Promotion from "@/models/Promotion";
import Course from "@/models/Course";
import { apiHandler } from "@/lib/api";

// GET /api/public/calendar?branch_ID=..&date=YYYY-MM-DD
// ปฏิทินหน้าร้าน (privacy) สำหรับลูกค้า — ไม่มีชื่อผู้จอง/เบอร์/ยอด
// เปิดเฉพาะสาขาที่ storefront_enabled เท่านั้น
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID");
  const date = sp.get("date");
  if (!branch_ID || !date)
    throw Object.assign(new Error("ต้องระบุ branch_ID และ date"), { status: 400 });

  // กันหลุด: สาขาต้องเปิดหน้าร้านเท่านั้น
  const branch = await Branch.findOne({ branch_ID, storefront_enabled: true, active: true }).lean();
  if (!branch) throw Object.assign(new Error("ไม่พบสาขา"), { status: 404 });

  const today = new Date().toISOString().slice(0, 10);

  const [rooms, reserves, schedules, doctors, promos, courses] = await Promise.all([
    Room.find({ branch_ID, active: true }).sort({ order: 1 }).lean(),
    Reserve.find({ branch_ID, date, status: { $nin: ["cancelled", "no_show"] } }).lean(),
    DoctorSchedule.find({ branch_ID }).lean(),
    User.find({ role: "doctor", active: true }).lean(),
    Promotion.find({ active: true }).lean(),
    Course.find({ active: true }).lean(),
  ]);

  // events แบบ privacy — เปิดเผยแค่ ช่วงเวลา/ห้อง/สถานะ ไม่มีตัวตนลูกค้า
  const events = reserves.map((r) => ({
    reserve_ID: r.reserve_ID,
    room_ID: r.room_ID,
    doctor_ID: r.doctor_ID,
    time_start: r.time_start,
    time_end: r.time_end,
    status: r.status,
  }));

  // roster: resolve override รายวันชนะ weekly
  const dow = new Date(`${date}T00:00:00`).getDay();
  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roster = schedules
    .map((s) => {
      const ov = (s.overrides || []).find((o) => o.date === date);
      let slot;
      if (ov) {
        if (ov.type === "leave") return null;
        slot = { room_ID: ov.room_ID, time_start: ov.time_start, time_end: ov.time_end };
      } else {
        slot = (s.weekly || []).find((w) => w.day_of_week === dow);
      }
      if (!slot) return null;
      const d = docById[s.doctor_ID];
      if (!d) return null;
      return {
        doctor_ID: s.doctor_ID,
        name: d.nick_name || d.full_name,
        color: d.color,
        room_ID: slot.room_ID,
        time_start: slot.time_start,
        time_end: slot.time_end,
      };
    })
    .filter(Boolean);

  const promosNow = promos
    .filter((p) => p.date_start <= today && p.date_end >= today)
    .map((p) => ({
      name: p.name,
      type: p.type,
      banner_image: p.banner_image,
      discount_value: p.discount_value,
      discount_type: p.discount_type,
      date_end: p.date_end,
    }));

  const courseCards = courses
    .filter((c) => c.image)
    .map((c) => ({ name: c.name, image: c.image, price: c.price, quantity_used: c.quantity_used }));

  return {
    branch: {
      branch_ID: branch.branch_ID,
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      line_id: branch.line_id || "",
    },
    rooms: rooms.map((r) => ({ room_ID: r.room_ID, name: r.name, order: r.order })),
    events,
    roster,
    promos: promosNow,
    courses: courseCards,
  };
});
