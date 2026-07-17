import { apiHandler, requireRole } from "@/lib/api";
import { receiveStock } from "@/services/stock";

// POST — รับของเข้า: สร้าง lot + gen inventory_item รายชิ้น
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["stock"]);
  const body = await req.json();
  return receiveStock({
    ...body,
    branch_ID: body.branch_ID || auth.branch_ID,
    received_by: auth.user_ID,
  });
});
