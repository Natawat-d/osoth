import Branch from "@/models/Branch";
import Reserve from "@/models/Reserve";
import { apiHandler, publicApiHandler } from "@/lib/api";

// GET /api/public/month?branch_ID=..&month=YYYY-MM
// สรุปคิวทั้งเดือนแบบ privacy (สำหรับ month-grid หน้า /calendar ลูกค้า)
// ต่อวัน: จำนวนคิว + ช่วงเวลา (ไม่มีตัวตนลูกค้า)
export const GET = publicApiHandler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const branch_ID = sp.get("branch_ID");
  const month = sp.get("month"); // "YYYY-MM"
  if (!branch_ID || !/^\d{4}-\d{2}$/.test(month || ""))
    throw Object.assign(new Error("ต้องระบุ branch_ID และ month (YYYY-MM)"), { status: 400 });

  const branch = await Branch.findOne({ branch_ID, storefront_enabled: true, active: true }).lean();
  if (!branch) throw Object.assign(new Error("ไม่พบสาขา"), { status: 404 });

  const reserves = await Reserve.find({
    branch_ID,
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
    status: { $nin: ["cancelled", "no_show"] },
  })
    .sort({ unix_start: 1 })
    .lean();

  // group ต่อวัน — ส่งเฉพาะช่วงเวลา (privacy)
  const days = {};
  for (const r of reserves) {
    days[r.date] = days[r.date] || { date: r.date, count: 0, slots: [] };
    days[r.date].count += 1;
    if (days[r.date].slots.length < 4)
      days[r.date].slots.push({ time_start: r.time_start, time_end: r.time_end });
  }
  return { month, days: Object.values(days) };
});
