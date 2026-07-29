import Supplier from "@/models/Supplier";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { genId } from "@/services/ids";

// GET /api/suppliers — เจ้าหนี้/ผู้ขายทั้งหมด
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  return Supplier.find({}).sort({ name: 1 }).lean();
});

// POST — เพิ่ม/แก้ (มี supplier_ID = แก้)
export const POST = apiHandler(async (req) => {
  requireOwner(req);
  const body = await req.json();
  if (!body.name?.trim()) throw Object.assign(new Error("ต้องมีชื่อผู้ขาย"), { status: 400 });
  if (body.supplier_ID) {
    const doc = await Supplier.findOneAndUpdate(
      { supplier_ID: body.supplier_ID },
      { $set: { name: body.name, tax_id: body.tax_id || "", phone: body.phone || "", address: body.address || "", credit_days: body.credit_days ?? 30, active: body.active !== false } },
      { new: true }
    );
    if (!doc) throw Object.assign(new Error("ไม่พบผู้ขาย"), { status: 404 });
    return doc;
  }
  return Supplier.create({
    supplier_ID: await genId("SP", 4),
    name: body.name.trim(),
    tax_id: body.tax_id || "",
    phone: body.phone || "",
    address: body.address || "",
    credit_days: body.credit_days ?? 30,
  });
});
