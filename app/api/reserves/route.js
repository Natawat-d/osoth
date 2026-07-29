import Reserve from "@/models/Reserve";
import { apiHandler, requireRole } from "@/lib/api";
import { findOverlap, toUnix } from "@/services/overlap";
import { genId } from "@/services/ids";
import { notifyBooking } from "@/services/notify";
import { emitEvent } from "@/lib/realtime";

// GET /api/reserves?branch_ID=..&date=YYYY-MM-DD
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("date")) filter.date = sp.get("date");
  else if (sp.get("from") || sp.get("to")) {
    filter.date = {};
    if (sp.get("from")) filter.date.$gte = sp.get("from");
    if (sp.get("to")) filter.date.$lte = sp.get("to");
  }
  if (sp.get("status")) filter.status = sp.get("status");
  if (sp.get("HN")) filter.HN_number = sp.get("HN");
  return Reserve.find(filter).sort({ unix_start: 1 }).lean();
});

// POST — สร้างการจอง (walk-in ได้) + เช็คซ้อนก่อนเสมอ
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["booking", "queue"]);
  const body = await req.json();
  const branch_ID = body.branch_ID || auth.branch_ID;
  const unix_start = toUnix(body.date, body.time_start);
  const unix_end = toUnix(body.date, body.time_end);
  if (!(unix_start < unix_end))
    throw Object.assign(new Error("เวลาเริ่มต้องน้อยกว่าเวลาจบ"), { status: 400 });

  const clash = await findOverlap({
    branch_ID,
    date: body.date,
    room_ID: body.room_ID,
    doctor_ID: body.doctor_ID || null,
    unix_start,
    unix_end,
  });
  if (clash)
    throw Object.assign(
      new Error(
        clash.reason === "room_overlap"
          ? `ห้องนี้ถูกจองซ้อนกับคิว ${clash.reserve_ID}`
          : `หมอติดคิว ${clash.reserve_ID} ในช่วงเวลานี้`
      ),
      { status: 409 }
    );

  const now = new Date();
  // ไม่มีมัดจำ — จองไม่ต้องจ่าย (ค่าคอร์สจ่ายเต็มจำนวนก่อนทำหัตถการที่ OPD)
  const reserve = await Reserve.create({
    ...body,
    branch_ID,
    deposit: 0,
    reserve_ID: await genId("RS", 6),
    unix_start,
    unix_end,
    status: "booked",
    status_history: [{ status: "booked", at: now, by: auth.user_ID }],
    created_by: auth.user_ID,
  });

  // แจ้งเตือนจอง (GAP-02: LINE) — ผ่าน adapter (stub จนกว่าจะต่อ LINE จริง)
  notifyBooking(reserve).catch(() => {});
  emitEvent("reserve:changed", { reserve_ID: reserve.reserve_ID, date: reserve.date }); // realtime → ปฏิทินทุกจอ refresh
  return reserve;
});
