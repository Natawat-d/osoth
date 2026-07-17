import { apiHandler, requireRole } from "@/lib/api";
import { addAddOn } from "@/services/sales";

// POST /api/opd/[id]/addon — { product_ID, qty, method } เก็บเงินทันที แยกบิล
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const body = await req.json();
  return addAddOn({
    opd_ID: id,
    product_ID: body.product_ID,
    qty: body.qty || 1,
    method: body.method || "cash",
    received_by: auth.user_ID,
  });
});
