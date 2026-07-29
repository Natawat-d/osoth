import User from "@/models/User";
import Company from "@/models/Company";
import { apiHandler } from "@/lib/api";

// GET /api/setup/state → บอกสถานะ first-run
//   needs_owner: ยังไม่มี super_admin → ต้องไปหน้า /register (สมัคร owner คนแรก)
//   has_company: มีข้อมูลบริษัทแล้วหรือยัง
// ใช้ตัดสินใจ redirect หน้าแรก (root → register หรือ about_me/login)
export const GET = apiHandler(async () => {
  const ownerCount = await User.countDocuments({ role: "super_admin" });
  const company = await Company.findOne({});
  return {
    needs_owner: ownerCount === 0,
    has_company: !!company,
    company: company
      ? { name: company.name, address: company.address, phone: company.phone, brand: company.brand }
      : null,
  };
});
