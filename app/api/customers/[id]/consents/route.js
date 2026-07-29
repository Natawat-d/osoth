import Opd from "@/models/Opd";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/customers/[id]/consents — ประวัติใบยินยอมทุกเคสของลูกค้า (id = HN)
// คืน metadata + ไฟล์ (data URL) — ใช้ในโปรไฟล์ลูกค้า เปิดดู/ดาวน์โหลดย้อนหลัง
export const GET = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const opds = await Opd.find({ HN_number: id, "consents.0": { $exists: true } })
    .sort({ date: -1 })
    .select("opd_ID date status consents")
    .lean();
  return opds.flatMap((o) =>
    o.consents.map((c, i) => ({
      opd_ID: o.opd_ID,
      date: o.date,
      case_status: o.status,
      index: i,
      kind: c.kind,
      filename: c.filename,
      mime: c.mime,
      size: c.size,
      uploaded_by: c.uploaded_by,
      uploaded_at: c.uploaded_at,
      file: c.file,
    }))
  );
});
