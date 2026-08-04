import Reserve from "@/models/Reserve";
import { apiHandler, requireRole } from "@/lib/api";
import { findOverlap, toUnix } from "@/services/overlap";
import { emitEvent } from "@/lib/realtime";

const STATUS_FLOW = {
  booked: ["arrived", "ready", "cancelled", "no_show"],
  arrived: ["ready", "cancelled", "no_show"],
  ready: ["bt_stage", "doctor_stage", "cancelled"],
  bt_stage: ["doctor_stage", "done"],
  doctor_stage: ["done"],
  done: [],
  cancelled: [],
  no_show: [],
};

// PUT /api/reserves/[id] — เปลี่ยนสถานะ / เลื่อนนัด
// body: { status } หรือ { reschedule: { date, time_start, time_end, room_ID } }
export const PUT = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["booking", "queue"]);
  const { id } = await params;
  const body = await req.json();
  const rs = await Reserve.findOne({ reserve_ID: id });
  if (!rs) throw Object.assign(new Error("ไม่พบการจอง"), { status: 404 });
  const now = new Date();

  // ---- เลื่อนนัด: เก็บของเดิมไว้ + เช็คซ้อนที่ใหม่ ----
  if (body.reschedule) {
    const r = body.reschedule;
    const unix_start = toUnix(r.date, r.time_start);
    const unix_end = toUnix(r.date, r.time_end);
    const clash = await findOverlap({
      branch_ID: rs.branch_ID,
      date: r.date,
      room_ID: r.room_ID || rs.room_ID,
      doctor_ID: r.doctor_ID ?? rs.doctor_ID,
      unix_start,
      unix_end,
      exclude_reserve_ID: id,
    });
    if (clash)
      throw Object.assign(new Error(`เลื่อนไม่ได้ ซ้อนกับคิว ${clash.reserve_ID}`), {
        status: 409,
      });
    rs.reschedule_history.push({
      from_date: rs.date,
      from_time_start: rs.time_start,
      from_time_end: rs.time_end,
      from_room_ID: rs.room_ID,
      moved_at: now,
      moved_by: auth.user_ID,
    });
    rs.date = r.date;
    rs.time_start = r.time_start;
    rs.time_end = r.time_end;
    rs.unix_start = unix_start;
    rs.unix_end = unix_end;
    if (r.room_ID) rs.room_ID = r.room_ID;
    if (r.doctor_ID !== undefined) rs.doctor_ID = r.doctor_ID;
    await rs.save();
    emitEvent("reserve:changed", { reserve_ID: rs.reserve_ID, date: rs.date, kind: "reschedule" });
    return rs;
  }

  // ---- เปลี่ยนสถานะตาม flow ----
  if (body.status) {
    const allowed = STATUS_FLOW[rs.status] || [];
    if (!allowed.includes(body.status))
      throw Object.assign(
        new Error(`เปลี่ยนสถานะ ${rs.status} → ${body.status} ไม่ได้`),
        { status: 400 }
      );
    rs.status = body.status;
    rs.status_history.push({ status: body.status, at: now, by: auth.user_ID });
    // ไม่มาตามนัด + มีมัดจำค้าง → ริบมัดจำเป็นรายได้อื่น (Dr 2300 / Cr 4100)
    if (body.status === "no_show" && rs.deposit_status === "held") {
      rs.deposit_status = "forfeited";
      const { ensureCoA, postDepositForfeit } = await import("@/services/gl");
      await ensureCoA();
      await postDepositForfeit(rs);
    }
    await rs.save();
    emitEvent("reserve:changed", { reserve_ID: rs.reserve_ID, date: rs.date, status: rs.status });
    return rs;
  }

  // ---- แก้ field ทั่วไป (note, BT_ID, HN ผูกย้อนหลัง ฯลฯ) ----
  const editable = ["note", "BT_ID", "doctor_ID", "HN_number", "customer_course_ID"];
  for (const k of editable) if (body[k] !== undefined) rs[k] = body[k];
  await rs.save();
  return rs;
});

export const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const rs = await Reserve.findOne({ reserve_ID: id }).lean();
  if (!rs) throw Object.assign(new Error("ไม่พบการจอง"), { status: 404 });
  return rs;
});
