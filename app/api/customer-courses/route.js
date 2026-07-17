import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole, getAuth } from "@/lib/api";
import { purchaseCourse } from "@/services/sales";

// GET /api/customer-courses?HN=..&phone=..&status=active — sale filter หา course ค้างของลูกค้า
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("HN")) filter.HN_number = sp.get("HN");
  if (sp.get("phone")) filter["reserve_contact.phone"] = sp.get("phone");
  if (sp.get("status")) filter.status = sp.get("status");
  if (sp.get("branch_ID")) filter.branch_ID = sp.get("branch_ID");
  return CustomerCourse.find(filter).sort({ purchased_at: -1 }).lean();
});

// POST — ขาย course (สร้าง customer_course + เงินงวดแรก + คอม sale)
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["sell_course", "booking"]);
  const body = await req.json();
  return purchaseCourse({
    ...body,
    branch_ID: body.branch_ID || auth.branch_ID,
    sale_ID: body.sale_ID || auth.user_ID,
    received_by: auth.user_ID,
  });
});
