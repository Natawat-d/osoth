import Branch from "@/models/Branch";
import { apiHandler } from "@/lib/api";

// GET /api/public/storefront → สาขาที่เปิดหน้าร้าน (สาธารณะ, ไม่ต้อง login)
// คืนเฉพาะข้อมูลติดต่อสาธารณะ — ไม่มีข้อมูลลูกค้า/ยอดขาย
export const GET = apiHandler(async () => {
  const branches = await Branch.find({ storefront_enabled: true, active: true })
    .sort({ name: 1 })
    .lean();
  return branches.map((b) => ({
    branch_ID: b.branch_ID,
    name: b.name,
    address: b.address || "",
    phone: b.phone || "",
    line_id: b.line_id || "",
  }));
});
