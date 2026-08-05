import CustomerCourse from "@/models/CustomerCourse";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/customer-courses/[id] — คอร์สเดี่ยว (ใช้ดูเอกสารประวัติสุขภาพประจำคอร์ส ฯลฯ)
export const GET = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd", "queue", "sell_course", "finance"]);
  const { id } = await params;
  const doc = await CustomerCourse.findOne({ customer_course_ID: id }).lean();
  if (!doc) throw Object.assign(new Error("ไม่พบ course ของลูกค้า"), { status: 404 });
  return doc;
});
