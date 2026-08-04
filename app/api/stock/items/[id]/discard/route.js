import InventoryItem from "@/models/InventoryItem";
import StockLot from "@/models/StockLot";
import Product from "@/models/Product";
import { apiHandler, requireRole } from "@/lib/api";
import { postFromDiscard, ensureCoA } from "@/services/gl";

// POST — ทิ้งขวด (เช่น เกินกำหนดหลังเปิด) — บันทึกเป็นสูญเสีย
// ลงบัญชีมูลค่าที่เหลือของขวด: Dr สูญเสีย(6300) / Cr คลัง(1200) — GL คลังตรงกับของจริง
export const POST = apiHandler(async (req, { params }) => {
  requireRole(req, ["stock"]);
  const { id } = await params;
  const item = await InventoryItem.findOneAndUpdate(
    { item_ID: id, state: { $ne: "discarded" } },
    { $set: { state: "discarded" } },
    { new: false } // เอาค่าก่อนทิ้ง — ใช้ cc_remaining เดิมคิดมูลค่าสูญเสีย
  );
  if (!item) throw Object.assign(new Error("ไม่พบขวด หรือทิ้งไปแล้ว"), { status: 404 });
  await ensureCoA();
  const [lot, product] = await Promise.all([
    StockLot.findOne({ lot_ID: item.lot_ID }).lean(),
    Product.findOne({ product_ID: item.product_ID }).lean(),
  ]);
  await postFromDiscard({ item, lot, product });
  return { ...item.toObject(), state: "discarded" };
});
