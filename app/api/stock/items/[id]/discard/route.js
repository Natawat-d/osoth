import InventoryItem from "@/models/InventoryItem";
import { apiHandler, requireRole } from "@/lib/api";

// POST — ทิ้งขวด (เช่น เกินกำหนดหลังเปิด) — บันทึกเป็นสูญเสีย
export const POST = apiHandler(async (req, { params }) => {
  requireRole(req, ["stock"]);
  const { id } = await params;
  const item = await InventoryItem.findOneAndUpdate(
    { item_ID: id, state: { $ne: "discarded" } },
    { $set: { state: "discarded" } },
    { new: true }
  );
  if (!item) throw Object.assign(new Error("ไม่พบขวด หรือทิ้งไปแล้ว"), { status: 404 });
  return item;
});
