import Opd from "@/models/Opd";
import Reserve from "@/models/Reserve";
import { apiHandler, requireRole, getAuth } from "@/lib/api";

export const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const opd = await Opd.findOne({ opd_ID: id }).lean();
  if (!opd) throw Object.assign(new Error("ไม่พบเคส"), { status: 404 });
  return opd;
});

// PUT — อัปเดตระหว่างเคส:
// { opd_data }            → บันทึกวัดตัว (acception) สถานะ → measuring
// { BT_ID / doctor_ID }   → มอบหมายคนทำ
// { procedures_done }     → บันทึกสิ่งที่ทำ (หมอ/BT)
// { status }              → เดินขั้น open→measuring→bt_stage→doctor_stage (closed ต้องผ่าน /close)
export const PUT = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue", "record_procedure"]);
  const { id } = await params;
  const body = await req.json();
  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw Object.assign(new Error("ไม่พบเคส"), { status: 404 });
  if (opd.status === "closed")
    throw Object.assign(new Error("เคสปิดแล้ว แก้ไขไม่ได้"), { status: 409 });

  if (body.opd_data) {
    opd.opd_data = {
      ...opd.opd_data.toObject?.() ?? opd.opd_data,
      ...body.opd_data,
      measured_by: auth.user_ID,
      measured_at: new Date(),
    };
    if (opd.status === "open") opd.status = "measuring";
  }
  if (body.BT_ID !== undefined) opd.BT_ID = body.BT_ID;
  if (body.doctor_ID !== undefined) opd.doctor_ID = body.doctor_ID;
  if (body.sale_ID !== undefined) opd.sale_ID = body.sale_ID; // sale ดูแลเคส (คิดคอม)
  if (body.procedures_done) opd.procedures_done = body.procedures_done;
  if (body.status) {
    const order = ["open", "measuring", "bt_stage", "doctor_stage"];
    if (!order.includes(body.status))
      throw Object.assign(new Error("ปิดเคสต้องใช้ /close เท่านั้น"), { status: 400 });
    if (!opd.opd_data?.measured_at && body.status !== "open")
      throw Object.assign(new Error("ต้องวัดตัวก่อน (บังคับทุกครั้ง)"), { status: 400 });
    opd.status = body.status;
  }
  await opd.save();

  // ซิงก์สถานะคิว (reserve) ให้ตรงกับ stage เพื่อโชว์บนปฏิทิน (BT ทำ / หมอทำ)
  if (body.status && ["bt_stage", "doctor_stage"].includes(body.status)) {
    await Reserve.updateOne(
      { reserve_ID: opd.reserve_ID },
      {
        $set: { status: body.status },
        $push: { status_history: { status: body.status, at: new Date(), by: auth.user_ID } },
      }
    );
  }
  return opd;
});
