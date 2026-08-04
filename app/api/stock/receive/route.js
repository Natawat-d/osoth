import ApBill from "@/models/ApBill";
import { apiHandler, requireRole } from "@/lib/api";
import { receiveStock } from "@/services/stock";
import { emitEvent } from "@/lib/realtime";
import { postFromStockLot, ensureCoA } from "@/services/gl";
import { genId, localDate } from "@/services/ids";

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
  // มี supplier = ซื้อเชื่อ → เปิดบิลเจ้าหนี้รอจ่ายให้ตรงกับ GL (JE Cr 2000 จาก lot แล้ว — บิลผูก lot_ID กัน rebuild ตั้งหนี้ซ้ำ)
  const total = (result.lot.cost_price_per_unit || 0) * (result.lot.quantity_received || 0);
  if (body.supplier && total > 0) {
    await ApBill.create({
      bill_ID: await genId("AP", 5),
      supplier_ID: null,
      supplier_name: body.supplier,
      lot_ID: result.lot.lot_ID,
      description: `รับของเข้า lot ${result.lot.lot_ID} (${body.product_ID})`,
      amount: total,
      bill_date: localDate(),
      expense_account: "1200",
      created_by: auth.user_ID,
    });
  }
  emitEvent("stock:changed", { product_ID: body.product_ID }); // realtime → หน้า stock/inventory refresh
  return result;
});
