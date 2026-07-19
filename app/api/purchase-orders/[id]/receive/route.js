import PurchaseOrder from "@/models/PurchaseOrder";
import { apiHandler, requireRole } from "@/lib/api";
import { receiveStock } from "@/services/stock";

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
  return { po_ID: po.po_ID, received: results };
});
