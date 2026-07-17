import StockLot from "@/models/StockLot";
import InventoryItem from "@/models/InventoryItem";
import Product from "@/models/Product";
import { genId } from "./ids";

// รับของเข้า: สร้าง lot 1 doc + สร้าง inventory_item ตามจำนวน unit ที่รับ
export async function receiveStock({
  branch_ID,
  product_ID,
  lot_number = "",
  supplier = "",
  cost_price_per_unit,
  quantity_received,
  expiry_date = "",
  received_by = "",
}) {
  const product = await Product.findOne({ product_ID }).lean();
  if (!product) throw Object.assign(new Error("ไม่พบสินค้า"), { status: 404 });
  if (quantity_received < 1)
    throw Object.assign(new Error("จำนวนรับเข้าต้องอย่างน้อย 1"), { status: 400 });

  const lot = await StockLot.create({
    lot_ID: await genId("LOT", 5),
    branch_ID,
    product_ID,
    lot_number,
    supplier,
    cost_price_per_unit,
    quantity_received,
    expiry_date,
    received_at: new Date().toISOString().slice(0, 10),
    received_by,
  });

  const items = [];
  for (let i = 0; i < quantity_received; i++) {
    items.push({
      item_ID: await genId("IV", 6),
      branch_ID,
      product_ID,
      lot_ID: lot.lot_ID,
      state: "unused",
      uses_remaining: product.default_uses_per_unit || 1,
      cc_remaining: product.sub_unit_size || 1,
    });
  }
  await InventoryItem.insertMany(items);
  return { lot, items_created: items.length };
}

// สรุป stock ต่อสินค้า + คำเตือน (ใกล้หมดอายุ / เกินกำหนดหลังเปิด / ต่ำกว่า reorder)
export async function stockSummary({ branch_ID }) {
  const products = await Product.find({ active: true }).lean();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000); // เตือน expiry ภายใน 30 วัน
  const result = [];
  for (const p of products) {
    const items = await InventoryItem.find({
      branch_ID,
      product_ID: p.product_ID,
      state: { $in: ["unused", "in_use"] },
    }).lean();
    const lots = await StockLot.find({
      branch_ID,
      product_ID: p.product_ID,
    }).lean();
    const lotMap = Object.fromEntries(lots.map((l) => [l.lot_ID, l]));

    const warnings = [];
    for (const it of items) {
      const lot = lotMap[it.lot_ID];
      if (lot?.expiry_date && new Date(lot.expiry_date) <= soon)
        warnings.push({
          type: "lot_expiry",
          item_ID: it.item_ID,
          lot_ID: it.lot_ID,
          expiry_date: lot.expiry_date,
        });
      if (it.open_expiry_at && new Date(it.open_expiry_at) <= now)
        warnings.push({
          type: "open_expired", // เตือนอย่างเดียว ไม่บังคับทิ้ง
          item_ID: it.item_ID,
          open_expiry_at: it.open_expiry_at,
        });
    }
    const unusedCount = items.filter((i) => i.state === "unused").length;
    const inUseCount = items.filter((i) => i.state === "in_use").length;
    if (p.reorder_point && unusedCount + inUseCount < p.reorder_point)
      warnings.push({ type: "low_stock", available: unusedCount + inUseCount });

    result.push({
      product: p,
      unused: unusedCount,
      in_use: inUseCount,
      total_cc_remaining: items.reduce((s, i) => s + i.cc_remaining, 0),
      total_uses_remaining: items.reduce((s, i) => s + i.uses_remaining, 0),
      warnings,
    });
  }
  return result;
}
