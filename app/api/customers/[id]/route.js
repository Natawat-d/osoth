import Customer from "@/models/Customer";
import CustomerCourse from "@/models/CustomerCourse";
import Opd from "@/models/Opd";
import { apiHandler, requireRole } from "@/lib/api";

// GET /api/customers/[HN] — โปรไฟล์ + course ค้าง + ประวัติหัตถการ
export const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const customer = await Customer.findOne({ HN_number: id }).lean();
  if (!customer) throw Object.assign(new Error("ไม่พบลูกค้า"), { status: 404 });
  const courses = await CustomerCourse.find({ HN_number: id })
    .sort({ purchased_at: -1 })
    .lean();
  const history = await Opd.find({ HN_number: id })
    .sort({ date: -1 })
    .limit(100)
    .lean();
  return { customer, courses, history };
});

export const PUT = apiHandler(async (req, { params }) => {
  requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const body = await req.json();
  delete body.HN_number;
  delete body._id;
  const doc = await Customer.findOneAndUpdate(
    { HN_number: id },
    { $set: body },
    { new: true }
  );
  if (!doc) throw Object.assign(new Error("ไม่พบลูกค้า"), { status: 404 });
  return doc;
});
