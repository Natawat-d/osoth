import PayrollRun from "@/models/PayrollRun";
import User from "@/models/User";
import StaffEarning from "@/models/StaffEarning";
import Attendance from "@/models/Attendance";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { genId } from "@/services/ids";
import { ensureCoA, postFromPayrollRun } from "@/services/gl";

const r2 = (n) => Math.round(n * 100) / 100;
// ประกันสังคมมาตรฐาน: 5% ของฐานเงินเดือน · ฐานขั้นต่ำ 1,650 / เพดาน 15,000
// เงินสมทบปัดเป็น "บาทเต็ม" ตามแนวปฏิบัติ สปส. → หักจริง 83–750 บาท
const ssoOf = (salary) =>
  salary <= 0 ? 0 : Math.round(Math.min(Math.max(salary, 1650), 15000) * 0.05);

// คำนวณงวด: ฐานเงินเดือน (เดือนแรก prorate ตามวันเช็คอินจริง × เงินเดือน/30) + ค่ามือ/คอมเดือน + สปส.อัตโนมัติ
async function computeDraft(period) {
  const users = await User.find({ active: true, role: { $ne: "super_admin" } }).lean();
  const [earnings, atts] = await Promise.all([
    StaffEarning.find({ date: { $gte: `${period}-01`, $lte: `${period}-31` } }).lean(),
    Attendance.find({ date: { $gte: `${period}-01`, $lte: `${period}-31` } }).lean(),
  ]);
  const earnByUser = {};
  for (const e of earnings) earnByUser[e.user_ID] = r2((earnByUser[e.user_ID] || 0) + e.amount);
  const attDays = {};
  for (const a of atts) if (a.check_in) attDays[a.user_ID] = (attDays[a.user_ID] || 0) + 1;

  return users.map((u) => {
    let salary = u.salary || 0;
    let prorated_days = null;
    // ยังไม่เริ่มงานในงวดนี้ (start_date อยู่เดือนถัดไป) → เงินเดือน 0 (กันจ่ายล่วงหน้าให้คนยังไม่เข้า)
    if (u.start_date && u.start_date.slice(0, 7) > period) salary = 0;
    // เดือนแรก (เดือนของ start_date) → เงินเดือน = วันเช็คอินจริง × (เงินเดือน/30)
    else if (salary > 0 && u.start_date && u.start_date.slice(0, 7) === period) {
      prorated_days = attDays[u.user_ID] || 0;
      salary = r2(prorated_days * (salary / 30));
    }
    const earn = earnByUser[u.user_ID] || 0;
    const sso = ssoOf(salary);
    return {
      user_ID: u.user_ID, full_name: u.full_name, role: u.role,
      salary, earnings: earn, additions: 0, sso, tax: 0, deduction: 0,
      net: r2(salary + earn - sso), prorated_days,
      note: prorated_days !== null ? `เดือนแรก: มาจริง ${prorated_days} วัน` : "",
    };
  });
}

// GET /api/payroll?period=YYYY-MM — งวดที่บันทึกไว้ หรือ draft คำนวณสด
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const period = new URL(req.url).searchParams.get("period");
  if (!/^\d{4}-\d{2}$/.test(period || ""))
    throw Object.assign(new Error("ต้องระบุ period (YYYY-MM)"), { status: 400 });
  const saved = await PayrollRun.findOne({ period }).lean();
  if (saved) return { ...saved, saved: true };
  const rows = await computeDraft(period);
  return { period, rows, status: "draft", saved: false, total_net: r2(rows.reduce((s, r) => s + r.net, 0)) };
});

// POST /api/payroll — บันทึก/จ่ายงวด
// { period, rows:[{user_ID, additions, tax, deduction, note}], action: "save"|"pay", method }
// จ่าย → ลงบัญชีคู่: Dr เงินเดือน(6000) + Dr ค่าตอบแทนค้างจ่าย(2100=earnings) + Dr สปส.นายจ้าง(6010)
//        Cr เงินสด/ธนาคาร(net) + Cr สปส.ค้างนำส่ง(2050=ลูกจ้าง+นายจ้าง) + Cr ภาษีค้างนำส่ง(2060)
export const POST = apiHandler(async (req) => {
  const auth = requireOwner(req);
  await ensureCoA();
  const body = await req.json();
  const { period, action = "save", method = "transfer" } = body;
  if (!/^\d{4}-\d{2}$/.test(period || ""))
    throw Object.assign(new Error("ต้องระบุ period (YYYY-MM)"), { status: 400 });

  const existing = await PayrollRun.findOne({ period });
  if (existing?.status === "paid")
    throw Object.assign(new Error("งวดนี้จ่ายแล้ว แก้ไขไม่ได้"), { status: 409 });

  // ตรวจช่องที่กรอกมา "ก่อน" บันทึกอะไรทั้งสิ้น — ติดลบ/NaN ปฏิเสธทั้งคำขอ (เคยหลุดเข้า GL)
  const numField = (v, label, user_ID) => {
    if (v === undefined || v === null || v === "") return null; // ไม่ส่งมา = ใช้ค่าเดิม/อัตโนมัติ
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0)
      throw Object.assign(new Error(`${label} ของ ${user_ID} ต้องเป็นตัวเลขไม่ติดลบ (พบ ${v})`), { status: 400 });
    return r2(n);
  };
  for (const r of body.rows || []) {
    numField(r.additions, "เงินเพิ่ม", r.user_ID);
    numField(r.tax, "ภาษี", r.user_ID);
    numField(r.deduction, "หักอื่น", r.user_ID);
    numField(r.sso, "สปส.", r.user_ID);
  }

  // base จาก draft ปัจจุบัน (salary/earnings/sso สดเสมอ) + ทับด้วยช่องที่กรอกมา
  const base = await computeDraft(period);
  const edits = Object.fromEntries((body.rows || []).map((r) => [r.user_ID, r]));
  const prevRows = Object.fromEntries((existing?.rows || []).map((r) => [r.user_ID, r]));
  const rows = base.map((r) => {
    const e = edits[r.user_ID] || {};
    const additions = numField(e.additions, "เงินเพิ่ม", r.user_ID) ?? 0;
    const tax = numField(e.tax, "ภาษี", r.user_ID) ?? 0;
    const deduction = numField(e.deduction, "หักอื่น", r.user_ID) ?? 0;
    // สปส. แก้เลขเองได้ต่อคน (ไม่ส่งมา = ใช้ค่าคำนวณอัตโนมัติ)
    const sso = numField(e.sso, "สปส.", r.user_ID) ?? r.sso;
    const prev = prevRows[r.user_ID] || {};
    return {
      ...r, additions, tax, deduction, sso, note: e.note || r.note || "",
      slip: prev.slip || "", slip_at: prev.slip_at || null, // คงสลิปที่แนบไว้
      net: r2(r.salary + r.earnings + additions - sso - tax - deduction),
    };
  });
  const totalNet = r2(rows.reduce((s, r) => s + r.net, 0));
  const ssoEmployee = r2(rows.reduce((s, r) => s + r.sso, 0));
  const ssoEmployer = ssoEmployee; // สมทบนายจ้างเท่าลูกจ้าง (5%)
  const totalTax = r2(rows.reduce((s, r) => s + r.tax, 0));
  const totalSalary = r2(rows.reduce((s, r) => s + r.salary + r.additions - r.deduction, 0));
  const totalEarn = r2(rows.reduce((s, r) => s + r.earnings, 0));

  const doc = await PayrollRun.findOneAndUpdate(
    { period },
    {
      $set: { rows, sso_employer: ssoEmployer, total_net: totalNet, method },
      $setOnInsert: { payroll_ID: await genId("PR", 4), period },
    },
    { upsert: true, new: true }
  );

  if (action === "pay") {
    // JE รวมศูนย์ที่ services/gl.js (postFromPayrollRun) — rebuild ก็ post ชุดเดียวกันได้ (กู้ journal)
    await postFromPayrollRun(doc, auth.user_ID);
    doc.status = "paid";
    doc.paid_at = new Date();
    doc.paid_by = auth.user_ID;
    await doc.save();
  }
  return doc;
});
