import Opd from "@/models/Opd";
import { apiHandler, requireRole } from "@/lib/api";
import { emitEvent } from "@/lib/realtime";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// POST /api/opd/[id]/consent — แนบใบยินยอม (ทุกเคส แม้คอร์สเดิม)
// body: { kind: "upload"|"signature", file: dataURL, filename?, mime?, note? }
// ปิดเคสไม่ได้ถ้าไม่มี consent (เช็คใน services/closeCase)
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue", "record_procedure"]);
  const { id } = await params;
  const body = await req.json();

  const { kind, file, filename = "", mime = "", note = "" } = body;
  if (!["upload", "signature"].includes(kind))
    throw Object.assign(new Error("kind ต้องเป็น upload หรือ signature"), { status: 400 });
  if (!file?.startsWith("data:"))
    throw Object.assign(new Error("ไฟล์ต้องเป็น data URL"), { status: 400 });
  // ขนาดจริงโดยประมาณจาก base64 (3/4 ของความยาว payload)
  const b64 = file.slice(file.indexOf(",") + 1);
  const size = Math.floor((b64.length * 3) / 4);
  if (size > MAX_BYTES)
    throw Object.assign(new Error("ไฟล์ใหญ่เกิน 5MB"), { status: 400 });

  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw Object.assign(new Error("ไม่พบเคส"), { status: 404 });
  if (opd.status === "closed")
    throw Object.assign(new Error("เคสปิดแล้ว แนบเพิ่มไม่ได้"), { status: 409 });

  opd.consents.push({
    kind, file, filename, mime: mime || (file.slice(5, file.indexOf(";")) || ""),
    size, note, uploaded_by: auth.user_ID, uploaded_at: new Date(),
  });
  await opd.save();
  emitEvent("opd:stage", { opd_ID: opd.opd_ID, status: opd.status }); // ให้จออื่น refresh
  return { opd_ID: opd.opd_ID, consents: opd.consents.length };
});

// DELETE /api/opd/[id]/consent?index=0 — ลบใบที่แนบผิด (ก่อนปิดเคส)
export const DELETE = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const idx = Number(new URL(req.url).searchParams.get("index"));
  const opd = await Opd.findOne({ opd_ID: id });
  if (!opd) throw Object.assign(new Error("ไม่พบเคส"), { status: 404 });
  if (opd.status === "closed")
    throw Object.assign(new Error("เคสปิดแล้ว แก้ไขไม่ได้"), { status: 409 });
  if (Number.isNaN(idx) || idx < 0 || idx >= opd.consents.length)
    throw Object.assign(new Error("index ไม่ถูกต้อง"), { status: 400 });
  opd.consents.splice(idx, 1);
  await opd.save();
  return { opd_ID: opd.opd_ID, consents: opd.consents.length };
});
