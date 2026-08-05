import CustomerCourse from "@/models/CustomerCourse";
import Customer from "@/models/Customer";
import { apiHandler, requireRole } from "@/lib/api";
import { localDate } from "@/services/ids";

const MAX_SIG = 2 * 1024 * 1024; // 2MB

// POST /api/customer-courses/[id]/health-record — บันทึกประวัติสุขภาพประจำคอร์ส (ครั้งแรกของคอร์ส)
// ตามเอกสาร "ประวัติผู้ใช้บริการ/ข้อมูลสุขภาพ": { health_info: {9 ข้อ}, signature: dataURL }
// ลูกค้าเซ็นมือบนจอ (iPad) → เก็บกับคอร์สนั้น + sync ข้อมูลสุขภาพล่าสุดเข้าโปรไฟล์ลูกค้า
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["opd", "queue"]);
  const { id } = await params;
  const { health_info = {}, signature = "" } = await req.json();

  if (!signature || !signature.startsWith("data:image"))
    throw Object.assign(new Error("ต้องให้ลูกค้าเซ็นชื่อรับรองข้อมูล (ลายเซ็นบนจอ)"), { status: 400 });
  const b64 = signature.slice(signature.indexOf(",") + 1);
  if ((b64.length * 3) / 4 > MAX_SIG)
    throw Object.assign(new Error("ลายเซ็นใหญ่เกิน 2MB"), { status: 400 });
  if (typeof health_info !== "object" || Array.isArray(health_info))
    throw Object.assign(new Error("health_info ไม่ถูกต้อง"), { status: 400 });

  const record = {
    health_info,
    signature,
    signed_at: new Date(),
    signed_by: auth.user_ID,
  };
  const cc = await CustomerCourse.findOneAndUpdate(
    { customer_course_ID: id },
    { $set: { health_record: record } },
    { new: true }
  );
  if (!cc) throw Object.assign(new Error("ไม่พบ course ของลูกค้า"), { status: 404 });

  // sync ข้อมูลสุขภาพล่าสุดเข้าโปรไฟล์ลูกค้า (แหล่งความจริงของคำเตือนแพ้ยา + เอกสารรอบหน้า)
  if (cc.HN_number) {
    const allergy = health_info.allergy?.has ? health_info.allergy.detail || "" : "";
    const chronic = health_info.chronic?.has ? health_info.chronic.detail || "" : "";
    await Customer.updateOne(
      { HN_number: cc.HN_number },
      {
        $set: {
          health_info,
          history_signature: signature,
          history_date: localDate(),
          drug_allergies: allergy ? allergy.split(",").map((s) => s.trim()).filter(Boolean) : [],
          chronic_diseases: chronic ? chronic.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      }
    );
  }
  return { customer_course_ID: id, health_record: { signed_at: record.signed_at, signed_by: record.signed_by } };
});
