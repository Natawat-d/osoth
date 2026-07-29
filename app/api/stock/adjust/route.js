import InventoryItem from "@/models/InventoryItem";
import StockLot from "@/models/StockLot";
import { apiHandler, requireRole } from "@/lib/api";
import { genId, localDate } from "@/services/ids";
import { postStockAdjust, ensureCoA } from "@/services/gl";
import { emitEvent } from "@/lib/realtime";

// POST /api/stock/adjust — นับสต๊อกแล้วปรับยอด
// { product_ID, counted, note } — counted = จำนวน unit (unused+in_use) ที่นับได้จริง
//   นับได้ < ระบบ → ตัดชิ้นส่วนเกิน (state: discarded) + ลงบัญชี Dr ค่าใช้จ่าย / Cr คลัง
//   นับได้ > ระบบ → แจ้งให้ "รับเข้า" เพิ่มแทน (ต้องรู้ทุน/lot — ไม่เดาเอง)
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["stock"]);
  await ensureCoA();
  const body = await req.json();
  const { product_ID, counted, note = "" } = body;
  if (!product_ID || counted == null || counted < 0)
    throw Object.assign(new Error("ต้องระบุ product_ID และจำนวนที่นับได้"), { status: 400 });

  const items = await InventoryItem.find({
    product_ID,
    state: { $in: ["unused", "in_use"] },
  }).sort({ created_at: 1 }).lean();
  const system = items.length;
  const diff = system - counted;

  if (diff === 0) return { product_ID, system, counted, adjusted: 0, message: "ยอดตรง ไม่ต้องปรับ" };
  if (diff < 0)
    throw Object.assign(
      new Error(`นับได้มากกว่าระบบ ${-diff} ชิ้น — ใช้เมนู "รับเข้า" เพิ่มของพร้อมระบุทุน/lot`),
      { status: 400 }
    );

  // ตัดของขาด: เลือกตัดจาก unused ก่อน (FIFO เก่าสุด) แล้วค่อย in_use
  const toCut = [...items.filter((i) => i.state === "unused"), ...items.filter((i) => i.state === "in_use")].slice(0, diff);
  const lotIds = [...new Set(toCut.map((i) => i.lot_ID))];
  const lots = await StockLot.find({ lot_ID: { $in: lotIds } }).lean();
  const lotCost = Object.fromEntries(lots.map((l) => [l.lot_ID, l.cost_price_per_unit || 0]));

  // มูลค่าที่ตัด = ทุนตามสัดส่วนที่เหลือของแต่ละชิ้น
  let value = 0;
  for (const it of toCut) {
    const full = lotCost[it.lot_ID] || 0;
    const lot = lots.find((l) => l.lot_ID === it.lot_ID);
    const perCc = lot && it.cc_remaining ? full / (lot.quantity_received ? (it.cc_remaining || 1) : 1) : 0;
    // ประเมินแบบสัดส่วน cc ถ้ามี ไม่งั้นทุนเต็ม unit
    value += it.state === "unused" ? full : (perCc ? Math.min(full, perCc * it.cc_remaining) : full);
  }
  value = Math.round(value * 100) / 100;

  const adjust_ID = await genId("ADJ", 5);
  await InventoryItem.updateMany(
    { item_ID: { $in: toCut.map((i) => i.item_ID) } },
    { $set: { state: "discarded" } }
  );
  await postStockAdjust({ adjust_ID, date: localDate(), value, note: `${note} (นับได้ ${counted}/${system} · ตัด ${diff} ชิ้น · โดย ${auth.user_ID})` });
  emitEvent("stock:changed", { product_ID });

  return { product_ID, system, counted, adjusted: diff, value, adjust_ID };
});
