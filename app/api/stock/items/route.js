import InventoryItem from "@/models/InventoryItem";
import { apiHandler } from "@/lib/api";

// GET /api/stock/items?branch_ID=..&product_ID=..&state=..
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  if (sp.get("product_ID")) filter.product_ID = sp.get("product_ID");
  if (sp.get("state")) filter.state = sp.get("state");
  return InventoryItem.find(filter).sort({ created_at: 1 }).lean();
});
