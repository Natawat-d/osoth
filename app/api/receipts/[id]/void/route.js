import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { voidReceipt } from "@/services/receipts";

// POST /api/receipts/[id]/void { reason } — ยกเลิกใบเสร็จ (owner เท่านั้น)
// เลขที่คงอยู่ตามหลักบัญชี · เงินทุกบรรทัดในใบถูกกลับรายการ (JE reversal) + คืนยอดค้างคอร์ส
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireOwner(req);
  const { id } = await params;
  const { reason } = await req.json();
  if (!reason || !reason.trim())
    throw Object.assign(new Error("ต้องระบุเหตุผลการยกเลิก"), { status: 400 });
  return voidReceipt(id, { reason: reason.trim(), by: auth.user_ID });
});
