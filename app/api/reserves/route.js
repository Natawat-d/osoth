import Reserve from "@/models/Reserve";
import Payment from "@/models/Payment";
import SystemConfig from "@/models/SystemConfig";
import { apiHandler, requireRole } from "@/lib/api";
import { findOverlap, toUnix } from "@/services/overlap";
import { genId } from "@/services/ids";
import { notifyBooking } from "@/services/notify";
import { emitEvent } from "@/lib/realtime";
import { issueReceipt } from "@/services/receipts";
import { ensureCoA, postFromPayment } from "@/services/gl";

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

  // ── ค่าจองคิว: เจ้าของตั้งยอดไว้ที่ Setup (0 = ไม่เก็บ) — จองล่วงหน้าต้องจ่ายก่อนถึงจองได้
  // นับเป็น "รายได้" ทันที (บัญชี 4200) ต่างจากมัดจำ (หนี้สินรอหัก/คืน) · walk-in มาถึงหน้าร้านแล้ว ไม่เก็บ
  const config = await SystemConfig.findOne({ branch_ID: null }).lean();
  const fee = Number(config?.booking_fee) || 0;
  const needFee = fee > 0 && !body.is_walk_in;
  const feeMethod = body.booking_fee_method;
  if (needFee && !["cash", "transfer", "card"].includes(feeMethod || ""))
    throw Object.assign(
      new Error(`ต้องเก็บค่าจองคิว ${fee}฿ ก่อนจอง — เลือกช่องทางรับเงิน (เงินสด/โอน/บัตร)`),
      { status: 400 }
    );

  const now = new Date();
  // ค่าคอร์สจ่ายเต็มจำนวนก่อนทำหัตถการที่ OPD (ค่าจอง/มัดจำเป็นคนละส่วน)
  const reserve = await Reserve.create({
    ...body,
    branch_ID,
    deposit: 0,
    booking_fee_paid: 0,
    reserve_ID: await genId("RS", 6),
    unix_start,
    unix_end,
    status: "booked",
    status_history: [{ status: "booked", at: now, by: auth.user_ID }],
    created_by: auth.user_ID,
  });

  // เก็บค่าจอง: Payment + ใบเสร็จ + ลงบัญชีรายได้ทันที
  let feeReceipt = null;
  if (needFee) {
    const pay = await Payment.create({
      payment_ID: await genId("PAY", 6),
      branch_ID,
      HN_number: body.HN_number || null,
      type: "booking_fee",
      ref: { customer_course_ID: null, opd_ID: null, reserve_ID: reserve.reserve_ID },
      amount: fee,
      method: feeMethod,
      paid_at: now,
      received_by: auth.user_ID,
    });
    await Reserve.updateOne(
      { reserve_ID: reserve.reserve_ID },
      { $set: { booking_fee_paid: fee, booking_fee_payment_ID: pay.payment_ID } }
    );
    await ensureCoA();
    await postFromPayment(pay);
    feeReceipt = await issueReceipt({
      branch_ID,
      HN_number: body.HN_number || null,
      customer_name: body.contact?.nick_name || "",
      items: [{ description: `ค่าจองคิว ${body.date} ${body.time_start}`, amount: fee }],
      payments: [{ payment_ID: pay.payment_ID, method: feeMethod, amount: fee }],
      ref: { reserve_ID: reserve.reserve_ID },
      issued_by: auth.user_ID,
    });
  }

  // แจ้งเตือนจอง (GAP-02: LINE) — ผ่าน adapter (stub จนกว่าจะต่อ LINE จริง)
  notifyBooking(reserve).catch(() => {});
  emitEvent("reserve:changed", { reserve_ID: reserve.reserve_ID, date: reserve.date }); // realtime → ปฏิทินทุกจอ refresh
  return {
    ...reserve.toObject(),
    booking_fee_paid: needFee ? fee : 0,
    booking_fee_payment_ID: feeReceipt?.payments?.[0]?.payment_ID || null,
    booking_fee_receipt: feeReceipt,
  };
});
