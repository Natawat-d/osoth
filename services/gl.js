import GlAccount from "@/models/GlAccount";
import JournalEntry from "@/models/JournalEntry";
import Payment from "@/models/Payment";
import Opd from "@/models/Opd";
import StaffEarning from "@/models/StaffEarning";
import Expense from "@/models/Expense";
import StockLot from "@/models/StockLot";
import ApBill from "@/models/ApBill";
import Budget from "@/models/Budget";
import { genId, localDate } from "./ids";

// ── ผังบัญชีมาตรฐาน (seed อัตโนมัติครั้งแรก) ──
// group: หมวดที่ Owner ตั้งใน GL setup — CAPEX/PEC/OPEX/FREIGHT + หมวดระบบ
export const DEFAULT_COA = [
  // สินทรัพย์
  { code: "1000", name: "เงินสด", type: "asset", group: "CASH", system: true },
  { code: "1010", name: "เงินฝากธนาคาร (โอน)", type: "asset", group: "CASH", system: true },
  { code: "1020", name: "ลูกหนี้บัตรเครดิต (รอเคลียร์)", type: "asset", group: "CASH", system: true },
  { code: "1100", name: "ลูกหนี้การค้า (AR)", type: "asset", group: "AR", system: true },
  { code: "1200", name: "สินค้าคงคลัง (ยา/เวชภัณฑ์)", type: "asset", group: "INVENTORY", system: true },
  { code: "1500", name: "สินทรัพย์ถาวร (CAPEX)", type: "asset", group: "CAPEX", system: true },
  // หนี้สิน
  { code: "2000", name: "เจ้าหนี้การค้า (AP)", type: "liability", group: "AP", system: true },
  { code: "2100", name: "ค่าตอบแทนพนักงานค้างจ่าย", type: "liability", group: "PAYABLE", system: true },
  { code: "2050", name: "ประกันสังคมค้างนำส่ง", type: "liability", group: "PAYABLE", system: true },
  { code: "2060", name: "ภาษีหัก ณ ที่จ่ายค้างนำส่ง", type: "liability", group: "PAYABLE", system: true },
  { code: "2300", name: "เงินมัดจำรับล่วงหน้า", type: "liability", group: "PAYABLE", system: true },
  { code: "2310", name: "รายได้รับล่วงหน้า (คอร์ส)", type: "liability", group: "PAYABLE", system: true },
  // ทุน
  { code: "3000", name: "ทุน", type: "equity", group: "EQUITY", system: true },
  { code: "3900", name: "กำไรสะสม", type: "equity", group: "EQUITY", system: true },
  // รายได้
  { code: "4000", name: "รายได้คอร์ส/บริการ", type: "revenue", group: "REVENUE", system: true },
  { code: "4100", name: "รายได้ add-on / อื่นๆ", type: "revenue", group: "REVENUE", system: true },
  { code: "4200", name: "รายได้ค่าจองคิว", type: "revenue", group: "REVENUE", system: true },
  // ค่าใช้จ่าย
  { code: "5000", name: "ต้นทุนยา/เวชภัณฑ์ (COGS)", type: "expense", group: "COGS", system: true },
  { code: "5100", name: "ค่ามือแพทย์/BT + คอมมิชชั่น", type: "expense", group: "LABOR", system: true },
  { code: "6000", name: "เงินเดือนสำนักงาน", type: "expense", group: "OPEX", system: true },
  { code: "6010", name: "ประกันสังคมส่วนนายจ้าง", type: "expense", group: "OPEX", system: true },
  { code: "6100", name: "ค่าเช่า", type: "expense", group: "OPEX", system: true },
  { code: "6200", name: "ค่าน้ำ/ไฟ/สาธารณูปโภค", type: "expense", group: "OPEX", system: true },
  { code: "6300", name: "ค่าใช้จ่ายดำเนินงานอื่น", type: "expense", group: "OPEX", system: true },
  { code: "6400", name: "ค่าธรรมเนียมบัตร/ช่องทางชำระ", type: "expense", group: "OPEX", system: true },
  { code: "6500", name: "ค่าขนส่ง (FREIGHT)", type: "expense", group: "FREIGHT", system: true },
  { code: "6600", name: "ค่าใช้จ่ายโครงการ/เตรียมเปิด (PEC)", type: "expense", group: "PEC", system: true },
];

export async function ensureCoA() {
  // upsert รายบัญชี — เพิ่มบัญชีระบบใหม่ให้ DB เดิมด้วย (ไม่ทับของที่ผู้ใช้แก้)
  for (const a of DEFAULT_COA) {
    await GlAccount.updateOne({ code: a.code }, { $setOnInsert: a }, { upsert: true });
  }
}

const r2 = (n) => Math.round(n * 100) / 100;
const METHOD_ACC = { cash: "1000", transfer: "1010", card: "1020", deposit: "2300" }; // deposit = หักจากมัดจำ (ตัดหนี้ 2300)
const EXPENSE_ACC = { rent: "6100", salary: "6000", utility: "6200", other: "6300" };

// ── ปิดงวดบัญชี: ห้ามบันทึกเอกสารเงินลงวันที่ในงวดที่ล็อกแล้ว ──
// เรียกจากจุด "สร้างเอกสารใหม่" ที่ผู้ใช้เลือกวันที่เองได้ (expense/manual JE/payroll/ปิดวัน/เคลียร์บัตร)
let _lockCache = { value: "", at: 0 };
export async function assertPeriodOpen(date) {
  if (Date.now() - _lockCache.at > 5000) {
    const Company = (await import("@/models/Company")).default;
    const co = await Company.findOne({}).lean();
    _lockCache = { value: co?.gl_locked_through || "", at: Date.now() };
  }
  if (_lockCache.value && date && date <= _lockCache.value)
    throw Object.assign(
      new Error(`งวดบัญชีถึง ${_lockCache.value} ปิดแล้ว — บันทึกย้อนหลังไม่ได้ (ให้กลับรายการในงวดปัจจุบัน)`),
      { status: 409 }
    );
}

// ── post journal entry (ตรวจสมดุล debit=credit + ห้ามบรรทัดติดลบ/ไม่ใช่ตัวเลข) ──
export async function postJE({ date, memo = "", lines, source_type = "manual", source_ID = null, posted_by = "" }) {
  for (const l of lines) {
    const d = l.debit || 0, c = l.credit || 0;
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0)
      throw Object.assign(new Error(`บรรทัดบัญชี ${l.account_code} มียอดติดลบ/ไม่ถูกต้อง (Dr ${d} / Cr ${c})`), { status: 400 });
  }
  const dr = r2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const cr = r2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  if (dr !== cr || dr === 0)
    throw Object.assign(new Error(`ยอดเดบิต (${dr}) ต้องเท่าเครดิต (${cr}) และไม่เป็นศูนย์`), { status: 400 });
  // ตรวจ account มีจริง
  const codes = [...new Set(lines.map((l) => l.account_code))];
  const found = await GlAccount.countDocuments({ code: { $in: codes } });
  if (found !== codes.length)
    throw Object.assign(new Error("มีรหัสบัญชีที่ไม่อยู่ในผังบัญชี"), { status: 400 });

  try {
    return await JournalEntry.create({
      je_ID: await genId("JE", 6),
      date, memo, lines, source_type, source_ID, posted_by,
    });
  } catch (e) {
    if (e.code === 11000) return null; // post ซ้ำจาก source เดิม — ข้าม (idempotent)
    throw e;
  }
}

// ── สร้าง JE จากธุรกรรม operation (แต่ละตัว idempotent ผ่าน source_type+source_ID) ──
const dstr = (d) => (typeof d === "string" ? d.slice(0, 10) : localDate(new Date(d)));

// ฝั่งเครดิตของเงินรับ:
//   deposit → 2300 (มัดจำ = หนี้สิน ไม่ใช่รายได้) · add_on → 4100 (บริการเกิดทันที)
//   คอร์ส deferred → 2310 (รายได้รับล่วงหน้า รอรับรู้ตอนใช้จริง) · คอร์สเดิม → 4000
const paymentRevAcc = (p) =>
  p.type === "deposit" ? "2300"
  : p.type === "booking_fee" ? "4200" // ค่าจองคิว = รายได้ทันที
  : p.type === "add_on" ? "4100"
  : p.deferred ? "2310" : "4000";

export async function postFromPayment(p) {
  return postJE({
    date: dstr(p.paid_at),
    memo: `รับเงิน ${p.type} · ${p.payment_ID}${p.HN_number ? " · " + p.HN_number : ""}`,
    lines: [
      { account_code: METHOD_ACC[p.method] || "1000", debit: p.amount, credit: 0 },
      { account_code: paymentRevAcc(p), debit: 0, credit: p.amount },
    ],
    source_type: "payment", source_ID: p.payment_ID,
  });
}

// กลับรายการเงินรับ (void/คืนเงิน) — JE ขาสลับกับตอนรับ ลงวันที่ที่ void
export async function postPaymentVoid(p) {
  return postJE({
    date: dstr(p.void_at || new Date()),
    memo: `กลับรายการ (void) ${p.payment_ID} · ${p.void_reason || ""}`,
    lines: [
      { account_code: paymentRevAcc(p), debit: p.amount, credit: 0 },
      { account_code: METHOD_ACC[p.method] || "1000", debit: 0, credit: p.amount },
    ],
    source_type: "reversal", source_ID: `void:${p.payment_ID}`,
  });
}

// รับรู้รายได้คอร์ส deferred ต่อครั้งที่ใช้ (ตอนปิดเคส): Dr 2310 / Cr 4000
export async function postRevenueRecognition({ opd_ID, date, amount }) {
  if (!(amount > 0)) return null;
  return postJE({
    date,
    memo: `รับรู้รายได้คอร์ส (ใช้สิทธิ์) เคส ${opd_ID}`,
    lines: [
      { account_code: "2310", debit: amount, credit: 0 },
      { account_code: "4000", debit: 0, credit: amount },
    ],
    source_type: "revenue_rec", source_ID: opd_ID,
  });
}

// ริบมัดจำ (no-show): Dr 2300 / Cr รายได้อื่น 4100
export async function postDepositForfeit(rs) {
  if (!(rs.deposit > 0)) return null;
  return postJE({
    date: rs.date || localDate(),
    memo: `ริบมัดจำ (ไม่มาตามนัด) ${rs.reserve_ID}`,
    lines: [
      { account_code: "2300", debit: rs.deposit, credit: 0 },
      { account_code: "4100", debit: 0, credit: rs.deposit },
    ],
    source_type: "deposit_forfeit", source_ID: rs.reserve_ID,
  });
}

// คืนมัดจำ (ยกเลิกล่วงหน้า): Dr 2300 / Cr เงินสด/โอน
export async function postDepositRefund(rs, method = "cash") {
  if (!(rs.deposit > 0)) return null;
  return postJE({
    date: localDate(),
    memo: `คืนมัดจำ ${rs.reserve_ID}`,
    lines: [
      { account_code: "2300", debit: rs.deposit, credit: 0 },
      { account_code: METHOD_ACC[method] || "1000", debit: 0, credit: rs.deposit },
    ],
    source_type: "deposit_refund", source_ID: rs.reserve_ID,
  });
}

// ปิดยอดสิ้นวัน — ส่วนต่างเงินสดนับจริง: ขาด → สูญเสีย · เกิน → รายได้อื่น
export async function postFromDailyClose(dc) {
  const diff = r2(dc.diff || 0);
  if (diff === 0) return null;
  const lines = diff < 0
    ? [
        { account_code: "6300", debit: -diff, credit: 0 },
        { account_code: "1000", debit: 0, credit: -diff },
      ]
    : [
        { account_code: "1000", debit: diff, credit: 0 },
        { account_code: "4100", debit: 0, credit: diff },
      ];
  return postJE({
    date: dc.date,
    memo: `ปิดยอดสิ้นวัน ${dc.date}: เงินสด${diff < 0 ? "ขาด" : "เกิน"} ${Math.abs(diff)}฿ ${dc.note || ""}`,
    lines,
    source_type: "daily_close", source_ID: dc.close_ID,
  });
}

// เคลียร์เงินบัตร: Dr ธนาคาร(สุทธิ) + Dr ค่าธรรมเนียม / Cr ลูกหนี้บัตร 1020
export async function postFromCardSettlement(cs) {
  return postJE({
    date: cs.date,
    memo: `เคลียร์เงินบัตรเข้าธนาคาร ${cs.settle_ID}${cs.note ? " · " + cs.note : ""}`,
    lines: [
      { account_code: "1010", debit: cs.net, credit: 0 },
      ...(cs.fee > 0 ? [{ account_code: "6400", debit: cs.fee, credit: 0 }] : []),
      { account_code: "1020", debit: 0, credit: cs.amount },
    ],
    source_type: "card_settle", source_ID: cs.settle_ID,
  });
}

export async function postFromOpdCogs(opd) {
  const cogs = r2((opd.stock_used || []).reduce((s, u) => s + (u.cost_of_goods || 0), 0));
  if (cogs <= 0) return null;
  return postJE({
    date: opd.date,
    memo: `ต้นทุนยา เคส ${opd.opd_ID}`,
    lines: [
      { account_code: "5000", debit: cogs, credit: 0 },
      { account_code: "1200", debit: 0, credit: cogs },
    ],
    source_type: "cogs", source_ID: opd.opd_ID,
  });
}

export async function postFromEarning(e) {
  return postJE({
    date: e.date,
    memo: `ค่าตอบแทน ${e.role} ${e.user_ID} (${e.type})`,
    lines: [
      { account_code: "5100", debit: e.amount, credit: 0 },
      { account_code: "2100", debit: 0, credit: e.amount },
    ],
    source_type: "earning", source_ID: e.earning_ID,
  });
}

export async function postFromExpense(x) {
  return postJE({
    date: x.date,
    memo: `ค่าใช้จ่าย: ${x.description || x.category}`,
    lines: [
      { account_code: EXPENSE_ACC[x.category] || "6300", debit: x.amount, credit: 0 },
      { account_code: "1000", debit: 0, credit: x.amount },
    ],
    source_type: "expense", source_ID: x.expense_ID,
  });
}

// รับของเข้า (lot) — เข้าคลัง: Dr 1200 / Cr 2000 (AP ถ้ามาจาก PO/มี supplier) หรือ 1000 (ซื้อสด)
export async function postFromStockLot(lot, { credit_account = null } = {}) {
  const value = r2((lot.cost_price_per_unit || 0) * (lot.quantity_received || 0));
  if (value <= 0) return null;
  return postJE({
    date: lot.received_at,
    memo: `รับของเข้า lot ${lot.lot_ID} (${lot.product_ID})`,
    lines: [
      { account_code: "1200", debit: value, credit: 0 },
      { account_code: credit_account || (lot.supplier ? "2000" : "1000"), debit: 0, credit: value },
    ],
    source_type: "stock_receive", source_ID: lot.lot_ID,
  });
}

export async function postFromApPayment(bill, pay, idx) {
  return postJE({
    date: pay.paid_at,
    memo: `จ่ายเจ้าหนี้ ${bill.supplier_name || bill.supplier_ID || ""} · ${bill.bill_ID}`,
    lines: [
      { account_code: "2000", debit: pay.amount, credit: 0 },
      { account_code: METHOD_ACC[pay.method] || "1010", debit: 0, credit: pay.amount },
    ],
    source_type: "ap_payment", source_ID: `${bill.bill_ID}:${idx}`,
  });
}

// นับสต๊อก — ปรับลด (ของหาย/เสีย): Dr 6300 / Cr 1200
export async function postStockAdjust({ adjust_ID, date, value, note }) {
  if (value <= 0) return null;
  return postJE({
    date,
    memo: `ปรับยอดนับสต๊อก: ${note || ""}`,
    lines: [
      { account_code: "6300", debit: value, credit: 0 },
      { account_code: "1200", debit: 0, credit: value },
    ],
    source_type: "stock_adjust", source_ID: adjust_ID,
  });
}

// ทิ้งขวด (discard) — ตัดมูลค่าที่เหลือของขวดออกจากคลัง: Dr สูญเสีย(6300) / Cr 1200
// มูลค่าตามสัดส่วน cc ที่เหลือจริง (ขวดเปิดแล้วไม่คิดเต็มขวด — COGS ส่วนที่ใช้ถูกตัดไปแล้วตอนปิดเคส)
export async function postFromDiscard({ item, lot, product }) {
  const subUnit = product?.sub_unit_size || 1;
  const value = r2(((lot?.cost_price_per_unit || 0) * (item.cc_remaining || 0)) / subUnit);
  if (value <= 0) return null;
  return postJE({
    date: localDate(),
    memo: `ทิ้งขวด ${item.item_ID} (${item.product_ID}) เหลือ ${item.cc_remaining}cc`,
    lines: [
      { account_code: "6300", debit: value, credit: 0 },
      { account_code: "1200", debit: 0, credit: value },
    ],
    source_type: "stock_discard", source_ID: item.item_ID,
  });
}

// เงินเดือนงวดที่จ่ายแล้ว — post จาก PayrollRun (ใช้ทั้งตอนกดจ่าย และตอน rebuild กู้ journal)
export async function postFromPayrollRun(run, posted_by = "") {
  const rows = run.rows || [];
  const totalNet = r2(rows.reduce((s, r) => s + r.net, 0));
  const ssoEmployee = r2(rows.reduce((s, r) => s + r.sso, 0));
  const ssoEmployer = run.sso_employer ?? ssoEmployee;
  const totalTax = r2(rows.reduce((s, r) => s + r.tax, 0));
  const totalSalary = r2(rows.reduce((s, r) => s + r.salary + r.additions - r.deduction, 0));
  const totalEarn = r2(rows.reduce((s, r) => s + r.earnings, 0));
  const lines = [
    { account_code: "6000", debit: totalSalary, credit: 0, note: "เงินเดือน+เพิ่มเติม-หักอื่น" },
    ...(totalEarn > 0 ? [{ account_code: "2100", debit: totalEarn, credit: 0, note: "เคลียร์ค่ามือ/คอมค้างจ่าย" }] : []),
    { account_code: "6010", debit: ssoEmployer, credit: 0, note: "สปส.นายจ้าง" },
    { account_code: run.method === "cash" ? "1000" : "1010", debit: 0, credit: totalNet, note: "จ่ายสุทธิ" },
    { account_code: "2050", debit: 0, credit: r2(ssoEmployee + ssoEmployer), note: "สปส.รอนำส่ง" },
    ...(totalTax > 0 ? [{ account_code: "2060", debit: 0, credit: totalTax, note: "ภาษีรอนำส่ง" }] : []),
  ].filter((l) => l.debit > 0 || l.credit > 0);
  if (!lines.length) return null;
  return postJE({
    date: `${run.period}-28`, // จ่ายสิ้นเดือน (มาตรฐานงวดเดือน)
    memo: `เงินเดือนงวด ${run.period} (${rows.length} คน)`,
    lines,
    source_type: "payroll", source_ID: run.payroll_ID, posted_by,
  });
}

// ── rebuild: สแกนธุรกรรมทั้งหมด post ที่ยังไม่เคย post (idempotent ทั้งก้อน) ──
// ทนต่อเอกสารเสีย: เอกสารใดโพสต์ไม่ผ่าน (ยอด 0/ติดลบ/ผังบัญชีหาย) ให้ "ข้าม" พร้อมรายงาน
// — ห้ามพังทั้งรายงานเพราะ record เดียว (เคยเกิด: expense 0 บาททำ trial balance ตอบ 400 ทั้งระบบ)
export async function rebuildJournal() {
  await ensureCoA();
  const PayrollRun = (await import("@/models/PayrollRun")).default;
  const DailyClose = (await import("@/models/DailyClose")).default;
  const CardSettlement = (await import("@/models/CardSettlement")).default;
  const Reserve = (await import("@/models/Reserve")).default;
  const [payments, opds, earnings, expenses, lots, bills, payrolls, dailyCloses, settles, depReserves] = await Promise.all([
    Payment.find({}).lean(),
    Opd.find({ status: "closed" }).lean(),
    StaffEarning.find({}).lean(),
    Expense.find({}).lean(),
    StockLot.find({}).lean(),
    ApBill.find({}).lean(),
    PayrollRun.find({ status: "paid" }).lean(),
    DailyClose.find({}).lean(),
    CardSettlement.find({}).lean(),
    Reserve.find({ deposit_status: { $in: ["forfeited", "refunded"] } }).lean(),
  ]);
  let posted = 0;
  const skipped = [];
  const tryPost = async (label, fn) => {
    try {
      if (await fn()) posted++;
    } catch (e) {
      skipped.push({ source: label, error: e.message });
    }
  };
  for (const b of bills)
    // ตั้งหนี้เฉพาะบิลที่คีย์มือ — บิลจาก PO/รับของเข้า (มี po_ID/lot_ID) JE ถูก post จากฝั่ง stock แล้ว
    if (!b.po_ID && !b.lot_ID)
      await tryPost(`ap_bill:${b.bill_ID}`, () => postJE({
        date: b.bill_date,
        memo: `ตั้งหนี้ ${b.supplier_name || ""} · ${b.description || b.bill_ID}`,
        lines: [
          { account_code: b.expense_account || "1200", debit: b.amount, credit: 0 },
          { account_code: "2000", debit: 0, credit: b.amount },
        ],
        source_type: "ap_bill", source_ID: b.bill_ID,
      }));
  for (const p of payments) await tryPost(`payment:${p.payment_ID}`, () => postFromPayment(p));
  for (const o of opds) await tryPost(`cogs:${o.opd_ID}`, () => postFromOpdCogs(o));
  for (const e of earnings) await tryPost(`earning:${e.earning_ID}`, () => postFromEarning(e));
  for (const x of expenses) await tryPost(`expense:${x.expense_ID}`, () => postFromExpense(x));
  for (const l of lots) await tryPost(`stock_receive:${l.lot_ID}`, () => postFromStockLot(l));
  for (const b of bills)
    for (let i = 0; i < (b.payments || []).length; i++)
      await tryPost(`ap_payment:${b.bill_ID}:${i}`, () => postFromApPayment(b, b.payments[i], i));
  for (const pr of payrolls) await tryPost(`payroll:${pr.payroll_ID}`, () => postFromPayrollRun(pr));
  // V3.5: กลับรายการ payment ที่ void · รับรู้รายได้คอร์ส deferred · ปิดวัน · เคลียร์บัตร · มัดจำริบ/คืน
  for (const p of payments)
    if (p.voided) await tryPost(`void:${p.payment_ID}`, () => postPaymentVoid(p));
  for (const o of opds)
    if (o.revenue_recognized > 0)
      await tryPost(`revenue_rec:${o.opd_ID}`, () =>
        postRevenueRecognition({ opd_ID: o.opd_ID, date: o.date, amount: o.revenue_recognized }));
  for (const dc of dailyCloses) await tryPost(`daily_close:${dc.close_ID}`, () => postFromDailyClose(dc));
  for (const cs of settles) await tryPost(`card_settle:${cs.settle_ID}`, () => postFromCardSettlement(cs));
  for (const rs of depReserves)
    await tryPost(`deposit:${rs.reserve_ID}`, () =>
      rs.deposit_status === "forfeited" ? postDepositForfeit(rs) : postDepositRefund(rs, rs.deposit_refund_method || "cash"));
  return { posted, skipped };
}

// ── รายงาน ──
// trial balance: ยอด Dr/Cr สะสมต่อบัญชี (ช่วงวันที่ระบุ หรือทั้งหมด)
export async function trialBalance({ from = "0000-01-01", to = "9999-12-31" } = {}) {
  await ensureCoA();
  const [accounts, jes] = await Promise.all([
    GlAccount.find({ active: true }).sort({ code: 1 }).lean(),
    JournalEntry.find({ date: { $gte: from, $lte: to } }).lean(),
  ]);
  const sums = {};
  for (const je of jes)
    for (const l of je.lines) {
      sums[l.account_code] = sums[l.account_code] || { debit: 0, credit: 0 };
      sums[l.account_code].debit += l.debit || 0;
      sums[l.account_code].credit += l.credit || 0;
    }
  const rows = accounts.map((a) => {
    const s = sums[a.code] || { debit: 0, credit: 0 };
    // balance ตามธรรมชาติบัญชี: asset/expense = Dr-Cr · อื่น = Cr-Dr
    const natural = ["asset", "expense"].includes(a.type) ? s.debit - s.credit : s.credit - s.debit;
    return { ...a, debit: r2(s.debit), credit: r2(s.credit), balance: r2(natural) };
  });
  const total = {
    debit: r2(rows.reduce((s, r) => s + r.debit, 0)),
    credit: r2(rows.reduce((s, r) => s + r.credit, 0)),
  };
  return { rows, total, balanced: total.debit === total.credit };
}

// P&L: รายได้ − ค่าใช้จ่าย ตามช่วงเวลา (จาก JE)
export async function profitLoss({ from, to }) {
  const tb = await trialBalance({ from, to });
  const revenue = tb.rows.filter((r) => r.type === "revenue");
  const expense = tb.rows.filter((r) => r.type === "expense");
  const totalRevenue = r2(revenue.reduce((s, r) => s + r.balance, 0));
  const totalExpense = r2(expense.reduce((s, r) => s + r.balance, 0));
  // จัดกลุ่มค่าใช้จ่ายตาม group (COGS/LABOR/OPEX/FREIGHT/PEC)
  const byGroup = {};
  for (const r of expense) {
    byGroup[r.group] = byGroup[r.group] || { group: r.group, amount: 0, accounts: [] };
    byGroup[r.group].amount = r2(byGroup[r.group].amount + r.balance);
    byGroup[r.group].accounts.push({ code: r.code, name: r.name, amount: r.balance });
  }
  return {
    from, to,
    revenue: revenue.map((r) => ({ code: r.code, name: r.name, amount: r.balance })),
    total_revenue: totalRevenue,
    expense_groups: Object.values(byGroup),
    total_expense: totalExpense,
    net_profit: r2(totalRevenue - totalExpense),
  };
}

// Budget vs Actual: เทียบงบ (Budget) กับยอดจริง (JE) ต่อบัญชี ต่อเดือนในปีที่เลือก
export async function budgetVsActual({ year }) {
  await ensureCoA();
  const [budgets, accounts, jes] = await Promise.all([
    Budget.find({ year }).lean(),
    GlAccount.find({ active: true }).sort({ code: 1 }).lean(),
    JournalEntry.find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).lean(),
  ]);
  const accMap = Object.fromEntries(accounts.map((a) => [a.code, a]));
  // actual ต่อบัญชีต่อเดือน
  const actual = {};
  for (const je of jes) {
    const m = Number(je.date.slice(5, 7)) - 1;
    for (const l of je.lines) {
      const a = accMap[l.account_code];
      if (!a) continue;
      const natural = ["asset", "expense"].includes(a.type) ? (l.debit || 0) - (l.credit || 0) : (l.credit || 0) - (l.debit || 0);
      actual[l.account_code] = actual[l.account_code] || Array(12).fill(0);
      actual[l.account_code][m] = r2(actual[l.account_code][m] + natural);
    }
  }
  const rows = budgets.map((b) => {
    const act = actual[b.account_code] || Array(12).fill(0);
    const totalBudget = r2(b.monthly.reduce((s, v) => s + v, 0));
    const totalActual = r2(act.reduce((s, v) => s + v, 0));
    return {
      account_code: b.account_code,
      account_name: accMap[b.account_code]?.name || b.account_code,
      monthly_budget: b.monthly,
      monthly_actual: act,
      total_budget: totalBudget,
      total_actual: totalActual,
      variance: r2(totalBudget - totalActual),
    };
  });
  return { year, rows };
}
