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

// POST — ขาย/ผูก course (สร้าง customer_course) — จ่ายได้ "เต็มจำนวน" หรือ "ยังไม่จ่าย" เท่านั้น
// ไม่มีผ่อน (จ่ายบางส่วนไม่ได้) · ปกติจองไม่ต้องจ่าย → ไปจ่ายเต็มที่ OPD · ผ่อนเป็นเรื่องของบัตร/EDC
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["sell_course", "booking"]);
  const body = await req.json();
  // ราคาปรับหน้างาน = อำนาจ admin/owner เท่านั้น (sale ขายตามราคา catalog/โปร)
  if (body.price_override != null && body.price_override !== "" &&
      !["super_admin", "admin"].includes(auth.role))
    throw Object.assign(new Error("ปรับราคาหน้างานได้เฉพาะ admin/เจ้าของ"), { status: 403 });
  return purchaseCourse({
    ...body,
    branch_ID: auth.branch_ID, // ล็อกสาขาตามผู้ใช้ — ไม่รับจาก body (owner สลับผ่าน x-branch-id)
    sale_ID: body.sale_ID || auth.user_ID,
    received_by: auth.user_ID,
  });
});
