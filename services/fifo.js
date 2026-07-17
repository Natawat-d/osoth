import InventoryItem from "@/models/InventoryItem";
import StockLot from "@/models/StockLot";

// เลือกขวดตาม FIFO:
// 1. ขวดที่เปิดแล้ว (in_use) มาก่อน unused — ใช้ขวดเปิดให้หมดก่อนเปิดขวดใหม่
// 2. ในกลุ่มเดียวกัน เรียงตาม lot ที่ expiry เก่าสุด → received_at เก่าสุด
// คืนรายการ { item, lot, cc_take } ที่รวมกันครบ cc_needed — throw ถ้า stock ไม่พอ
export async function pickItemsFIFO({ branch_ID, product_ID, cc_needed }) {
  const items = await InventoryItem.find({
    branch_ID,
    product_ID,
    state: { $in: ["in_use", "unused"] },
    cc_remaining: { $gt: 0 },
  }).lean();
  if (!items.length) {
    const err = new Error(`สินค้า ${product_ID} ไม่มีใน stock`);
    err.code = "OUT_OF_STOCK";
    throw err;
  }

  const lotIds = [...new Set(items.map((i) => i.lot_ID))];
  const lots = await StockLot.find({ lot_ID: { $in: lotIds } }).lean();
  const lotMap = Object.fromEntries(lots.map((l) => [l.lot_ID, l]));

  const stateRank = { in_use: 0, unused: 1 };
  items.sort((a, b) => {
    if (stateRank[a.state] !== stateRank[b.state])
      return stateRank[a.state] - stateRank[b.state];
    const la = lotMap[a.lot_ID] || {};
    const lb = lotMap[b.lot_ID] || {};
    const ea = la.expiry_date || "9999-99-99";
    const eb = lb.expiry_date || "9999-99-99";
    if (ea !== eb) return ea < eb ? -1 : 1;
    const ra = la.received_at || "";
    const rb = lb.received_at || "";
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.item_ID < b.item_ID ? -1 : 1;
  });

  const picks = [];
  let remaining = cc_needed;
  for (const item of items) {
    if (remaining <= 0) break;
    const take = Math.min(item.cc_remaining, remaining);
    picks.push({ item, lot: lotMap[item.lot_ID], cc_take: take });
    remaining -= take;
  }
  if (remaining > 0) {
    const err = new Error(
      `stock ไม่พอ: ${product_ID} ขาดอีก ${remaining} หน่วยย่อย`
    );
    err.code = "OUT_OF_STOCK";
    throw err;
  }
  return picks;
}
