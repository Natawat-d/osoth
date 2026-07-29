import Company from "@/models/Company";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";

// GET /api/company — ข้อมูลบริษัท (Setup > Company/Brand)
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const c = await Company.findOne({ company_ID: "CO-001" }).lean();
  if (!c) throw Object.assign(new Error("ยังไม่ได้ตั้งค่าบริษัท"), { status: 404 });
  return c;
});

// PUT — แก้ข้อมูลบริษัท + แบรนด์ { name, address, tax_id, phone, email, brand:{...} }
export const PUT = apiHandler(async (req) => {
  requireOwner(req);
  const body = await req.json();
  const set = {};
  for (const k of ["name", "address", "tax_id", "phone", "email"])
    if (body[k] !== undefined) set[k] = body[k];
  if (body.brand)
    for (const k of ["display_name", "logo", "primary_color", "tagline", "about"])
      if (body.brand[k] !== undefined) set[`brand.${k}`] = body.brand[k];
  const doc = await Company.findOneAndUpdate({ company_ID: "CO-001" }, { $set: set }, { new: true });
  if (!doc) throw Object.assign(new Error("ยังไม่ได้ตั้งค่าบริษัท"), { status: 404 });
  return doc;
});
