import PurchaseOrder from "@/models/PurchaseOrder";
import ApBill from "@/models/ApBill";
import { apiHandler, requireRole } from "@/lib/api";
import { receiveStock } from "@/services/stock";
import { genId, localDate } from "@/services/ids";
import { postFromStockLot, ensureCoA } from "@/services/gl";
import { emitEvent } from "@/lib/realtime";

// POST /api/purchase-orders/[id]/receive — รับของเข้าตาม PO → สร้าง lot + inventory ทุกรายการ
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["stock"]);
  const { id } = await params;
  const po = await PurchaseOrder.findOne({ po_ID: id });
  if (!po) throw Object.assign(new Error("ไม่พบใบสั่งซื้อ"), { status: 404 });
  if (po.status === "received") throw Object.assign(new Error("PO นี้รับของแล้ว"), { status: 409 });

  const results = [];
  for (const it of po.items) {
    const r = await receiveStock({
      branch_ID: po.branch_ID,
      product_ID: it.product_ID,
      supplier: po.supplier,
      cost_price_per_unit: it.cost_price_per_unit,
      quantity_received: it.qty,
      received_by: auth.user_ID,
    });
    results.push({ product_ID: it.product_ID, lot_ID: r.lot.lot_ID, items: r.items_created });
  }
  po.status = "received";
  po.received_at = new Date();
  await po.save();

  // ── V2 บัญชี: ลง JE รับของเข้า (Dr คลัง / Cr AP) + เปิดบิลเจ้าหนี้รอจ่าย ──
  await ensureCoA();
  const total = po.items.reduce((s, it) => s + (it.qty || 0) * (it.cost_price_per_unit || 0), 0);
  if (total > 0) {
    await ApBill.create({
      bill_ID: await genId("AP", 5),
      supplier_ID: null,
      supplier_name: po.supplier || "-",
      po_ID: po.po_ID,
      description: `รับของตามใบสั่งซื้อ ${po.po_ID}`,
      amount: total,
      bill_date: localDate(),
      expense_account: "1200",
      created_by: auth.user_ID,
      // หมายเหตุ: JE ตั้งหนี้ถูก post จาก lot (stock_receive) แล้ว — บิลนี้ไว้ตามจ่าย (pay → Dr AP / Cr เงิน)
    });
  }
  emitEvent("stock:changed", {});
  return { po_ID: po.po_ID, received: results, ap_total: total };
});
