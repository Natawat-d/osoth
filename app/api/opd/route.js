import Opd from "@/models/Opd";
import Reserve from "@/models/Reserve";
import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole } from "@/lib/api";
import { genId } from "@/services/ids";

// GET /api/opd?branch_ID=..&date=..&status=..
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("date")) filter.date = sp.get("date");
  if (sp.get("status")) filter.status = sp.get("status");
  if (sp.get("HN")) filter.HN_number = sp.get("HN");
  return Opd.find(filter).sort({ created_at: -1 }).lean();
});

// POST — เปิดเคสจากการจอง { reserve_ID, HN_number }
// ลูกค้าจองก่อนมี HN ได้ → จุดนี้บังคับมี HN แล้ว (สร้างที่ /api/customers ก่อน)
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const body = await req.json();
  const rs = await Reserve.findOne({ reserve_ID: body.reserve_ID });
  if (!rs) throw Object.assign(new Error("ไม่พบการจอง"), { status: 404 });
  if (rs.opd_ID)
    throw Object.assign(new Error(`คิวนี้เปิดเคสแล้ว (${rs.opd_ID})`), { status: 409 });
  const HN_number = body.HN_number || rs.HN_number;
  if (!HN_number)
    throw Object.assign(new Error("ต้องมี HN ก่อนเปิดเคส — สร้างลูกค้าใหม่ก่อน"), {
      status: 400,
    });

  const cc = await CustomerCourse.findOne({
    customer_course_ID: body.customer_course_ID || rs.customer_course_ID,
  });
  if (!cc) throw Object.assign(new Error("คิวนี้ยังไม่ผูก course"), { status: 400 });
  if (cc.status !== "active")
    throw Object.assign(new Error(`course สถานะ ${cc.status} ใช้สิทธิ์ไม่ได้`), {
      status: 409,
    });

  // ผูก HN ย้อนหลังให้ทั้ง reserve และ customer_course (กรณีจอง/ซื้อก่อนมี HN)
  if (!rs.HN_number) rs.HN_number = HN_number;
  if (!cc.HN_number) {
    cc.HN_number = HN_number;
    await cc.save();
  }

  const opd = await Opd.create({
    opd_ID: await genId("OPD", 6),
    branch_ID: rs.branch_ID,
    reserve_ID: rs.reserve_ID,
    HN_number,
    customer_course_ID: cc.customer_course_ID,
    session_no: cc.uses_total - cc.uses_remaining + 1,
    date: rs.date,
    room_ID: rs.room_ID,
    time_start: rs.time_start,
    time_end: rs.time_end,
    BT_ID: rs.BT_ID,
    doctor_ID: rs.doctor_ID,
    status: "open",
  });
  rs.opd_ID = opd.opd_ID;
  await rs.save();
  return opd;
});
