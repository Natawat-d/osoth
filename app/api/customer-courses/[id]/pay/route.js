import { apiHandler, requireRole } from "@/lib/api";
import { payInstallment } from "@/services/sales";

// POST /api/customer-courses/[id]/pay — จ่ายงวดผ่อน { amount, method }
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["queue", "finance", "sell_course"]);
  const { id } = await params;
  const body = await req.json();
  return payInstallment({
    customer_course_ID: id,
    amount: body.amount,
    method: body.method,
    received_by: auth.user_ID,
  });
});
