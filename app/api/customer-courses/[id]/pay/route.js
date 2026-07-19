import { apiHandler, requireRole } from "@/lib/api";
import { payInstallment } from "@/services/sales";

// POST /api/customer-courses/[id]/pay — รับชำระค่าคอร์ส
// รองรับก้อนเดียว { amount, method } หรือแยกช่องทาง { payments: [{ amount, method }] }
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["queue", "finance", "sell_course"]);
  const { id } = await params;
  const body = await req.json();

  const lines = Array.isArray(body.payments)
    ? body.payments.map((p) => ({ amount: Number(p.amount) || 0, method: p.method || "cash" })).filter((p) => p.amount > 0)
    : [{ amount: Number(body.amount) || 0, method: body.method || "cash" }];

  let last;
  for (const line of lines) {
    last = await payInstallment({
      customer_course_ID: id,
      amount: line.amount,
      method: line.method,
      received_by: auth.user_ID,
    });
  }
  return last;
});
