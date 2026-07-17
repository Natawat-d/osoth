import { apiHandler, getAuth } from "@/lib/api";
import { stockSummary } from "@/services/stock";

// GET /api/stock/summary?branch_ID=.. — สรุปต่อสินค้า + คำเตือนหมดอายุ/ใกล้หมด
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID") || getAuth(req).branch_ID;
  return stockSummary({ branch_ID });
});
