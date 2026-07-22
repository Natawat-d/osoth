import { apiHandler, requireRole } from "@/lib/api";
import { addAddOn } from "@/services/sales";

// POST /api/opd/[id]/addon — { product_ID?, medical_procedure_ID?, qty, method }
// ครั้งแรก = บวกเข้ายอดคอร์ส (จ่ายรวม) · ครั้งต่อไป = เก็บเงินแยกบิล · หัตถการ = ค่ามือ→BT/หมอ
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const body = await req.json();
  return addAddOn({
    opd_ID: id,
    product_ID: body.product_ID || null,
    medical_procedure_ID: body.medical_procedure_ID || null,
    qty: body.qty || 1,
    method: body.method || "cash",
    recommended_by: body.recommended_by || null,
    received_by: auth.user_ID,
  });
});
