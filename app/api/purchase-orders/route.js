import PurchaseOrder from "@/models/PurchaseOrder";
import { apiHandler, requireRole } from "@/lib/api";
import { genId } from "@/services/ids";

// GET /api/purchase-orders?branch_ID=&status=
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("status")) filter.status = sp.get("status");
  return PurchaseOrder.find(filter).sort({ created_at: -1 }).lean();
});

// POST — สร้างใบสั่งซื้อ { supplier, items:[{product_ID,name,qty,cost_price_per_unit}], status }
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["stock"]);
  const body = await req.json();
  return PurchaseOrder.create({
    po_ID: await genId("PO", 5),
    branch_ID: body.branch_ID || auth.branch_ID,
    supplier: body.supplier || "",
    items: body.items || [],
    status: body.status || "ordered",
    note: body.note || "",
    created_by: auth.user_ID,
  });
});
