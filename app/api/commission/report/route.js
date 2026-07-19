import CustomerCourse from "@/models/CustomerCourse";
import StaffEarning from "@/models/StaffEarning";
import User from "@/models/User";
import Opd from "@/models/Opd";
import CommissionSetting from "@/models/CommissionSetting";
import { apiHandler, getAuth } from "@/lib/api";
import { localDate } from "@/services/ids";

// คิดคอมขั้นบันไดจากยอดขายรวม
function computeTier(total, tiers, mode) {
  const sorted = (tiers || []).slice().sort((a, b) => a.min_sales - b.min_sales);
  if (!sorted.length || total <= 0) return { percent: 0, commission: 0 };
  if (mode === "marginal") {
    let commission = 0, appliedPct = 0;
    for (let i = 0; i < sorted.length; i++) {
      const lo = sorted[i].min_sales;
      const hi = i + 1 < sorted.length ? sorted[i + 1].min_sales : Infinity;
      if (total > lo) {
        const amt = Math.min(total, hi) - lo;
        commission += (amt * sorted[i].percent) / 100;
        appliedPct = sorted[i].percent;
      }
    }
    return { percent: appliedPct, commission: Math.round(commission) };
  }
  // whole: ถึงขั้นไหนได้ % ขั้นนั้นทั้งยอด
  let pct = 0;
  for (const t of sorted) if (total >= t.min_sales) pct = t.percent;
  return { percent: pct, commission: Math.round((total * pct) / 100) };
}

// GET ?branch_ID=&month=YYYY-MM — สรุปคอม sale ต่อเดือน (tier + add-on)
export const GET = apiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID") || getAuth(req).branch_ID;
  const month = sp.get("month") || localDate().slice(0, 7);
  const setting = await CommissionSetting.findOne({ branch_ID }).lean();
  const tiers = setting?.sale_tiers || [];
  const mode = setting?.tier_mode || "whole";

  const sales = await User.find({ branch_ID, role: "sale", active: true }).lean();
  const ccs = await CustomerCourse.find({ branch_ID }).lean();
  const opds = await Opd.find({ branch_ID }).lean();
  const earnings = await StaffEarning.find({ branch_ID, type: "addon_commission" }).lean();

  const rows = sales.map((s) => {
    // ยอดขายคอร์ส (ต่อ sale ที่ดูแลเคส) ในเดือนนั้น
    const courseSales = ccs
      .filter((cc) => cc.sale_ID === s.user_ID && cc.purchased_at && localDate(new Date(cc.purchased_at)).slice(0, 7) === month)
      .reduce((a, cc) => a + (cc.total_price || 0), 0);
    // + add-on ครั้งแรก (รวมบิลคอร์ส) จากเคสที่ sale คนนี้ดูแล — เข้าฐาน tier ด้วย
    const firstAddonBill = opds
      .filter((o) => o.sale_ID === s.user_ID && (o.date || "").slice(0, 7) === month)
      .reduce((a, o) => a + (o.add_ons || []).filter((x) => x.first_visit).reduce((s2, x) => s2 + (x.price || 0), 0), 0);
    const salesBase = courseSales + firstAddonBill;
    const tier = computeTier(salesBase, tiers, mode);
    const addon = earnings
      .filter((e) => e.user_ID === s.user_ID && (e.date || "").slice(0, 7) === month)
      .reduce((a, e) => a + (e.amount || 0), 0);
    return {
      user_ID: s.user_ID, name: s.full_name,
      course_sales: courseSales, first_addon_bill: firstAddonBill, sales_base: salesBase,
      tier_percent: tier.percent, tier_commission: tier.commission,
      addon_commission: addon, total: tier.commission + addon,
    };
  });

  // คอม add-on ของหมอ (แยกโชว์)
  const docEarn = await StaffEarning.find({ branch_ID, role: "doctor", type: "addon_commission" }).lean();
  const doctors = await User.find({ branch_ID, role: "doctor", active: true }).lean();
  const doctor_rows = doctors.map((d) => ({
    user_ID: d.user_ID, name: d.full_name,
    addon_commission: docEarn.filter((e) => e.user_ID === d.user_ID && (e.date || "").slice(0, 7) === month).reduce((a, e) => a + (e.amount || 0), 0),
  })).filter((r) => r.addon_commission > 0);

  return { branch_ID, month, tier_mode: mode, tiers, rows, doctor_rows };
});
