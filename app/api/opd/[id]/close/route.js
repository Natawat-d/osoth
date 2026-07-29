import { apiHandler, requireRole } from "@/lib/api";
import { closeCase } from "@/services/closeCase";
import { emitEvent } from "@/lib/realtime";

// POST /api/opd/[id]/close — ปิดเคส (admin/acception/super_admin เท่านั้น)
// trigger เดียว: ตัด stock FIFO + นับครั้ง course + ค่ามือ + reserve done
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["close_case"]);
  const { id } = await params;
  const result = await closeCase({ opd_ID: id, closed_by: auth.user_ID });
  emitEvent("opd:stage", { opd_ID: id, status: "closed" }); // realtime → OPD/ปฏิทิน refresh
  emitEvent("stock:changed", {});
  return result;
});
