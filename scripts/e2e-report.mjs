// สร้างรายงานทดสอบฟังก์ชัน + screenshot จากเว็บจริง → test_function.pdf
// ต้อง: seed ใหม่ก่อน + dev server รันอยู่ (localhost:3000)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const ART = path.resolve("test-artifacts");
const OUT = path.resolve("..", "test_function.pdf");
fs.mkdirSync(ART, { recursive: true });

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n) => {
  const x = new Date(d.getTime() + n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const H = (role, uid, branch = "BR-001") => ({
  "Content-Type": "application/json",
  "x-user-id": uid, "x-user-role": role, "x-branch-id": branch,
});
const AS = {
  super: H("super_admin", "US-001"),
  admin: H("admin", "US-002"),
  recept: H("acception", "US-003"),
  sale: H("sale", "US-004"),
  doc: H("doctor", "US-005"),
};
async function call(headers, method, p, body) {
  const r = await fetch(BASE + "/api" + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

const results = [];
let n = 0;
function tc(name, ok, detail = "") {
  n++;
  results.push({ id: "TC" + String(n).padStart(2, "0"), name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : " — " + detail}`);
}

// รูป SVG → data URI (ใช้เป็นแบนเนอร์โปร / รูปคอร์ส / ใบรับรองแพทย์)
function svgURI(title, sub, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>
    <rect width='800' height='600' fill='url(#g)'/>
    <rect x='24' y='24' width='752' height='552' fill='none' stroke='#e3d6b6' stroke-width='6'/>
    <text x='400' y='250' font-family='Tahoma' font-size='120' fill='#e3d6b6' text-anchor='middle'>☯</text>
    <text x='400' y='390' font-family='Tahoma' font-size='58' font-weight='bold' fill='#fff' text-anchor='middle'>${title}</text>
    <text x='400' y='450' font-family='Tahoma' font-size='34' fill='#f0e0d0' text-anchor='middle'>${sub}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

async function populate() {
  console.log("\n=== เตรียมข้อมูลทดสอบ (API) ===");

  // TC: ขายคอร์ส + ผ่อนชำระ
  const s1 = await call(AS.sale, "POST", "/customer-courses", {
    course_ID: "CS-001", reserve_contact: { nick_name: "มณี", phone: "0810000001" },
    first_payment: { amount: 5000, method: "transfer" },
  });
  const cc1 = s1.data?.customer_course;
  tc("ขายคอร์ส Botox + ผ่อนงวดแรก 5,000฿ (ค้าง 10,000฿)", s1.ok && cc1?.balance_due === 10000, JSON.stringify(s1).slice(0, 120));
  tc("คำนวณคอมมิชชั่น sale 5% = 750฿", cc1?.commission_amount === 750, `got ${cc1?.commission_amount}`);

  const s2 = await call(AS.sale, "POST", "/customer-courses", {
    course_ID: "CS-002", reserve_contact: { nick_name: "สมชาย", phone: "0810000002" },
    first_payment: { amount: 8000, method: "cash" },
  });
  const cc2 = s2.data?.customer_course;
  tc("ขายคอร์สทรีตเมนต์ จ่ายเต็ม 8,000฿", s2.ok && cc2?.payment_status === "paid", JSON.stringify(s2).slice(0, 120));

  // จองคิวหลายรายการวันนี้
  const mk = (b) => call(AS.sale, "POST", "/reserves", { date: today, ...b });
  const r1 = await mk({ contact: { nick_name: "มณี", phone: "0810000001" }, customer_course_ID: cc1?.customer_course_ID, room_ID: "RM-002", doctor_ID: "US-006", time_start: "13:00", time_end: "14:00" });
  const r3 = await mk({ contact: { nick_name: "สมชาย", phone: "0810000002" }, customer_course_ID: cc2?.customer_course_ID, room_ID: "RM-001", time_start: "10:00", time_end: "11:00" });
  await mk({ contact: { nick_name: "นภา" }, room_ID: "RM-003", time_start: "11:00", time_end: "12:30", is_walk_in: true });
  await mk({ contact: { nick_name: "ฟ้า" }, room_ID: "RM-002", doctor_ID: "US-006", time_start: "15:00", time_end: "16:00" });
  tc("จองคิวหลายรายการ (หลายห้อง/เวลา)", r1.ok && r3.ok);

  // กันจองซ้อน
  const clash = await mk({ contact: { nick_name: "ซ้อน" }, room_ID: "RM-002", time_start: "13:30", time_end: "14:30" });
  tc("กันจองซ้อน (ห้อง RM-002 เวลาทับ) → 409", clash.status === 409, `status ${clash.status}`);

  // --- เคส rs1: ปิดเคสครบวงจร ---
  await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { status: "arrived" });
  const cust1 = await call(AS.recept, "POST", "/customers", { full_name: "มณี", sure_name: "รัตนดี", nick_name: "มณี", phone: "0810000001" });
  tc("สร้าง HN ใหม่ (format HN-ปี-เลขรัน)", cust1.ok && /^HN-\d{4}-\d{4}$/.test(cust1.data?.HN_number || ""), cust1.data?.HN_number);
  await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { HN_number: cust1.data.HN_number });
  const opd1 = await call(AS.recept, "POST", "/opd", { reserve_ID: r1.data.reserve_ID, HN_number: cust1.data.HN_number });
  tc("เปิดเคส OPD (ผูก HN ย้อนหลังเข้าคอร์ส)", opd1.ok && opd1.data?.session_no === 1);

  const early = await call(AS.admin, "POST", `/opd/${opd1.data.opd_ID}/close`);
  tc("บังคับวัดตัวก่อนปิดเคส (ปิดก่อนวัด → 400)", early.status === 400, `status ${early.status}`);
  await call(AS.recept, "PUT", `/opd/${opd1.data.opd_ID}`, { opd_data: { blood_pressure: "118/76", weight_kg: 52, height_cm: 160, heart_rate: 72 }, BT_ID: "US-007" });
  await call(AS.admin, "PUT", `/opd/${opd1.data.opd_ID}`, {
    procedures_done: [
      { medical_procedure_ID: "MP-002", name: "เตรียมผิว/แปะยาชา", type: "BT", performed_by: "US-007", cost: 150 },
      { medical_procedure_ID: "MP-001", name: "ฉีด Botox", type: "doctor", performed_by: "US-006", cost: 500 },
    ],
  });
  const addon = await call(AS.recept, "POST", `/opd/${opd1.data.opd_ID}/addon`, { product_ID: "PD-003", qty: 1, method: "cash" });
  tc("Add-on มาส์กทองคำ 900฿ แยกบิล", addon.ok && addon.data?.price === 900);
  const closed = await call(AS.admin, "POST", `/opd/${opd1.data.opd_ID}/close`);
  tc("ปิดเคส: ตัด stock FIFO (lot แรก 3,500฿/10cc → 2cc=700฿)", closed.ok && closed.data?.stock_used?.[0]?.lot_ID === "LOT-00001" && closed.data?.stock_used?.[0]?.cost_of_goods === 700, JSON.stringify(closed.data?.stock_used?.[0] || {}));
  tc("ปิดเคส: นับครั้งคอร์สเหลือ 4 + สร้างค่ามือ 2 รายการ", closed.data?.uses_remaining === 4 && closed.data?.earnings_created === 2);

  const items = await call(AS.admin, "GET", "/stock/items?branch_ID=BR-001&product_ID=PD-001");
  const inUse = (items.data || []).find((i) => i.state === "in_use");
  tc("Stock: ขวดที่เปิด in_use เหลือ 8cc/4ครั้ง + มีวันหมดอายุหลังเปิด", inUse?.cc_remaining === 8 && inUse?.uses_remaining === 4 && !!inUse?.open_expiry_at);

  // จ่ายงวดผ่อนครบ
  const pay = await call(AS.admin, "POST", `/customer-courses/${cc1.customer_course_ID}/pay`, { amount: 10000, method: "cash" });
  tc("จ่ายงวดผ่อน 10,000฿ → ยอดค้าง = 0", pay.ok && pay.data?.balance_due === 0);

  // --- เคส rs3: เปิดค้างไว้ (โชว์ stepper กลางทาง) ---
  await call(AS.admin, "PUT", `/reserves/${r3.data.reserve_ID}`, { status: "arrived" });
  const cust3 = await call(AS.recept, "POST", "/customers", { full_name: "สมชาย", sure_name: "ใจกว้าง", nick_name: "สมชาย", phone: "0810000002" });
  await call(AS.admin, "PUT", `/reserves/${r3.data.reserve_ID}`, { HN_number: cust3.data.HN_number });
  const opd3 = await call(AS.recept, "POST", "/opd", { reserve_ID: r3.data.reserve_ID, HN_number: cust3.data.HN_number });
  await call(AS.recept, "PUT", `/opd/${opd3.data.opd_ID}`, { opd_data: { blood_pressure: "120/80", weight_kg: 60, height_cm: 170 }, BT_ID: "US-008" });

  // รายจ่ายอื่น
  await call(AS.admin, "POST", "/expenses", { category: "rent", description: "ค่าเช่าเดือน", amount: 15000, date: today, branch_ID: "BR-001" });

  // การเงิน
  const fin = await call(AS.admin, "GET", `/finance/summary?branch_ID=BR-001&from=${today}&to=${today}`);
  // ค่าแรง = ค่ามือหมอ/BT (650) เท่านั้น — คอม sale ขั้นบันไดคิดรายเดือน (หน้า /commission)
  tc("การเงิน: COGS=1000 (คอร์ส+add-on), ค่าแรง=650 (ค่ามือ), มี time-series", fin.data?.cogs === 1000 && fin.data?.labor_cost === 650 && Array.isArray(fin.data?.series), JSON.stringify({ cogs: fin.data?.cogs, labor: fin.data?.labor_cost }));
  const finAll = await call(AS.super, "GET", `/finance/summary?branch_ID=all&from=${today}&to=${today}`);
  tc("การเงินแยกสาขา vs รวมทุกสาขา (super_admin)", finAll.ok && finAll.data?.income >= fin.data?.income);
  const finDoc = await call(AS.doc, "GET", `/finance/summary?branch_ID=BR-001`);
  tc("สิทธิ์: หมอเปิดหน้าการเงินรวม → 403", finDoc.status === 403, `status ${finDoc.status}`);
  const earn = await call(AS.doc, "GET", `/earnings?from=${today}&to=${today}`);
  tc("หมอ (US-006 ทำเคส) เห็นรายได้ตัวเองเท่านั้น", earn.ok && earn.data?.user_ID === "US-005");

  // HR throughput
  const thr = await call(AS.admin, "GET", `/hr/throughput?branch_ID=BR-001&from=${today}&to=${today}`);
  tc("HR: รายงานอัตราการทำเคสต่อคน", thr.ok && thr.data?.total_cases >= 2, `cases ${thr.data?.total_cases}`);

  // ระบบลา
  const lvSick = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: today, date_to: today, reason: "ไข้หวัด" });
  tc("พนักงานยื่นลาป่วย 1 วัน", lvSick.ok && lvSick.data?.status === "pending");
  const lvOver = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: plus(3), date_to: plus(7), reason: "ผ่าตัด" });
  tc("ลาป่วยเกินกำหนด (>2วัน) ไม่มีใบรับรอง → 400", lvOver.status === 400, lvOver.error);
  const cert = svgURI("ใบรับรองแพทย์", "โรงพยาบาลตัวอย่าง", "#2f5d4a", "#1b3a2e");
  const lvCert = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: plus(3), date_to: plus(7), reason: "ผ่าตัด", medical_cert: cert });
  tc("ลาป่วยเกินกำหนด + แนบใบรับรองแพทย์ → ผ่าน", lvCert.ok);
  const approve = await call(AS.admin, "PUT", `/leaves/${lvSick.data.leave_ID}`, { status: "approved" });
  tc("admin อนุมัติคำขอลา", approve.ok && approve.data?.status === "approved");
  await call(H("BT", "US-007"), "POST", "/leaves", { type: "personal", date_from: plus(1), date_to: plus(1), reason: "ธุระครอบครัว" });

  // ตั้งค่ารูปโปร/คอร์ส (carousel)
  const promoImg = svgURI("โปรตรุษจีน ลด 10%", "Botox หน้าเรียว · ถึง 15 ก.ย.", "#b23a33", "#7a1e19");
  const pm = await call(AS.admin, "PUT", "/promotions/PM-001", { banner_image: promoImg });
  const courseImg = svgURI("คอร์สทรีตเมนต์ผิวใส", "10 ครั้ง · พิเศษ", "#a5842f", "#6e560f");
  const csimg = await call(AS.admin, "PUT", "/courses/CS-002", { image: courseImg });
  tc("ตั้งค่ารูปโปรโมชั่น + รูปคอร์ส (แสดง carousel หน้าร้าน)", pm.ok && csimg.ok);
}

// ================= ชุดทดสอบเพิ่มเติม (เยอะขึ้น) =================
// ใช้วันในอนาคต + BR-002 เพื่อไม่ให้รก screenshot ของวันนี้
async function extraTests() {
  console.log("\n=== ชุดทดสอบเพิ่มเติม ===");
  const EX = plus(10), EX2 = plus(11);
  const superH = AS.super;

  // ---------- [CRUD] จัดการข้อมูลหลัก ----------
  const br = await call(AS.admin, "POST", "/branches", { name: "สาขาทดสอบ" });
  tc("[CRUD] สร้างสาขาใหม่", br.ok && br.data?.branch_ID);
  const rmT = await call(AS.admin, "POST", "/rooms", { name: "ห้องทดสอบ", branch_ID: "BR-001", order: 9 });
  tc("[CRUD] สร้างห้องใหม่", rmT.ok && rmT.data?.room_ID);
  const rmOff = await call(AS.admin, "PUT", `/rooms/${rmT.data.room_ID}`, { active: false });
  tc("[CRUD] ปิดห้องชั่วคราว (active=false)", rmOff.ok && rmOff.data?.active === false);
  const pdT = await call(AS.admin, "POST", "/products", { name: "สินค้าทดสอบ", unit: "ชิ้น", sub_unit_size: 1, default_uses_per_unit: 1, selling_price: 500 });
  tc("[CRUD] สร้างสินค้าใหม่", pdT.ok && pdT.data?.product_ID);
  const pdEdit = await call(AS.admin, "PUT", `/products/${pdT.data.product_ID}`, { selling_price: 600 });
  tc("[CRUD] แก้ไขสินค้า (ราคาขาย)", pdEdit.ok && pdEdit.data?.selling_price === 600);
  const pdDel = await call(AS.admin, "DELETE", `/products/${pdT.data.product_ID}`);
  tc("[CRUD] ลบสินค้า (soft delete = active:false)", pdDel.ok && pdDel.data?.active === false);
  const mpT = await call(AS.admin, "POST", "/procedures", { name: "หัตถการทดสอบ", type: "doctor", cost: 1000 });
  tc("[CRUD] สร้างหัตถการ + ค่ามือ", mpT.ok && mpT.data?.cost === 1000);
  const csT = await call(AS.admin, "POST", "/courses", { name: "คอร์สทดสอบ", quantity_used: 3, price: 9000, validity_days: 180, products: [], BT_procedures: [], doctor_procedures: [] });
  tc("[CRUD] สร้างคอร์สใหม่", csT.ok && csT.data?.course_ID);
  const pmT = await call(AS.admin, "POST", "/promotions", { name: "โปรทดสอบ", type: "discount", course_ID: "CS-001", discount_type: "amount", discount_value: 2000, date_start: today, date_end: plus(30) });
  tc("[CRUD] สร้างโปรโมชั่น (ส่วนลดบาท)", pmT.ok && pmT.data?.promotion_ID);

  // ---------- [สิทธิ์] role-based access ----------
  const noAuth = await fetch(BASE + "/api/leaves").then((r) => r.status);
  tc("[สิทธิ์] ไม่มี auth เรียกข้อมูลลา → 401", noAuth === 401, `status ${noAuth}`);
  const rcClose = await call(AS.recept, "POST", "/opd/OPD-000001/close");
  tc("[สิทธิ์] acception ปิดเคส → 403 (เฉพาะ admin)", rcClose.status === 403, `status ${rcClose.status}`);
  const saleStock = await call(AS.sale, "POST", "/stock/receive", { product_ID: "PD-001", cost_price_per_unit: 100, quantity_received: 1 });
  tc("[สิทธิ์] sale รับของเข้า stock → 403", saleStock.status === 403, `status ${saleStock.status}`);
  const docCourse = await call(AS.doc, "POST", "/courses", { name: "x", quantity_used: 1, price: 1 });
  tc("[สิทธิ์] หมอสร้างคอร์ส → 403", docCourse.status === 403, `status ${docCourse.status}`);
  const btApprove = await call(H("BT", "US-007"), "PUT", "/leaves/LV-XXXXX", { status: "approved" });
  tc("[สิทธิ์] BT อนุมัติลา → 403", btApprove.status === 403, `status ${btApprove.status}`);
  const rcFin = await call(AS.recept, "GET", "/finance/summary?branch_ID=BR-001");
  tc("[สิทธิ์] acception เปิดการเงิน → 403", rcFin.status === 403, `status ${rcFin.status}`);

  // ---------- [จอง] edge cases ----------
  const mkX = (b, h = AS.sale) => call(h, "POST", "/reserves", { date: EX, ...b });
  const bNoHN = await mkX({ contact: { nick_name: "ยังไม่มี HN", phone: "0899999999" }, room_ID: "RM-001", time_start: "09:00", time_end: "10:00" });
  tc("[จอง] จองได้ก่อนมี HN (ใส่แค่ชื่อ/เบอร์)", bNoHN.ok);
  const bWalk = await mkX({ contact: { nick_name: "วอล์กอิน" }, room_ID: "RM-002", time_start: "09:00", time_end: "10:00", is_walk_in: true });
  tc("[จอง] Walk-in สร้างคิวหน้างาน", bWalk.ok && bWalk.data?.is_walk_in === true);
  const bResch = await mkX({ contact: { nick_name: "เลื่อนได้" }, room_ID: "RM-001", time_start: "11:00", time_end: "12:00" });
  const resch = await call(AS.admin, "PUT", `/reserves/${bResch.data.reserve_ID}`, { reschedule: { date: EX, time_start: "14:00", time_end: "15:00", room_ID: "RM-001" } });
  tc("[จอง] เลื่อนนัด + เก็บประวัติการเลื่อน", resch.ok && resch.data?.reschedule_history?.length === 1);
  const reschClash = await call(AS.admin, "PUT", `/reserves/${bResch.data.reserve_ID}`, { reschedule: { date: EX, time_start: "09:00", time_end: "10:00", room_ID: "RM-001" } });
  tc("[จอง] เลื่อนนัดชนคิวอื่น → 409", reschClash.status === 409, `status ${reschClash.status}`);
  const bCancel = await mkX({ contact: { nick_name: "ยกเลิก" }, room_ID: "RM-003", time_start: "09:00", time_end: "10:00" });
  const cancel = await call(AS.admin, "PUT", `/reserves/${bCancel.data.reserve_ID}`, { status: "cancelled" });
  tc("[จอง] ยกเลิกคิว", cancel.ok && cancel.data?.status === "cancelled");
  const bNoShow = await mkX({ contact: { nick_name: "ไม่มา" }, room_ID: "RM-003", time_start: "10:00", time_end: "11:00" });
  const noshow = await call(AS.admin, "PUT", `/reserves/${bNoShow.data.reserve_ID}`, { status: "no_show" });
  tc("[จอง] ไม่มาตามนัด (no-show)", noshow.ok && noshow.data?.status === "no_show");
  const bBad = await mkX({ contact: { nick_name: "ข้ามสถานะ" }, room_ID: "RM-003", time_start: "12:00", time_end: "13:00" });
  const badFlow = await call(AS.admin, "PUT", `/reserves/${bBad.data.reserve_ID}`, { status: "done" });
  tc("[จอง] เปลี่ยนสถานะข้าม flow (จองแล้ว→เสร็จ) → 400", badFlow.status === 400, `status ${badFlow.status}`);
  const bBack = await mkX({ contact: { nick_name: "ต่อเวลา" }, room_ID: "RM-001", time_start: "10:00", time_end: "11:00" });
  tc("[จอง] จองต่อเวลาพอดี (ไม่ถือว่าซ้อน)", bBack.ok);
  const docClash = await mkX({ contact: { nick_name: "หมอซ้อน1" }, room_ID: "RM-002", doctor_ID: "US-005", time_start: "13:00", time_end: "14:00" });
  const docClash2 = await mkX({ contact: { nick_name: "หมอซ้อน2" }, room_ID: "RM-003", doctor_ID: "US-005", time_start: "13:30", time_end: "14:30" });
  tc("[จอง] หมอคนเดียวซ้อน 2 ห้อง → 409", docClash.ok && docClash2.status === 409);

  // ---------- [หลายสาขา] ----------
  const bB1 = await mkX({ contact: { nick_name: "สาขา1" }, branch_ID: "BR-001", room_ID: "RM-001", time_start: "16:00", time_end: "17:00" }, superH);
  const bB2 = await mkX({ contact: { nick_name: "สาขา2" }, branch_ID: "BR-002", room_ID: "RM-004", time_start: "16:00", time_end: "17:00" }, superH);
  tc("[หลายสาขา] จองห้องคนละสาขา เวลาเดียวกัน ไม่ชนกัน", bB1.ok && bB2.ok);
  const usrB2 = await call(AS.admin, "POST", "/users", { full_name: "พนักงานสาขา2", nick_name: "ส2", role: "acception", branch_ID: "BR-002" });
  tc("[หลายสาขา] สร้างพนักงานสาขา BR-002", usrB2.ok && usrB2.data?.branch_ID === "BR-002");
  await call(superH, "POST", "/stock/receive", { branch_ID: "BR-002", product_ID: "PD-001", cost_price_per_unit: 4000, quantity_received: 2 });
  const sumB2 = await call(superH, "GET", "/stock/summary?branch_ID=BR-002");
  const pd1B2 = (sumB2.data || []).find((s) => s.product.product_ID === "PD-001");
  tc("[หลายสาขา] stock แยกสาขา — BR-002 มี PD-001 = 2 ขวด (แยกจาก BR-001)", pd1B2?.unused === 2, `got ${pd1B2?.unused}`);

  // ---------- [Stock] ----------
  const rcv = await call(AS.admin, "POST", "/stock/receive", { product_ID: "PD-002", cost_price_per_unit: 8000, quantity_received: 3, lot_number: "F-01", expiry_date: plus(200) });
  tc("[Stock] รับของเข้า lot ใหม่ → สร้างขวด 3 ชิ้น", rcv.ok && rcv.data?.items_created === 3);
  const rcvBad = await call(AS.admin, "POST", "/stock/receive", { product_ID: "PD-002", cost_price_per_unit: 100, quantity_received: 0 });
  tc("[Stock] รับของเข้าจำนวน < 1 → 400", rcvBad.status === 400, `status ${rcvBad.status}`);
  const itemsPd2 = await call(AS.admin, "GET", "/stock/items?branch_ID=BR-001&product_ID=PD-002");
  const oneItem = itemsPd2.data?.[0];
  const disc = await call(AS.admin, "POST", `/stock/items/${oneItem.item_ID}/discard`);
  tc("[Stock] ทิ้งขวด (state=discarded)", disc.ok && disc.data?.state === "discarded");
  const discAgain = await call(AS.admin, "POST", `/stock/items/${oneItem.item_ID}/discard`);
  tc("[Stock] ทิ้งขวดซ้ำ → 404", discAgain.status === 404, `status ${discAgain.status}`);

  // สินค้าหมด: คอร์สใช้เกิน stock → ปิดเคสไม่ได้
  const pdLow = await call(AS.admin, "POST", "/products", { name: "ยาสต๊อกน้อย", unit: "ขวด", sub_unit: "cc", sub_unit_size: 1, default_uses_per_unit: 1, selling_price: 100 });
  await call(AS.admin, "POST", "/stock/receive", { product_ID: pdLow.data.product_ID, cost_price_per_unit: 50, quantity_received: 1 });
  const csLow = await call(AS.admin, "POST", "/courses", { name: "คอร์สกินสต๊อกเยอะ", quantity_used: 1, price: 500, products: [{ product_ID: pdLow.data.product_ID, sub_unit_per_use: 5 }], BT_procedures: [], doctor_procedures: [] });
  const ccLow = await call(AS.sale, "POST", "/customer-courses", { course_ID: csLow.data.course_ID, reserve_contact: { nick_name: "หมดสต๊อก" }, first_payment: { amount: 500, method: "cash" } });
  const rsLow = await call(AS.sale, "POST", "/reserves", { date: EX, contact: { nick_name: "หมดสต๊อก" }, customer_course_ID: ccLow.data.customer_course.customer_course_ID, room_ID: "RM-002", time_start: "10:00", time_end: "11:00" });
  const cLow = await call(AS.recept, "POST", "/customers", { full_name: "หมดสต๊อก ทดสอบ", nick_name: "หมด" });
  await call(AS.admin, "PUT", `/reserves/${rsLow.data.reserve_ID}`, { HN_number: cLow.data.HN_number });
  const oLow = await call(AS.recept, "POST", "/opd", { reserve_ID: rsLow.data.reserve_ID, HN_number: cLow.data.HN_number });
  await call(AS.recept, "PUT", `/opd/${oLow.data.opd_ID}`, { opd_data: { blood_pressure: "120/80", weight_kg: 50, height_cm: 160 } });
  const closeLow = await call(AS.admin, "POST", `/opd/${oLow.data.opd_ID}/close`);
  tc("[Stock] ปิดเคสที่ stock ไม่พอ → error (กันตัดติดลบ)", !closeLow.ok, closeLow.error);

  // ---------- [คอร์ส/ลูกค้า] ----------
  const cMulti = await call(AS.recept, "POST", "/customers", { full_name: "ถือหลายคอร์ส", nick_name: "หลาย", phone: "0870000001" });
  await call(AS.sale, "POST", "/customer-courses", { course_ID: "CS-001", HN_number: cMulti.data.HN_number, first_payment: { amount: 15000, method: "cash" } });
  await call(AS.sale, "POST", "/customer-courses", { course_ID: "CS-002", HN_number: cMulti.data.HN_number, first_payment: { amount: 8000, method: "cash" } });
  const multiList = await call(AS.sale, "GET", `/customer-courses?HN=${cMulti.data.HN_number}`);
  tc("[คอร์ส] ลูกค้า 1 คนถือหลายคอร์สพร้อมกัน", (multiList.data || []).length === 2);
  const searchPhone = await call(AS.sale, "GET", "/customers?q=0870000001");
  tc("[คอร์ส] ค้นหาลูกค้าด้วยเบอร์โทร", (searchPhone.data || []).some((c) => c.HN_number === cMulti.data.HN_number));
  const profile = await call(AS.recept, "GET", `/customers/${cMulti.data.HN_number}`);
  tc("[คอร์ส] ดูโปรไฟล์ลูกค้า + คอร์สที่ถือ", profile.ok && profile.data?.courses?.length === 2);

  // คอร์สใช้ครบแล้วเปิดเคสอีกไม่ได้
  const cs1 = await call(AS.admin, "POST", "/courses", { name: "คอร์สครั้งเดียว", quantity_used: 1, price: 900, products: [{ product_ID: "PD-003", sub_unit_per_use: 1 }], BT_procedures: [], doctor_procedures: [] });
  const cc1u = await call(AS.sale, "POST", "/customer-courses", { course_ID: cs1.data.course_ID, reserve_contact: { nick_name: "ครั้งเดียว" }, first_payment: { amount: 900, method: "cash" } });
  const rs1u = await call(AS.sale, "POST", "/reserves", { date: EX, contact: { nick_name: "ครั้งเดียว" }, customer_course_ID: cc1u.data.customer_course.customer_course_ID, room_ID: "RM-003", time_start: "14:00", time_end: "15:00" });
  const c1u = await call(AS.recept, "POST", "/customers", { full_name: "ครั้งเดียว ทดสอบ", nick_name: "เดียว" });
  await call(AS.admin, "PUT", `/reserves/${rs1u.data.reserve_ID}`, { HN_number: c1u.data.HN_number });
  const o1u = await call(AS.recept, "POST", "/opd", { reserve_ID: rs1u.data.reserve_ID, HN_number: c1u.data.HN_number });
  await call(AS.recept, "PUT", `/opd/${o1u.data.opd_ID}`, { opd_data: { blood_pressure: "120/80", weight_kg: 55, height_cm: 165 } });
  const cl1u = await call(AS.admin, "POST", `/opd/${o1u.data.opd_ID}/close`);
  tc("[คอร์ส] ปิดเคสคอร์สครั้งเดียว → คอร์ส completed", cl1u.ok && cl1u.data?.course_completed === true);
  const rs1u2 = await call(AS.sale, "POST", "/reserves", { date: EX2, contact: { nick_name: "ครั้งเดียว" }, HN_number: c1u.data.HN_number, customer_course_ID: cc1u.data.customer_course.customer_course_ID, room_ID: "RM-003", time_start: "14:00", time_end: "15:00" });
  const o1u2 = await call(AS.recept, "POST", "/opd", { reserve_ID: rs1u2.data.reserve_ID, HN_number: c1u.data.HN_number });
  tc("[คอร์ส] เปิดเคสจากคอร์สที่ใช้ครบแล้ว → 409", o1u2.status === 409, `status ${o1u2.status}`);

  // ---------- [การเงิน] ----------
  const ccPay = await call(AS.sale, "POST", "/customer-courses", { course_ID: "CS-001", reserve_contact: { nick_name: "ผ่อน" }, first_payment: { amount: 3000, method: "cash" } });
  const overpay = await call(AS.admin, "POST", `/customer-courses/${ccPay.data.customer_course.customer_course_ID}/pay`, { amount: 999999, method: "cash" });
  tc("[การเงิน] จ่ายงวดเกินยอดค้าง → 400", overpay.status === 400, `status ${overpay.status}`);
  const zeroPay = await call(AS.admin, "POST", `/customer-courses/${ccPay.data.customer_course.customer_course_ID}/pay`, { amount: 0, method: "cash" });
  tc("[การเงิน] จ่ายงวด = 0 → 400", zeroPay.status === 400, `status ${zeroPay.status}`);
  const exp2 = await call(AS.admin, "POST", "/expenses", { category: "utility", description: "ค่าไฟ", amount: 3200, date: today, branch_ID: "BR-001" });
  tc("[การเงิน] บันทึกรายจ่ายหมวดน้ำ/ไฟ", exp2.ok);

  // ---------- [HN] ----------
  const h1 = await call(AS.recept, "POST", "/customers", { full_name: "เลขรัน1", nick_name: "รัน1" });
  const h2 = await call(AS.recept, "POST", "/customers", { full_name: "เลขรัน2", nick_name: "รัน2" });
  const seq1 = +(h1.data.HN_number.split("-").pop());
  const seq2 = +(h2.data.HN_number.split("-").pop());
  tc("[HN] เลข HN รันต่อเนื่องไม่ซ้ำ + format ถูก", seq2 === seq1 + 1, `${h1.data.HN_number} → ${h2.data.HN_number}`);

  // ---------- [ลา] เพิ่มเติม ----------
  const lvP = await call(H("BT", "US-008"), "POST", "/leaves", { type: "personal", date_from: plus(5), date_to: plus(6), reason: "ธุระ" });
  tc("[ลา] ยื่นลากิจ", lvP.ok && lvP.data?.type === "personal");
  const rej = await call(AS.admin, "PUT", `/leaves/${lvP.data.leave_ID}`, { status: "rejected", review_note: "งานยุ่ง" });
  tc("[ลา] admin ไม่อนุมัติ (rejected + เหตุผล)", rej.ok && rej.data?.status === "rejected");
  const rejAgain = await call(AS.admin, "PUT", `/leaves/${lvP.data.leave_ID}`, { status: "approved" });
  tc("[ลา] ดำเนินการคำขอที่ปิดแล้วซ้ำ → 404", rejAgain.status === 404, `status ${rejAgain.status}`);
  const mineDoc = await call(AS.doc, "GET", "/leaves");
  tc("[ลา] พนักงานเห็นเฉพาะคำขอของตัวเอง", (mineDoc.data || []).every((r) => r.user_ID === "US-005"));
  const mgrView = await call(AS.admin, "GET", "/leaves?branch_ID=BR-001");
  tc("[ลา] admin เห็นคำขอทั้งสาขา (รวมของคนอื่น)", (mgrView.data || []).some((r) => r.user_ID !== "US-002"));
  const absence = await call(AS.admin, "GET", `/leaves?branch_ID=BR-001&status=approved&from=${today}&to=${today}`);
  tc("[ลา] ดูขาดงานรายวัน (คนที่อนุมัติลาวันนี้)", absence.ok && Array.isArray(absence.data));

  // ---------- [HR] ----------
  const thrAll = await call(AS.super, "GET", `/hr/throughput?branch_ID=all&from=${today}&to=${today}`);
  tc("[HR] อัตราทำเคสรวมทุกสาขา (super_admin)", thrAll.ok && Array.isArray(thrAll.data?.rows));
  // ย้าย US-007 (มีค่ามือ 150฿ จากเคสในสาขา BR-001) ไป BR-002 แล้วเช็คว่ารายได้เดิมยังอยู่
  const earnPre = await call(H("BT", "US-007"), "GET", `/earnings?from=${today}&to=${today}`);
  const moveBranch = await call(AS.admin, "PUT", "/users/US-007", { branch_ID: "BR-002" });
  const earnPost = await call(H("BT", "US-007", "BR-002"), "GET", `/earnings?from=${today}&to=${today}`);
  tc("[HR] ย้ายพนักงานข้ามสาขา — ประวัติเงินเดิมยังอยู่ครบ", moveBranch.ok && moveBranch.data?.branch_ID === "BR-002" && earnPost.data?.total === earnPre.data?.total && earnPre.data?.total > 0, `${earnPre.data?.total} → ${earnPost.data?.total}`);
  await call(AS.admin, "PUT", "/users/US-007", { branch_ID: "BR-001" }); // ย้ายกลับ กัน screenshot HR เพี้ยน
}

// ---------------- screenshots ----------------
const USERS = {};
async function loadUsers() {
  const r = await fetch(BASE + "/api/users");
  const j = await r.json();
  for (const u of j.data) USERS[u.user_ID] = u;
}

const shots = [];
async function shot(page, name, caption) {
  await page.waitForTimeout(700);
  const file = path.join(ART, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  shots.push({ name, caption, file });
  console.log("  📸 " + name);
}

async function run() {
  await loadUsers();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1.4 });
  const page = await ctx.newPage();

  async function as(uid, branch) {
    const u = USERS[uid];
    await page.evaluate(([user, b]) => {
      localStorage.setItem("osoth_auth", JSON.stringify({ user, branch_ID: b }));
      localStorage.setItem("osoth_lang", "th");
    }, [u, branch || u.branch_ID]);
  }
  async function go(url) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
  }

  // 0) login
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "01-login", "หน้าเข้าระบบ — เลือกผู้ใช้ (mock login) มีครบทุก role");

  // 1) customer calendar (privacy + carousel + roster)
  await page.goto(BASE, { waitUntil: "networkidle" });
  await as("US-001");
  await go("/");
  await shot(page, "02-customer-calendar", "ปฏิทินหน้าร้าน — ซ่อนชื่อคนจอง (จองแล้ว), carousel รูปโปร, รายชื่อหมออยู่เวร, หัวห้องโชว์หมอ");

  // 2) sale calendar + ค้นหาลูกค้า
  await as("US-004");
  await go("/calendar");
  try {
    await page.fill('input[placeholder="HN / ชื่อ / เบอร์โทร"]', "มณี");
    await page.getByRole("button", { name: "ค้นหา" }).first().click();
    await page.waitForTimeout(700);
    await page.locator(".user-pick").first().click();
    await page.waitForTimeout(600);
  } catch {}
  await shot(page, "03-sale-calendar", "ปฏิทินฝ่ายขาย — ค้นลูกค้า เห็นคอร์สค้าง, ขายคอร์ส, จองคิว (กันจองซ้อนที่ระบบ)");

  // 3) sale calendar — คลิกคิวโชว์ Stepper สถานะ
  try {
    await page.locator(".cal-ev").first().click();
    await page.waitForTimeout(600);
  } catch {}
  await shot(page, "04-booking-stepper", "จัดการคิว — Stepper แสดงสถานะ (จองแล้ว→มาถึง→พร้อม→กำลังทำ→เสร็จ)");

  // 4) OPD — เคสกำลังทำ (stepper กลางทาง)
  await as("US-003");
  await go("/opd");
  try {
    await page.getByRole("button", { name: /ทำเคสต่อ/ }).first().click();
    await page.waitForTimeout(700);
  } catch {}
  await shot(page, "05-opd-case", "OPD หน้าห้อง — เคสกำลังทำ: Stepper ขั้นตอน, วัดตัว(บังคับ), มอบหมาย BT/หมอ, add-on, ปิดเคส");

  // 5) OPD — เคสที่ปิดแล้ว
  await go("/opd");
  try {
    await page.getByRole("button", { name: /ดูเคส/ }).first().click();
    await page.waitForTimeout(700);
  } catch {}
  await shot(page, "06-opd-closed", "OPD — เคสที่ปิดแล้ว: Stepper ครบทุกขั้น + สรุปตัด stock/ต้นทุน");

  // 6) Stock
  await as("US-002");
  await go("/stock");
  try {
    await page.getByRole("button", { name: "ดูรายขวด" }).first().click();
    await page.waitForTimeout(600);
  } catch {}
  await shot(page, "07-stock", "คลังสินค้า (แยกสาขา) — สรุปคงเหลือ cc/ครั้ง, คำเตือนหมดอายุ, ขวดรายชิ้น state");

  // 7) Courses / Promotions / Products / Procedures
  await go("/courses");
  await shot(page, "08-courses", "จัดการคอร์ส — สินค้าต่อครั้ง(โดสตายตัว), ขั้น BT/หมอ, อายุคอร์ส, ตั้งรูปคอร์ส");
  await go("/promotions");
  await shot(page, "09-promotions", "จัดการโปรโมชั่น — ส่วนลด/คอร์สโปร + ตั้งรูปแบนเนอร์ (carousel หน้าร้าน)");
  await go("/products");
  await shot(page, "10-products", "จัดการสินค้า — หน่วยใหญ่/ย่อย (sub-unit), จำนวนครั้ง/หน่วย, หมดอายุหลังเปิด");
  await go("/procedures");
  await shot(page, "11-procedures", "หัตถการ + ค่ามือ (เรทคงที่ บาท/ครั้ง) แยก BT / หมอ");

  // 8) HR — throughput + staff + schedule
  await go("/hr");
  await shot(page, "12-hr", "HR — อัตราการเข้าทำเคสต่อคน, พนักงาน (ย้ายสาขาได้ เงินคงอยู่), ตารางหมอ");

  // 9) Leaves — employee view
  await as("US-005");
  await go("/leaves");
  await shot(page, "13-leaves-mine", "ระบบลา (พนักงาน) — ยื่นลากิจ/ลาป่วย + ใบรับรองแพทย์เมื่อเกินกำหนด + คำขอของฉัน");

  // 10) Leaves — admin pending
  await as("US-002");
  await go("/leaves");
  try { await page.getByRole("button", { name: "รออนุมัติ" }).click(); await page.waitForTimeout(600); } catch {}
  await shot(page, "14-leaves-approve", "ระบบลา (admin) — อนุมัติ/ไม่อนุมัติ + ดูใบรับรองแพทย์แนบ");

  // 11) Leaves — KPI
  try { await page.getByRole("button", { name: "KPI การลา" }).click(); await page.waitForTimeout(600); } catch {}
  await shot(page, "15-leaves-kpi", "ระบบลา (admin) — KPI สรุปวันลาต่อคน (เอาไปทำ KPI)");

  // 12) Finance — charts (single branch)
  await go("/finance");
  await shot(page, "16-finance", "รายรับรายจ่าย — กราฟเส้นแนวโน้ม + กราฟวงยอดขาย/ช่องทาง + สรุป + ปุ่มบันทึก PDF");

  // 13) Finance — all branches (super_admin)
  await as("US-001");
  await go("/finance");
  try {
    await page.locator("select").last().selectOption("all");
    await page.waitForTimeout(800);
  } catch {}
  await shot(page, "17-finance-all", "รายรับรายจ่าย — รวมทุกสาขา (super_admin เลือกดูแยก/รวมได้)");

  // 14) My earnings (doctor)
  await as("US-005");
  await go("/my-earnings");
  await shot(page, "18-my-earnings", "รายได้ของฉัน (หมอ/BT/sale เห็นเฉพาะของตัวเอง)");

  await browser.close();
  return browser;
}

// ---------------- build PDF ----------------
async function buildPDF() {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  const rowsHtml = results.map((r) => `
    <tr>
      <td class="mono">${r.id}</td>
      <td>${r.name}</td>
      <td class="${r.ok ? "pass" : "fail"}">${r.ok ? "ผ่าน ✓" : "ไม่ผ่าน ✗"}</td>
    </tr>`).join("");

  const shotHtml = shots.map((s, i) => {
    const b64 = fs.readFileSync(s.file).toString("base64");
    return `
    <div class="shot">
      <div class="shot-cap"><b>รูปที่ ${i + 1}.</b> ${s.caption}</div>
      <img src="data:image/png;base64,${b64}" />
    </div>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Tahoma','Leelawadee UI',sans-serif; color:#201d1a; margin:0; font-size:12px; }
    .cover { background:linear-gradient(160deg,#241f1a,#17130f); color:#fff; padding:70px 50px; }
    .cover .mark { width:70px;height:70px;border-radius:18px;background:#b23a33;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 0 2px #e3d6b6; }
    .cover h1 { font-size:34px; margin:22px 0 6px; }
    .cover .sub { color:#e3d6b6; font-size:15px; }
    .cover .meta { margin-top:26px; color:#c9c0b0; font-size:13px; line-height:1.9; }
    .section { padding:26px 34px; }
    h2 { color:#8f2b25; border-bottom:2px solid #e3d6b6; padding-bottom:6px; font-size:18px; }
    .summary { display:flex; gap:14px; margin:16px 0; }
    .box { flex:1; border:1px solid #e7e2d8; border-top:3px solid #a5842f; border-radius:10px; padding:14px; }
    .box .n { font-size:26px; font-weight:bold; }
    .box.g .n { color:#2f7d5b; } .box.r .n { color:#b23a33; }
    table { width:100%; border-collapse:collapse; font-size:11.5px; }
    th { background:#faf8f4; text-align:left; padding:7px 9px; border-bottom:2px solid #e3d6b6; color:#5c574f; }
    td { padding:7px 9px; border-bottom:1px solid #eee; vertical-align:top; }
    td.mono { font-family:monospace; color:#8f2b25; white-space:nowrap; }
    td.pass { color:#2f7d5b; font-weight:bold; white-space:nowrap; }
    td.fail { color:#b23a33; font-weight:bold; white-space:nowrap; }
    .ts th { width:150px; background:#faf8f4; color:#8f2b25; text-align:left; vertical-align:top; border-bottom:1px solid #eee; font-weight:bold; }
    .ts td { vertical-align:top; }
    .shot { margin:0 0 22px; break-inside:avoid; page-break-inside:avoid; }
    .shot-cap { font-size:12px; margin-bottom:6px; color:#201d1a; }
    .shot img { width:100%; border:1px solid #d8d1c4; border-radius:8px; }
    .pagebreak { page-break-before:always; }
  </style></head><body>
    <div class="cover">
      <div class="mark">☯</div>
      <h1>รายงานผลการทดสอบระบบ — โอสถ (OSOTH)</h1>
      <div class="sub">ERP คลินิคเสริมความงาม · Test Function Report</div>
      <div class="meta">
        วันที่ทดสอบ: ${today}<br/>
        ขอบเขต: ปฏิทิน/จองคิว · OPD/ปิดเคส · คลังสินค้า(sub-unit/FIFO) · การเงิน+กราฟ · HR · ระบบลา · สิทธิ์ตาม role · หลายสาขา<br/>
        วิธีทดสอบ: ยิง API จริงตรวจ logic + ขับเบราว์เซอร์จริง (Playwright) เก็บ screenshot หน้าเว็บ<br/>
        ผลรวม: <b style="color:#8fd6a0">${pass} ผ่าน</b> / ${fail} ไม่ผ่าน จาก ${results.length} เคส
      </div>
    </div>

    <div class="section">
      <h2>1. ข้อมูลระบบ &amp; Tech Stack</h2>
      <table class="ts">
        <tr><th>Framework</th><td><b>Next.js 16.2</b> (App Router · fullstack: frontend + API routes · Turbopack)</td></tr>
        <tr><th>UI</th><td><b>React 19.2</b></td></tr>
        <tr><th>Database</th><td><b>MongoDB</b> + <b>Mongoose 9.7</b> (ODM)</td></tr>
        <tr><th>Client state</th><td><b>Redux Toolkit 2.12</b> + react-redux 9.3 (auth mock + ภาษา)</td></tr>
        <tr><th>ภาษาโปรแกรม</th><td>JavaScript (ไม่ใช้ TypeScript)</td></tr>
        <tr><th>สถาปัตยกรรม</th><td><b>MVC</b> — models/ (schema) · services/ (business logic: closeCase, FIFO, กันจองซ้อน) · app/api/ (controller + role guard) · app/*/page.js (view)</td></tr>
        <tr><th>ฟอนต์</th><td>Kanit + IBM Plex Sans Thai (next/font/google)</td></tr>
        <tr><th>Styling</th><td>CSS ล้วน (globals.css) — ไม่ใช้ Tailwind / CSS-in-JS</td></tr>
        <tr><th>กราฟ</th><td>SVG เขียนเอง (ไม่พึ่ง chart library)</td></tr>
        <tr><th>PDF (ในแอป)</th><td>window.print() + @media print CSS</td></tr>
        <tr><th>i18n</th><td>dictionary ไทย/อังกฤษ (custom hook useT)</td></tr>
        <tr><th>Auth</th><td>mock (localStorage + header x-user-id/role/branch) — โครงสร้างเผื่อ NextAuth</td></tr>
        <tr><th>Deploy</th><td><b>Docker</b> + docker-compose (app + mongo · node:22-alpine)</td></tr>
        <tr><th>เครื่องมือทดสอบ</th><td><b>Playwright</b> (Chromium) — E2E screenshot + สร้าง PDF · ESLint 9</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>2. สรุปผล</h2>
      <div class="summary">
        <div class="box"><div class="n">${results.length}</div><div>เคสทดสอบทั้งหมด</div></div>
        <div class="box g"><div class="n">${pass}</div><div>ผ่าน</div></div>
        <div class="box r"><div class="n">${fail}</div><div>ไม่ผ่าน</div></div>
      </div>
      <h2 style="margin-top:24px">3. รายการทดสอบฟังก์ชัน (Functional Test Cases)</h2>
      <table><thead><tr><th style="width:60px">รหัส</th><th>รายการทดสอบ</th><th style="width:90px">ผล</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
    </div>

    <div class="section pagebreak">
      <h2>4. ภาพหน้าจอการใช้งานจริง (Screenshots)</h2>
      ${shotHtml}
    </div>
  </body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({ path: OUT, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
  await browser.close();
  console.log(`\n📄 สร้าง PDF: ${OUT}`);
  console.log(`ผลรวม: ${pass}/${results.length} ผ่าน`);
}

await populate();
await extraTests();
await run();
await buildPDF();
