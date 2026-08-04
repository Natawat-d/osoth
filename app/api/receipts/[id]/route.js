import Receipt from "@/models/Receipt";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/receipts/[id] — ใบเดียว (หน้า print) · id = receipt_ID หรือ receipt_no
export const GET = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd", "queue", "finance"]);
  const { id } = await params;
  const doc = await Receipt.findOne({ $or: [{ receipt_ID: id }, { receipt_no: id }] }).lean();
  if (!doc) throw Object.assign(new Error("ไม่พบใบเสร็จ"), { status: 404 });
  return doc;
});
