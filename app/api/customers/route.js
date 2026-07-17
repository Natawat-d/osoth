import Customer from "@/models/Customer";
import { apiHandler, requireRole, getAuth } from "@/lib/api";
import { genHN } from "@/services/ids";

// GET /api/customers?q=ค้นชื่อ/เบอร์/HN
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q");
  const filter = { active: true };
  if (q) {
    filter.$or = [
      { HN_number: { $regex: q, $options: "i" } },
      { full_name: { $regex: q, $options: "i" } },
      { nick_name: { $regex: q, $options: "i" } },
      { phone: { $regex: q } },
    ];
  }
  return Customer.find(filter).sort({ created_at: -1 }).limit(50).lean();
});

// POST — สร้างลูกค้าใหม่ + gen HN ตาม config
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const body = await req.json();
  const branch_ID = body.branch_ID || auth.branch_ID;
  const HN_number = await genHN(branch_ID);
  return Customer.create({ ...body, branch_ID, HN_number });
});
