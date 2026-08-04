import Company from "@/models/Company";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";

// GET — วันที่ล็อกงวดปัจจุบัน
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const co = await Company.findOne({}).lean();
  return { locked_through: co?.gl_locked_through || "" };
});

// PUT { locked_through: "YYYY-MM-DD" | "" } — ตั้ง/ปลดล็อกงวดบัญชี (owner)
// เอกสารเงินที่ลงวันที่ <= วันนี้จะบันทึกใหม่ไม่ได้ — ต้องกลับรายการในงวดปัจจุบันแทน
export const PUT = apiHandler(async (req) => {
  requireOwner(req);
  const { locked_through } = await req.json();
  if (locked_through !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(locked_through || ""))
    throw Object.assign(new Error("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD หรือค่าว่าง)"), { status: 400 });
  const co = await Company.findOneAndUpdate({}, { $set: { gl_locked_through: locked_through } }, { new: true });
  if (!co) throw Object.assign(new Error("ยังไม่ได้ตั้งค่าบริษัท"), { status: 404 });
  return { locked_through: co.gl_locked_through };
});
