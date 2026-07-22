// Seed แบบ demo เยอะๆ — ล้าง DB + base + เคสหลายสถานะ + finance/commission (node scripts/seed-demo.mjs)
import mongoose from "mongoose";
import { seedBase } from "./seed.mjs";

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/osoth";
await mongoose.connect(URI);
const db = mongoose.connection.db;
console.log("connected:", URI);
await seedBase(db); // ล้าง + ใส่ฐาน (2 สาขา, catalog, stock, commission)

const now = new Date();
const ts = { created_at: now, updated_at: now };
const p = (n, w = 6) => String(n).padStart(w, "0");
const T = `${now.getFullYear()}-${p(now.getMonth() + 1, 2)}-${p(now.getDate(), 2)}`; // วันนี้ (local)
const yearBE = now.getFullYear() + 543; // ปี พ.ศ. — ต้องตรงกับ genHN (key counter HN:branch:ปี)
const toUnix = (date, time) => Math.floor(new Date(`${date}T${time}:00`).getTime() / 1000);
const addMin = (t, m) => { const [h, mm] = t.split(":").map(Number); const d = h * 60 + mm + m; return `${p(Math.floor(d / 60), 2)}:${p(d % 60, 2)}`; };

// ---- ข้อมูลอ้างอิงคอร์ส (สำหรับสร้างเคส/finance) ----
const COURSE = {
  "CS-001": { price: 15000, uses: 5, dur: 60, bt: { mp: "MP-002", name: "เตรียมผิว/แปะยาชา", cost: 150 }, dr: { mp: "MP-001", name: "ฉีด Botox", cost: 500 }, stock: { product: "PD-001", lot: "LOT-00001", cc: 2, cost: 700 } },
  "CS-006": { price: 5000, uses: 5, dur: 40, bt: { mp: "MP-004", name: "ทรีตเมนต์ผิว", cost: 200 }, dr: null, stock: { product: "PD-003", lot: "LOT-00003", cc: 1, cost: 300 } },
  "CS-002": { price: 8000, uses: 10, dur: 45, bt: { mp: "MP-004", name: "ทรีตเมนต์ผิว", cost: 200 }, dr: null, stock: { product: "PD-003", lot: "LOT-00003", cc: 1, cost: 300 } },
  "CS-007": { price: 30000, uses: 3, dur: 90, bt: { mp: "MP-002", name: "เตรียมผิว/แปะยาชา", cost: 150 }, dr: { mp: "MP-001", name: "ฉีด Botox", cost: 500 }, stock: { product: "PD-001", lot: "LOT-00001", cc: 2, cost: 700 } },
  "CS-005": { price: 25000, uses: 3, dur: 90, bt: { mp: "MP-002", name: "เตรียมผิว/แปะยาชา", cost: 150 }, dr: { mp: "MP-003", name: "ร้อยไหม", cost: 800 }, stock: null },
};

const nicks = ["มะปราง", "แพรว", "ก้อย", "น้ำ", "ฟ้า", "ตาล", "ปุ๊ก", "เมย์", "จูน", "แนน", "บี", "ครีม", "ดาว", "หมิว", "อุ๋ม", "ปอ", "เจน", "มุก", "ไอซ์", "แอน"];
const doctors = ["US-005", "US-006"], bts = ["US-007", "US-008"], sale = "US-004";

// ---- counters ----
let hn = 1, rs = 1, opd = 1, cc = 1, pay = 1, en = 1;
const customers = [], reserves = [], opds = [], ccs = [], payments = [], earnings = [];
const stockCuts = {}; // item_ID → cc ที่ตัด

const mkCustomer = (i) => {
  const HN = `HN-${yearBE}-${p(hn++, 4)}`;
  customers.push({ HN_number: HN, branch_ID: "BR-001", nick_name: nicks[i % nicks.length], full_name: `คุณ${nicks[i % nicks.length]} ทดสอบ`, sure_name: "", phone: `0810${p(1000 + i, 4)}`, drug_allergies: [], chronic_diseases: [], created_at: now, updated_at: now });
  return HN;
};

// สร้างคอร์สที่ขายแล้ว (+ payment) → คืน cc doc
const sellCC = (HN, courseID, paid = true, saleID = sale, usedTimes = 0) => {
  const info = COURSE[courseID];
  const ccID = `CC-${p(cc++)}`;
  const paidAmt = paid ? info.price : 0;
  ccs.push({
    customer_course_ID: ccID, branch_ID: "BR-001", HN_number: HN, reserve_contact: {},
    course_ID: courseID, course_snapshot: { name: courseID, quantity_used: info.uses, price: info.price, products: info.stock ? [{ product_ID: info.stock.product, sub_unit_per_use: info.stock.cc }] : [], BT_procedures: info.bt ? [{ medical_procedure_ID: info.bt.mp }] : [], doctor_procedures: info.dr ? [{ medical_procedure_ID: info.dr.mp }] : [], duration_minutes: info.dur },
    total_price: info.price, paid_amount: paidAmt, balance_due: info.price - paidAmt,
    payment_status: paidAmt >= info.price ? "paid" : paidAmt > 0 ? "partial" : "unpaid",
    uses_total: info.uses, uses_remaining: info.uses - usedTimes, status: "active",
    sale_ID: saleID, commission_rate: 0, commission_amount: 0, purchased_at: now, expires_at: null, created_at: now, updated_at: now,
  });
  if (paidAmt > 0) payments.push({ payment_ID: `PAY-${p(pay++)}`, branch_ID: "BR-001", HN_number: HN, type: "course_purchase", ref: { customer_course_ID: ccID, opd_ID: null }, amount: paidAmt, method: "cash", paid_at: now, received_by: "US-002", created_at: now, updated_at: now });
  return ccID;
};

// ---- เคสตามสถานะ ----
let idx = 0, roomIdx = 0, tIdx = 0;
const rooms = ["RM-001", "RM-002", "RM-003"];
const nextTime = () => { const t = addMin("09:00", tIdx * 20); tIdx++; return t; };
const nextRoom = () => rooms[roomIdx++ % rooms.length];

function addCase({ status, courseID, withOpd, opdStatus, procedures = [], addons = [], outcome = null, measured = false, paid = true }) {
  const HN = mkCustomer(idx++);
  const info = courseID ? COURSE[courseID] : null;
  const time = nextTime(), room = nextRoom(), dur = info?.dur || 60;
  const doctor = doctors[idx % 2], bt = bts[idx % 2];
  const ccID = courseID && (withOpd || status !== "booked") && paid !== null ? sellCC(HN, courseID, paid) : null;
  const rsID = `RS-${p(rs++)}`;
  const reserve = {
    reserve_ID: rsID, branch_ID: "BR-001", HN_number: HN, contact: { nick_name: customers.find(c => c.HN_number === HN).nick_name, phone: "" },
    customer_course_ID: ccID, date: T, time_start: time, time_end: addMin(time, dur),
    unix_start: toUnix(T, time), unix_end: toUnix(T, addMin(time, dur)),
    room_ID: room, doctor_ID: courseID && info?.dr ? doctor : null, BT_ID: courseID && info?.bt ? bt : null,
    deposit: 0, status, is_walk_in: idx % 4 === 0, reschedule_history: [],
    status_history: [{ status, at: now, by: "US-003" }], opd_ID: null, created_by: "US-004", note: "", created_at: now, updated_at: now,
  };
  if (withOpd) {
    const opdID = `OPD-${p(opd++)}`;
    reserve.opd_ID = opdID;
    const stockUsed = [];
    // ปิดเคส (done) → ตัด stock + earnings
    if (opdStatus === "closed" && outcome !== "consult_no_sale" && info?.stock) {
      stockUsed.push({ item_ID: null, lot_ID: info.stock.lot, product_ID: info.stock.product, cc_used: info.stock.cc, cost_of_goods: info.stock.cost });
      stockCuts[info.stock.product] = (stockCuts[info.stock.product] || 0) + info.stock.cc;
    }
    if (opdStatus === "closed" && outcome !== "consult_no_sale") {
      if (info?.bt) earnings.push({ earning_ID: `EN-${p(en++)}`, branch_ID: "BR-001", user_ID: bt, role: "BT", type: "procedure_fee", ref: { opd_ID: opdID, customer_course_ID: null }, medical_procedure_ID: info.bt.mp, amount: info.bt.cost, date: T, created_at: now, updated_at: now });
      if (info?.dr) earnings.push({ earning_ID: `EN-${p(en++)}`, branch_ID: "BR-001", user_ID: doctor, role: "doctor", type: "procedure_fee", ref: { opd_ID: opdID, customer_course_ID: null }, medical_procedure_ID: info.dr.mp, amount: info.dr.cost, date: T, created_at: now, updated_at: now });
    }
    // add-on (แนะโดย sale/หมอ) — payment + คอม
    const addonDocs = [];
    for (const a of addons) {
      const price = a.price || 0, pid = price > 0 ? `PAY-${p(pay++)}` : null;
      if (price > 0) payments.push({ payment_ID: pid, branch_ID: "BR-001", HN_number: HN, type: "add_on", ref: { customer_course_ID: null, opd_ID: opdID }, amount: price, method: "cash", paid_at: now, received_by: "US-002", created_at: now, updated_at: now });
      addonDocs.push({ product_ID: a.product || null, name: a.name, qty: 1, cc_used: 0, price, recommended_by: a.by, first_visit: false, medical_procedure_ID: a.proc || null, proc_name: a.procName || "", proc_type: a.procType || null, proc_cost: a.procCost || 0, payment_ID: pid });
      if (opdStatus === "closed" && a.comm) earnings.push({ earning_ID: `EN-${p(en++)}`, branch_ID: "BR-001", user_ID: a.by, role: a.byRole, type: "addon_commission", ref: { opd_ID: opdID, customer_course_ID: null }, amount: a.comm, date: T, created_at: now, updated_at: now });
      // ค่ามือหัตถการที่แนบมากับ add-on → BT/หมอ ของเคส
      if (opdStatus === "closed" && a.proc) { const perf = a.procType === "doctor" ? doctor : bt; earnings.push({ earning_ID: `EN-${p(en++)}`, branch_ID: "BR-001", user_ID: perf, role: a.procType === "doctor" ? "doctor" : "BT", type: "procedure_fee", ref: { opd_ID: opdID, customer_course_ID: null }, medical_procedure_ID: a.proc, amount: a.procCost || 0, date: T, created_at: now, updated_at: now }); }
    }
    opds.push({
      opd_ID: opdID, branch_ID: "BR-001", reserve_ID: rsID, HN_number: HN, customer_course_ID: ccID, session_no: courseID ? 1 : 0,
      sale_ID: sale, consulted: opdStatus === "closed" && outcome === "consult_no_sale" ? true : false,
      consult_doctor_ID: opdStatus === "consulting" || outcome === "consult_no_sale" ? doctor : null,
      outcome, price_override: null, date: T, room_ID: room, time_start: time, time_end: addMin(time, dur),
      opd_data: measured || opdStatus === "closed" || ["bt_stage", "doctor_stage"].includes(opdStatus) ? { blood_pressure: "120/80", heart_rate: 72, weight_kg: 55, height_cm: 165, fat_mass: 22, muscle_mass: 40, other: "", measured_by: "US-003", measured_at: now } : { measured_at: null },
      BT_ID: info?.bt ? bt : null, doctor_ID: info?.dr ? doctor : (opdStatus === "consulting" || outcome === "consult_no_sale" ? doctor : null),
      procedures_done: procedures, stock_used: stockUsed, add_ons: addonDocs,
      status: opdStatus, closed_by: opdStatus === "closed" ? "US-002" : null, closed_at: opdStatus === "closed" ? now : null, created_at: now, updated_at: now,
    });
  }
  reserves.push(reserve);
}

// procedures helper
const procBT = (c) => COURSE[c].bt ? [{ medical_procedure_ID: COURSE[c].bt.mp, name: COURSE[c].bt.name, type: "BT", performed_by: bts[0], cost: COURSE[c].bt.cost }] : [];
const procDr = (c) => COURSE[c].dr ? [{ medical_procedure_ID: COURSE[c].dr.mp, name: COURSE[c].dr.name, type: "doctor", performed_by: doctors[0], cost: COURSE[c].dr.cost }] : [];

// จองแล้ว (ยังไม่มา) ×3
for (let i = 0; i < 3; i++) addCase({ status: "booked", courseID: ["CS-001", "CS-006", "CS-002"][i], withOpd: false, paid: false });
// มาถึง ×2
for (let i = 0; i < 2; i++) addCase({ status: "arrived", courseID: null, withOpd: false, paid: null });
// พร้อมทำ (เปิดเคส วัดตัวแล้ว) ×2
addCase({ status: "ready", courseID: "CS-001", withOpd: true, opdStatus: "measuring", measured: true });
addCase({ status: "ready", courseID: "CS-006", withOpd: true, opdStatus: "open", measured: false });
// ปรึกษาหมอ ×2
addCase({ status: "consulting", courseID: "CS-007", withOpd: true, opdStatus: "consulting", paid: false });
addCase({ status: "consulting", courseID: "CS-005", withOpd: true, opdStatus: "consulting", paid: false });
// BT ทำ ×2
addCase({ status: "bt_stage", courseID: "CS-001", withOpd: true, opdStatus: "bt_stage", measured: true, procedures: procBT("CS-001") });
addCase({ status: "bt_stage", courseID: "CS-007", withOpd: true, opdStatus: "bt_stage", measured: true, procedures: procBT("CS-007") });
// หมอทำ ×2
addCase({ status: "doctor_stage", courseID: "CS-001", withOpd: true, opdStatus: "doctor_stage", measured: true, procedures: [...procBT("CS-001"), ...procDr("CS-001")] });
addCase({ status: "doctor_stage", courseID: "CS-005", withOpd: true, opdStatus: "doctor_stage", measured: true, procedures: [...procBT("CS-005"), ...procDr("CS-005")] });
// เสร็จ (ปิดเคส) ×4 — มี finance + คอม
addCase({ status: "done", courseID: "CS-001", withOpd: true, opdStatus: "closed", outcome: "treated", measured: true, procedures: [...procBT("CS-001"), ...procDr("CS-001")], addons: [{ product: "PD-001", name: "Botox 100u (10cc)", price: 2500, by: sale, byRole: "sale", comm: 250 }] });
addCase({ status: "done", courseID: "CS-006", withOpd: true, opdStatus: "closed", outcome: "treated", measured: true, procedures: procBT("CS-006") });
addCase({ status: "done", courseID: "CS-001", withOpd: true, opdStatus: "closed", outcome: "treated", measured: true, procedures: [...procBT("CS-001"), ...procDr("CS-001")], addons: [{ product: "PD-002", name: "Filler 1cc", price: 8000, by: "US-005", byRole: "doctor", comm: 300, proc: "MP-001", procName: "ฉีด Botox", procType: "doctor", procCost: 500 }] });
addCase({ status: "done", courseID: "CS-006", withOpd: true, opdStatus: "closed", outcome: "treated", measured: true, procedures: procBT("CS-006") });
// ปรึกษา-ไม่ซื้อ ×1
addCase({ status: "consult_no_sale", courseID: null, withOpd: true, opdStatus: "closed", outcome: "consult_no_sale", paid: null });
// ยกเลิก ×1, ไม่มา ×1
addCase({ status: "cancelled", courseID: null, withOpd: false, paid: null });
addCase({ status: "no_show", courseID: null, withOpd: false, paid: null });

// ---- ตัด inventory จริงตาม stockCuts (ให้ stock page ตรง) ----
for (const [product, ccTotal] of Object.entries(stockCuts)) {
  let remain = ccTotal;
  const items = await db.collection("inventoryitems").find({ branch_ID: "BR-001", product_ID: product, state: { $in: ["unused", "in_use"] } }).sort({ item_ID: 1 }).toArray();
  for (const it of items) {
    if (remain <= 0) break;
    const take = Math.min(it.cc_remaining, remain);
    const newCc = it.cc_remaining - take;
    await db.collection("inventoryitems").updateOne({ item_ID: it.item_ID }, { $set: { cc_remaining: newCc, state: newCc <= 0 ? "empty" : "in_use", opened_at: now } });
    remain -= take;
  }
}

// ---- insert ทั้งหมด ----
if (customers.length) await db.collection("customers").insertMany(customers);
if (ccs.length) await db.collection("customercourses").insertMany(ccs);
if (reserves.length) await db.collection("reserves").insertMany(reserves);
if (opds.length) await db.collection("opds").insertMany(opds);
if (payments.length) await db.collection("payments").insertMany(payments);
if (earnings.length) await db.collection("staffearnings").insertMany(earnings);

// ค่าใช้จ่ายตัวอย่าง (ให้หน้าการเงินมีรายจ่าย)
await db.collection("expenses").insertMany([
  { expense_ID: "EX-000001", branch_ID: "BR-001", category: "rent", description: "ค่าเช่าที่", amount: 30000, date: T, created_by: "US-002", created_at: now, updated_at: now },
  { expense_ID: "EX-000002", branch_ID: "BR-001", category: "utility", description: "ค่าไฟ/น้ำ", amount: 4500, date: T, created_by: "US-002", created_at: now, updated_at: now },
]);

// ---- bump counters กัน ID ชนกับที่ genId จะสร้าง ----
const setC = (key, seq) => db.collection("counters").updateOne({ key }, { $set: { seq } }, { upsert: true });
// HN counter ต้องใช้ key ที่ genHN ใช้จริง = `HN:${branch}:${ปีพ.ศ.}` (reset_yearly) — ตั้งให้เท่าจำนวนลูกค้าที่ seed
await Promise.all([setC("RS", rs), setC("OPD", opd), setC("CC", cc), setC("PAY", pay), setC("EN", en), setC("EX", 10), setC(`HN:BR-001:${yearBE}`, customers.length)]);
// HN counter — ปรับ hn_seq ใน systemconfig ถ้ามี (gen HN ใช้ config) — ข้ามเพราะ genHN นับจาก customers ที่มีอยู่

console.log(`seed-demo เสร็จ ✓ — วันที่ ${T}`);
console.log(`  customers ${customers.length} · reserves ${reserves.length} (ทุกสถานะ) · opds ${opds.length} · courses 8+2 สาขา`);
console.log(`  customer_courses ${ccs.length} · payments ${payments.length} · staff_earnings ${earnings.length} · expenses 2`);
await mongoose.disconnect();
