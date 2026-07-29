import { apiHandler, requireRole } from "@/lib/api";
import { receiveStock } from "@/services/stock";
import { emitEvent } from "@/lib/realtime";
import { postFromStockLot, ensureCoA } from "@/services/gl";

// POST — รับของเข้า: สร้าง lot + gen inventory_item รายชิ้น
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["stock"]);
  const body = await req.json();
  const result = await receiveStock({
    ...body,
    branch_ID: body.branch_ID || auth.branch_ID,
    received_by: auth.user_ID,
  });
  await ensureCoA();
  await postFromStockLot(result.lot); // ลงบัญชี: Dr คลัง / Cr AP (มี supplier) หรือเงินสด
  emitEvent("stock:changed", { product_ID: body.product_ID }); // realtime → หน้า stock/inventory refresh
  return result;
});
