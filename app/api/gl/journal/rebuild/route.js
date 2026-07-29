import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { rebuildJournal } from "@/services/gl";

// POST /api/gl/journal/rebuild — สแกนธุรกรรมทั้งหมด post JE ที่ยังไม่เคย post (idempotent)
export const POST = apiHandler(async (req) => {
  requireOwner(req);
  return rebuildJournal();
});
