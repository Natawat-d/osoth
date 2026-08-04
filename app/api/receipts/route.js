import Receipt from "@/models/Receipt";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/receipts?date=&from=&to=&cc=&hn= — รายการใบเสร็จ (หน้างานเปิดดู/พิมพ์ให้ลูกค้าได้)
export const GET = apiHandler(async (req) => {
  requireRole(req, ["opd", "queue", "finance"]);
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("date")) {
    filter.issued_at = {
      $gte: new Date(`${sp.get("date")}T00:00:00`),
      $lte: new Date(`${sp.get("date")}T23:59:59`),
    };
  } else if (sp.get("from") || sp.get("to")) {
    filter.issued_at = {};
    if (sp.get("from")) filter.issued_at.$gte = new Date(`${sp.get("from")}T00:00:00`);
    if (sp.get("to")) filter.issued_at.$lte = new Date(`${sp.get("to")}T23:59:59`);
  }
  if (sp.get("cc")) filter["ref.customer_course_ID"] = sp.get("cc");
  if (sp.get("hn")) filter.HN_number = sp.get("hn");
  return Receipt.find(filter).sort({ issued_at: -1 }).limit(200).lean();
});
