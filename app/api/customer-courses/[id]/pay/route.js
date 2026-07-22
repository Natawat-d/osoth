import { apiHandler, requireRole } from "@/lib/api";
import { payCourseFull } from "@/services/sales";

// POST /api/customer-courses/[id]/pay — รับชำระค่าคอร์ส "เต็มจำนวน" ครั้งเดียว (ไม่มีผ่อน)
// รองรับก้อนเดียว { amount, method } หรือแยกช่องทาง { payments: [{ amount, method }] } (รวมต้องเต็มยอดค้าง)
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["queue", "finance", "sell_course"]);
  const { id } = await params;
  const body = await req.json();
  const payments = Array.isArray(body.payments)
    ? body.payments
    : [{ amount: body.amount, method: body.method || "cash" }];
  return payCourseFull({ customer_course_ID: id, payments, received_by: auth.user_ID });
});
