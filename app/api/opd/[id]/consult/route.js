import Opd from "@/models/Opd";
import Reserve from "@/models/Reserve";
import { apiHandler, requireRole } from "@/lib/api";

const err = (status, message) => Object.assign(new Error(message), { status });

// POST /api/opd/[id]/consult — ปรึกษาหมอก่อนซื้อคอร์ส (เฉพาะครั้งแรก ยังไม่มีคอร์ส)
// body: { action: "start" | "ok" | "no_sale", doctor_ID? }
//  start   → เข้าสถานะ "ปรึกษาหมอ" (consulting)
//  ok      → ลูกค้าตกลงซื้อ → กลับมาขายคอร์ส/ชำระ/ทำหัตถการ
//  no_sale → ลูกค้าไม่ซื้อ → ปิดเคสเป็น "ปรึกษา-ไม่ซื้อ" (ไม่ตัด stock ไม่มีค่ามือ)
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue", "record_procedure"]);
  const { id } = await params;
  const { action, doctor_ID } = await req.json();
  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw err(404, "ไม่พบเคส");
  if (opd.status === "closed") throw err(409, "เคสปิดแล้ว");

  const now = new Date();
  const syncReserve = (status) =>
    Reserve.updateOne(
      { reserve_ID: opd.reserve_ID },
      { $set: { status }, $push: { status_history: { status, at: now, by: auth.user_ID } } }
    );

  if (action === "start") {
    opd.status = "consulting";
    if (doctor_ID) { opd.consult_doctor_ID = doctor_ID; opd.doctor_ID = doctor_ID; }
    await opd.save();
    await syncReserve("consulting");
  } else if (action === "ok") {
    opd.consulted = true;
    opd.status = "open";
    await opd.save();
    await syncReserve("ready");
  } else if (action === "no_sale") {
    opd.status = "closed";
    opd.outcome = "consult_no_sale";
    opd.closed_by = auth.user_ID;
    opd.closed_at = now;
    await opd.save();
    await syncReserve("consult_no_sale");
  } else {
    throw err(400, "action ไม่ถูกต้อง");
  }
  return opd;
});
