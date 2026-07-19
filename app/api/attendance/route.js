import Attendance from "@/models/Attendance";
import { apiHandler, getAuth } from "@/lib/api";
import { genId, localDate } from "@/services/ids";

const MANAGERS = ["super_admin", "admin"];

// GET /api/attendance?branch_ID=&date=&user_ID=
// manager เห็นทั้งสาขา, พนักงานเห็นของตัวเอง
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้"), { status: 401 });
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (MANAGERS.includes(auth.role)) {
    if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
    if (sp.get("user_ID")) filter.user_ID = sp.get("user_ID");
  } else {
    filter.user_ID = auth.user_ID;
  }
  if (sp.get("date")) filter.date = sp.get("date");
  return Attendance.find(filter).sort({ date: -1, check_in: -1 }).lean();
});

// POST /api/attendance { action: "in" | "out" } — ลงเวลาของตัวเอง
export const POST = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.role) throw Object.assign(new Error("ยังไม่ได้เลือกผู้ใช้"), { status: 401 });
  const { action } = await req.json();
  const date = localDate();
  const now = new Date();
  let rec = await Attendance.findOne({ user_ID: auth.user_ID, date });

  if (action === "in") {
    if (rec?.check_in) throw Object.assign(new Error("ลงเวลาเข้างานไปแล้ววันนี้"), { status: 409 });
    if (!rec) {
      rec = await Attendance.create({
        att_ID: await genId("AT", 6), branch_ID: auth.branch_ID, user_ID: auth.user_ID,
        date, check_in: now,
      });
    } else {
      rec.check_in = now; await rec.save();
    }
    return rec;
  }
  if (action === "out") {
    if (!rec?.check_in) throw Object.assign(new Error("ยังไม่ได้ลงเวลาเข้างาน"), { status: 400 });
    if (rec.check_out) throw Object.assign(new Error("ลงเวลาออกงานไปแล้ว"), { status: 409 });
    rec.check_out = now; await rec.save();
    return rec;
  }
  throw Object.assign(new Error("action ไม่ถูกต้อง"), { status: 400 });
});
