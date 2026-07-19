import CommissionSetting from "@/models/CommissionSetting";
import { apiHandler, requireRole, getAuth } from "@/lib/api";

// GET ?branch_ID= — ตั้งค่าคอมของสาขา (คืน default ถ้ายังไม่มี)
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID") || getAuth(req).branch_ID;
  const s = await CommissionSetting.findOne({ branch_ID }).lean();
  return s || { branch_ID, tier_mode: "whole", sale_tiers: [], addon_rates: [] };
});

// PUT — upsert ตั้งค่าคอมของสาขา (admin/owner)
export const PUT = apiHandler(async (req) => {
  const auth = requireRole(req, ["crud"]);
  const body = await req.json();
  const branch_ID = body.branch_ID || auth.branch_ID;
  if (!branch_ID) throw Object.assign(new Error("ต้องระบุสาขา"), { status: 400 });
  const doc = await CommissionSetting.findOneAndUpdate(
    { branch_ID },
    {
      $set: {
        tier_mode: body.tier_mode === "marginal" ? "marginal" : "whole",
        sale_tiers: (body.sale_tiers || []).map((t) => ({ min_sales: Number(t.min_sales) || 0, percent: Number(t.percent) || 0 })),
        addon_rates: (body.addon_rates || []).map((r) => ({
          product_ID: r.product_ID,
          sale_type: r.sale_type === "percent" ? "percent" : "baht",
          sale_value: Number(r.sale_value) || 0,
          doctor_type: r.doctor_type === "percent" ? "percent" : "baht",
          doctor_value: Number(r.doctor_value) || 0,
        })),
      },
    },
    { new: true, upsert: true }
  );
  return doc;
});
