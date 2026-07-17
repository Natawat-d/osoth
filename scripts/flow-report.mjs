// flow_report.pdf (ฉบับละเอียดที่สุด) — แต่ละขั้นมี: รายละเอียด · API · กติกา · ตารางผลตรวจสอบจริง ·
// ข้อมูลที่เปลี่ยนใน DB · ภาพหน้าจอจริง  + ภาคผนวก (collections, state machines, สูตรเงิน, role matrix, stack)
// ต้อง: seed ใหม่ก่อน + dev server รันอยู่ (localhost:3000)
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
const BASE = "http://localhost:3000";
const OUT = path.resolve("..", "flow_report.pdf");

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n) => { const x = new Date(d.getTime() + n * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

const H = (role, uid, branch = "BR-001") => ({ "Content-Type": "application/json", "x-user-id": uid, "x-user-role": role, "x-branch-id": branch });
const AS = { super: H("super_admin", "US-001"), admin: H("admin", "US-002"), recept: H("acception", "US-003"), sale: H("sale", "US-004"), doc: H("doctor", "US-005") };
async function call(headers, method, p, body) {
  const r = await fetch(BASE + "/api" + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
function svgURI(title, sub, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><rect x='24' y='24' width='752' height='552' fill='none' stroke='#e3d6b6' stroke-width='6'/><text x='400' y='250' font-family='Tahoma' font-size='120' fill='#e3d6b6' text-anchor='middle'>☯</text><text x='400' y='390' font-family='Tahoma' font-size='58' font-weight='bold' fill='#fff' text-anchor='middle'>${title}</text><text x='400' y='450' font-family='Tahoma' font-size='34' fill='#f0e0d0' text-anchor='middle'>${sub}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function chk(label, ok, expected, actual) { return { label, ok: !!ok, expected: String(expected), actual: String(actual) }; }

const steps = [];
let ctx, page, shotN = 0;
async function as(uid, users, branch) {
  const u = users[uid];
  await page.evaluate(([user, b]) => { localStorage.setItem("osoth_auth", JSON.stringify({ user, branch_ID: b })); localStorage.setItem("osoth_lang", "th"); }, [u, branch || u.branch_ID]);
}
async function go(url) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sidebar", { timeout: 15000 }).catch(() => {});
  await page.waitForSelector(".content .card, .content .cal-wrap, .content table, .content .stats", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1300);
}
async function capture() {
  await page.waitForTimeout(250);
  const buf = await page.screenshot({ fullPage: true });
  try { fs.writeFileSync(`test-artifacts/flow-${++shotN}.png`, buf); } catch {}
  return buf.toString("base64");
}
function addStep(s) { steps.push(s); const ok = s.checks.every((c) => c.ok); console.log(`${ok ? "✓" : "✗"} ${s.num}. ${s.title} (${s.checks.filter((c) => c.ok).length}/${s.checks.length})`); }

async function main() {
  await call(AS.admin, "PUT", "/promotions/PM-001", { banner_image: svgURI("โปรตรุษจีน ลด 10%", "Botox หน้าเรียว · ถึง 15 ก.ย.", "#b23a33", "#7a1e19") });
  await call(AS.admin, "PUT", "/courses/CS-002", { image: svgURI("คอร์สทรีตเมนต์ผิวใส", "10 ครั้ง · พิเศษ", "#a5842f", "#6e560f") });
  const usersRes = await fetch(BASE + "/api/users").then((r) => r.json());
  const users = Object.fromEntries(usersRes.data.map((u) => [u.user_ID, u]));

  const browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1.25 });
  page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  ⚠ pageerror:", e.message));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  // ===== 1. ขายคอร์ส + ผ่อนชำระ =====
  const s1 = await call(AS.sale, "POST", "/customer-courses", { course_ID: "CS-001", reserve_contact: { nick_name: "มณี", phone: "0810000001" }, first_payment: { amount: 5000, method: "transfer" } });
  const cc1 = s1.data?.customer_course;
  await as("US-004", users); await go("/calendar");
  addStep({
    num: 1, title: "ขายคอร์ส + ผ่อนชำระ", actor: "Sale (ฝ่ายขาย)",
    narrative: "ฝ่ายขายเลือกคอร์สให้ลูกค้า จ่ายงวดแรกได้ (ผ่อนชำระ) ระบบบันทึกสิทธิ์คงเหลือ + snapshot คอร์ส (กันแก้ catalog ย้อนหลัง) และคิดคอมมิชชั่นให้ sale อัตโนมัติจาก % ที่ตั้งไว้ที่ตัวพนักงาน",
    apis: [`POST /api/customer-courses`, `  body: { course_ID:"CS-001", reserve_contact:{nick_name,phone}, first_payment:{ amount:5000, method:"transfer" } }`],
    rules: ["ผ่อนชำระได้ (บันทึก balance_due)", "คอม = total_price × user.commission_rate% (snapshot ณ วันขาย)", "เก็บ course_snapshot กันข้อมูลเพี้ยนภายหลัง", "ถือหลายคอร์สพร้อมกันได้ (ไม่จำกัด)"],
    db: ["customer_course (สร้าง: uses_total=5, uses_remaining=5, status=active)", "payment (course_purchase 5,000฿ transfer)", "staff_earning (commission ให้ US-004)"],
    checks: [
      chk("ราคาเต็มคอร์ส", cc1?.total_price === 15000, "15,000฿", `${cc1?.total_price}฿`),
      chk("จ่ายงวดแรก", cc1?.paid_amount === 5000, "5,000฿", `${cc1?.paid_amount}฿`),
      chk("ยอดค้าง", cc1?.balance_due === 10000, "10,000฿", `${cc1?.balance_due}฿`),
      chk("สถานะชำระ", cc1?.payment_status === "partial", "partial", `${cc1?.payment_status}`),
      chk("เรทคอม sale", cc1?.commission_rate === 5, "5%", `${cc1?.commission_rate}%`),
      chk("ยอดคอม", cc1?.commission_amount === 750, "750฿", `${cc1?.commission_amount}฿`),
      chk("สิทธิ์คงเหลือ", cc1?.uses_remaining === 5, "5 ครั้ง", `${cc1?.uses_remaining} ครั้ง`),
    ],
    b64: await capture(),
  });

  // ===== 2. จองคิว =====
  const mk = (b) => call(AS.sale, "POST", "/reserves", { date: today, ...b });
  const r1 = await mk({ contact: { nick_name: "มณี", phone: "0810000001" }, customer_course_ID: cc1.customer_course_ID, room_ID: "RM-002", doctor_ID: "US-006", time_start: "13:00", time_end: "14:00" });
  const rWalk = await mk({ contact: { nick_name: "นภา" }, room_ID: "RM-003", time_start: "11:00", time_end: "12:30", is_walk_in: true });
  await mk({ contact: { nick_name: "ฟ้า" }, room_ID: "RM-002", doctor_ID: "US-006", time_start: "15:00", time_end: "16:00" });
  const dayList = await call(AS.sale, "GET", `/reserves?branch_ID=BR-001&date=${today}`);
  await as("US-001", users); await go("/");
  addStep({
    num: 2, title: "จองคิวลงปฏิทิน", actor: "Sale · แสดงผลหน้าร้าน (privacy)",
    narrative: "จองคิวเลือกห้อง/หมอ/เวลา · จองได้ก่อนมี HN (ใช้ชื่อ+เบอร์) · รองรับ walk-in · แกน y=เวลา แกน x=ห้อง · หน้าร้าน (ลูกค้า) ซ่อนชื่อคนจองเป็น 'จองแล้ว' และโชว์หมอที่อยู่เวรตามตาราง HR",
    apis: [`POST /api/reserves × 3`, `  body: { date, contact, customer_course_ID?, room_ID, doctor_ID?, time_start, time_end, is_walk_in? }`, `GET  /api/reserves?branch_ID=BR-001&date=${today}`],
    rules: ["จองก่อนมี HN ได้ (ผูก HN ตอน OPD)", "แปลงเป็น unix_start/end เพื่อ query ช่วงเวลา", "หน้าร้าน privacy: ไม่โชว์ชื่อคนจอง", "หมออยู่เวร resolve จาก doctor_schedule (weekly + override)"],
    db: ["reserve × 3 (status=booked, status_history เริ่มต้น)"],
    checks: [
      chk("จองคิวหลักสำเร็จ", r1.ok && r1.data?.status === "booked", "booked", `${r1.data?.status}`),
      chk("บันทึก walk-in", rWalk.data?.is_walk_in === true, "true", `${rWalk.data?.is_walk_in}`),
      chk("จำนวนคิววันนี้", (dayList.data || []).length === 3, "3 คิว", `${(dayList.data || []).length} คิว`),
      chk("มี unix time สำหรับ query", typeof r1.data?.unix_start === "number", "number", typeof r1.data?.unix_start),
    ],
    b64: await capture(),
  });

  // ===== 3. กันจองซ้อน =====
  const clash = await mk({ contact: { nick_name: "ซ้อน" }, room_ID: "RM-002", time_start: "13:30", time_end: "14:30" });
  const clashDoc = await mk({ contact: { nick_name: "หมอซ้อน" }, room_ID: "RM-003", doctor_ID: "US-006", time_start: "13:30", time_end: "14:30" });
  const backToBack = await mk({ contact: { nick_name: "ต่อเวลา" }, room_ID: "RM-002", time_start: "14:00", time_end: "15:00" });
  await as("US-004", users); await go("/calendar");
  try {
    await page.locator("select").nth(2).selectOption("RM-002");
    await page.locator('input[type="time"]').nth(0).fill("13:30");
    await page.locator('input[type="time"]').nth(1).fill("14:30");
    await page.getByRole("button", { name: "จองคิว" }).click();
    await page.waitForSelector(".err", { timeout: 3000 });
  } catch {}
  addStep({
    num: 3, title: "กันจองซ้อน (ห้อง / หมอ ทับเวลา)", actor: "ระบบ (บังคับที่ API)",
    narrative: "ก่อน insert ทุกครั้งระบบตรวจการทับเวลา — ทั้งห้องเดียวกัน และหมอคนเดียว (คนละห้องก็ห้าม) นับเฉพาะคิวที่ยังมีผล (booked/arrived/ready/in_progress) การต่อเวลาพอดี (จบ=เริ่ม) ไม่ถือว่าซ้อน",
    apis: [`POST /api/reserves (RM-002 13:30–14:30 → ทับ 13:00–14:00)`, `POST /api/reserves (หมอ US-006 คนละห้อง เวลาทับ)`, `POST /api/reserves (RM-002 14:00–15:00 ต่อเวลาพอดี)`],
    rules: ["ห้องเดียวกัน + เวลา overlap → 409", "หมอคนเดียว + เวลา overlap (คนละห้อง) → 409", "จบ=เริ่ม ไม่ถือว่า overlap", "หน้าจอแสดงข้อความ error พร้อมเลขคิวที่ชน"],
    db: ["ไม่มีการเขียน (คำขอที่ชนถูกปฏิเสธ)"],
    checks: [
      chk("ห้องซ้อน → ปฏิเสธ", clash.status === 409, "HTTP 409", `HTTP ${clash.status}`),
      chk("หมอซ้อน (คนละห้อง) → ปฏิเสธ", clashDoc.status === 409, "HTTP 409", `HTTP ${clashDoc.status}`),
      chk("ต่อเวลาพอดี → อนุญาต", backToBack.ok, "HTTP 200", `HTTP ${backToBack.status}`),
      chk("มีข้อความอ้างเลขคิวที่ชน", /RS-/.test(clash.error || ""), "ระบุ RS-xxxx", esc((clash.error || "").slice(0, 40))),
    ],
    b64: await capture(),
  });

  // ===== 4. มาถึง + HN + เปิดเคส =====
  const arrived = await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { status: "arrived" });
  const cust = await call(AS.recept, "POST", "/customers", { full_name: "มณี", sure_name: "รัตนดี", nick_name: "มณี", phone: "0810000001" });
  await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { HN_number: cust.data.HN_number });
  const opd = await call(AS.recept, "POST", "/opd", { reserve_ID: r1.data.reserve_ID, HN_number: cust.data.HN_number });
  await as("US-003", users); await go("/opd");
  addStep({
    num: 4, title: "ลูกค้ามาถึง → สร้าง HN → เปิดเคส OPD", actor: "Acception (ต้อนรับ)",
    narrative: "เปลี่ยนสถานะคิวเป็น 'มาถึง' · ลูกค้าใหม่รัน HN ใหม่ (format ตั้งค่าได้: prefix-ปีพ.ศ.-เลขรัน) · เปิดเคส OPD และผูก HN ย้อนหลังเข้าคอร์สที่ซื้อไว้ก่อนมี HN",
    apis: [`PUT  /api/reserves/${r1.data.reserve_ID}  { status:"arrived" }`, `POST /api/customers  { full_name, sure_name, nick_name, phone }`, `PUT  /api/reserves/${r1.data.reserve_ID}  { HN_number }`, `POST /api/opd  { reserve_ID, HN_number }`],
    rules: ["HN format config ได้ (system_config.hn_format)", "เลข HN รันต่อเนื่องไม่ซ้ำ (counter atomic)", "ผูก HN เข้า customer_course ที่ยังไม่มี HN", "session_no = ครั้งที่เท่าไรของคอร์ส"],
    db: ["reserve.status → arrived (+ status_history)", "customer (สร้าง HN ใหม่)", "customer_course.HN_number (ผูกย้อนหลัง)", "opd (สร้าง, status=open)"],
    checks: [
      chk("เปลี่ยนสถานะเป็นมาถึง", arrived.data?.status === "arrived", "arrived", `${arrived.data?.status}`),
      chk("HN format ถูกต้อง", /^HN-\d{4}-\d{4}$/.test(cust.data?.HN_number || ""), "HN-ปี-เลข4หลัก", `${cust.data?.HN_number}`),
      chk("เปิดเคสสำเร็จ", opd.ok, "HTTP 200", `HTTP ${opd.status}`),
      chk("ครั้งที่ของคอร์ส", opd.data?.session_no === 1, "ครั้งที่ 1", `ครั้งที่ ${opd.data?.session_no}`),
      chk("เคสสถานะเริ่มต้น", opd.data?.status === "open", "open", `${opd.data?.status}`),
    ],
    b64: await capture(),
  });

  // ===== 5. วัดตัว (บังคับ) =====
  const early = await call(AS.admin, "POST", `/opd/${opd.data.opd_ID}/close`);
  const meas = await call(AS.recept, "PUT", `/opd/${opd.data.opd_ID}`, { opd_data: { blood_pressure: "118/76", weight_kg: 52, height_cm: 160, heart_rate: 72 }, BT_ID: "US-007" });
  await as("US-003", users); await go("/opd");
  try { await page.getByRole("button", { name: /ทำเคสต่อ/ }).first().click(); await page.waitForTimeout(800); } catch {}
  addStep({
    num: 5, title: "วัดสัญญาณชีพ (บังคับทุกครั้ง)", actor: "Acception",
    narrative: "ต้องวัดความดัน/น้ำหนัก/ส่วนสูงก่อนเสมอ ระบบจะไม่ยอมให้ปิดเคสถ้ายังไม่วัด (บังคับที่ทั้ง API และ UI) · Stepper บนหน้าจอแสดงความคืบหน้าเคสให้ชัด",
    apis: [`POST /api/opd/${opd.data.opd_ID}/close  → ถูกปฏิเสธ (ยังไม่วัด)`, `PUT  /api/opd/${opd.data.opd_ID}  { opd_data:{ blood_pressure, weight_kg, height_cm, heart_rate }, BT_ID }`],
    rules: ["ปิดเคสก่อนวัดตัว → 400", "บันทึก measured_by + measured_at อัตโนมัติ", "เคสเดินสถานะ open → measuring", "มอบหมาย BT ได้พร้อมกัน"],
    db: ["opd.opd_data (วัดตัว + measured_at)", "opd.status → measuring", "opd.BT_ID"],
    checks: [
      chk("ปิดก่อนวัด → ปฏิเสธ", early.status === 400, "HTTP 400", `HTTP ${early.status}`),
      chk("บันทึกการวัดตัว", meas.ok && !!meas.data?.opd_data?.measured_at, "มี measured_at", meas.data?.opd_data?.measured_at ? "✓" : "✗"),
      chk("สถานะเดินเป็น measuring", meas.data?.status === "measuring", "measuring", `${meas.data?.status}`),
      chk("มอบหมาย BT", meas.data?.BT_ID === "US-007", "US-007", `${meas.data?.BT_ID}`),
    ],
    b64: await capture(),
  });

  // ===== 6. บันทึกหัตถการ + add-on =====
  const proc = await call(AS.admin, "PUT", `/opd/${opd.data.opd_ID}`, { procedures_done: [
    { medical_procedure_ID: "MP-002", name: "เตรียมผิว/แปะยาชา", type: "BT", performed_by: "US-007", cost: 150 },
    { medical_procedure_ID: "MP-001", name: "ฉีด Botox", type: "doctor", performed_by: "US-006", cost: 500 },
  ] });
  const addon = await call(AS.recept, "POST", `/opd/${opd.data.opd_ID}/addon`, { product_ID: "PD-003", qty: 1, method: "cash" });
  await as("US-003", users); await go("/opd");
  try { await page.getByRole("button", { name: /ทำเคสต่อ/ }).first().click(); await page.waitForTimeout(800); } catch {}
  addStep({
    num: 6, title: "บันทึกหัตถการ (BT + หมอ) + Add-on", actor: "Acception / หมอ / BT",
    narrative: "บันทึกหัตถการที่ทำจริงตามสูตรคอร์ส (ขั้น BT และขั้นหมอ ข้ามได้ตามชนิดคอร์ส) · add-on = ลูกค้าทำเพิ่มหน้างานทั้งที่ซื้อคอร์สไปแล้ว → เก็บเงินทันทีแยกบิล ไม่ยุ่งกับเงินคอร์ส",
    apis: [`PUT  /api/opd/${opd.data.opd_ID}  { procedures_done:[{BT 150฿}, {doctor 500฿}] }`, `POST /api/opd/${opd.data.opd_ID}/addon  { product_ID:"PD-003", qty:1, method:"cash" }`],
    rules: ["ค่ามือเรทคงที่ต่อครั้ง (บาท)", "add-on เก็บเงินทันที แยกบิล (payment แยก)", "ราคา add-on = product.selling_price × qty", "ผูก add-on กับ OPD ครั้งนั้น"],
    db: ["opd.procedures_done[] (BT + doctor)", "payment (add_on แยกบิล)", "opd.add_ons[]"],
    checks: [
      chk("บันทึก 2 หัตถการ", (proc.data?.procedures_done || []).length === 2, "2 รายการ", `${(proc.data?.procedures_done || []).length} รายการ`),
      chk("add-on แยกบิล + ราคา", addon.ok && addon.data?.price === 900, "900฿", `${addon.data?.price}฿`),
      chk("add-on ออก payment id", /PAY-/.test(addon.data?.payment?.payment_ID || ""), "PAY-xxxx", esc(addon.data?.payment?.payment_ID || "")),
    ],
    b64: await capture(),
  });

  // ===== 7. ปิดเคส atomic =====
  const closed = await call(AS.admin, "POST", `/opd/${opd.data.opd_ID}/close`);
  const closedAgain = await call(AS.admin, "POST", `/opd/${opd.data.opd_ID}/close`);
  await as("US-003", users); await go("/opd");
  try { await page.getByRole("button", { name: /ดูเคส/ }).first().click(); await page.waitForTimeout(800); } catch {}
  const su = closed.data?.stock_used?.[0] || {};
  addStep({
    num: 7, title: "ปิดเคส — Atomic Operation (5 ขั้นในครั้งเดียว) ★", actor: "Admin / Acception",
    narrative: "หัวใจของระบบ — กด 'ปิดเคส' ครั้งเดียว ระบบทำ 5 อย่างในทรานแซกชันเดียว (rollback ได้เมื่อ mongo เป็น replica set) ปิดซ้ำไม่ได้",
    apis: [`POST /api/opd/${opd.data.opd_ID}/close`, `POST /api/opd/${opd.data.opd_ID}/close  (ครั้งที่ 2 → ปฏิเสธ)`],
    rules: ["① ตัด stock FIFO (in_use ก่อน unused · lot หมดอายุก่อนถูกหยิบก่อน)", "② อัปเดตขวด: ลด cc/ครั้ง + state + วันหมดอายุหลังเปิด + usage_log", "③ customer_course.uses_remaining −1 (ครบ → completed)", "④ สร้าง staff_earning ค่ามือหมอ/BT", "⑤ reserve→done, opd→closed + บันทึกต้นทุนจริงตาม lot", "เฉพาะ admin/acception · ปิดซ้ำ → 409"],
    db: ["inventory_item (cc/uses/state/usage_log)", "customer_course.uses_remaining", "staff_earning × 2 (หมอ+BT)", "reserve.status=done · opd.status=closed · opd.stock_used"],
    checks: [
      chk("ปิดเคสสำเร็จ", closed.ok, "HTTP 200", `HTTP ${closed.status}`),
      chk("ตัดจาก lot แรก (FIFO)", su.lot_ID === "LOT-00001", "LOT-00001", `${su.lot_ID}`),
      chk("ปริมาณที่ตัด", su.cc_used === 2, "2cc", `${su.cc_used}cc`),
      chk("ต้นทุนจริงตาม lot", su.cost_of_goods === 700, "700฿ (3500×2/10)", `${su.cost_of_goods}฿`),
      chk("คอร์สเหลือหลังใช้", closed.data?.uses_remaining === 4, "4 ครั้ง", `${closed.data?.uses_remaining} ครั้ง`),
      chk("สร้างค่ามือ", closed.data?.earnings_created === 2, "2 รายการ", `${closed.data?.earnings_created} รายการ`),
      chk("ปิดซ้ำ → ปฏิเสธ", closedAgain.status === 409, "HTTP 409", `HTTP ${closedAgain.status}`),
    ],
    b64: await capture(),
  });

  // ===== 8. คลังสินค้าอัปเดต =====
  const items = await call(AS.admin, "GET", "/stock/items?branch_ID=BR-001&product_ID=PD-001");
  const inUse = (items.data || []).find((i) => i.state === "in_use");
  const unusedCnt = (items.data || []).filter((i) => i.state === "unused").length;
  await as("US-002", users); await go("/stock");
  try { await page.getByRole("button", { name: "ดูรายขวด" }).first().click(); await page.waitForTimeout(700); } catch {}
  addStep({
    num: 8, title: "คลังสินค้าอัปเดต (sub-unit tracking)", actor: "ระบบ / Admin ตรวจสอบ",
    narrative: "ขวดที่ถูกใช้เปลี่ยนสถานะเป็น 'ใช้งานแล้ว' (in_use) และเหลือทั้งจำนวนครั้งและปริมาณ cc ตามจริง · เริ่มนับวันหมดอายุหลังเปิดขวด (เตือน ไม่บังคับทิ้ง) · stock แยกแต่ละสาขา",
    apis: [`GET /api/stock/items?branch_ID=BR-001&product_ID=PD-001`],
    rules: ["1 ขวด track ทั้งครั้งและ cc (sub-unit)", "เปิดขวด → state in_use + open_expiry_at", "ใช้หมด → empty", "FIFO ใช้ขวดเปิดแล้วก่อน"],
    db: ["inventory_item ขวดที่ถูกตัด: state=in_use, cc_remaining=8, uses_remaining=4, open_expiry_at set, usage_log +1"],
    checks: [
      chk("มีขวดสถานะใช้งานแล้ว", !!inUse, "in_use พบ", inUse ? "✓" : "✗"),
      chk("ปริมาณคงเหลือ", inUse?.cc_remaining === 8, "8cc (10−2)", `${inUse?.cc_remaining}cc`),
      chk("จำนวนครั้งคงเหลือ", inUse?.uses_remaining === 4, "4 ครั้ง (5−1)", `${inUse?.uses_remaining} ครั้ง`),
      chk("เริ่มนับวันหมดอายุหลังเปิด", !!inUse?.open_expiry_at, "มีวันที่", inUse?.open_expiry_at ? "✓" : "✗"),
      chk("ขวดที่ยังไม่เปิด", unusedCnt === 5, "5 ขวด", `${unusedCnt} ขวด`),
    ],
    b64: await capture(),
  });

  // ===== 9. การเงิน =====
  const fin = await call(AS.admin, "GET", `/finance/summary?branch_ID=BR-001&from=${today}&to=${today}`);
  await as("US-002", users); await go("/finance");
  addStep({
    num: 9, title: "การเงิน — กราฟ + ต้นทุนจริง + แยก/รวมสาขา", actor: "Admin / Super Admin",
    narrative: "สรุปผลจากข้อมูลจริงของทุกเคส: รายรับจาก payment จริง − ต้นทุนจริงตาม lot ที่ตัด − ค่ามือ/คอม − รายจ่ายอื่น = กำไร · มีกราฟเส้นแนวโน้มรายวัน + กราฟวง (ยอดขายคอร์ส/ช่องทาง/ประเภท) · super_admin ดูแยกหรือรวมทุกสาขาได้ · บันทึกเป็น PDF ได้",
    apis: [`GET /api/finance/summary?branch_ID=BR-001&from=${today}&to=${today}`, `GET /api/finance/summary?branch_ID=all  (รวมทุกสาขา — super_admin)`],
    rules: ["COGS = ต้นทุนจริงของ lot ที่ถูกตัด (ไม่ใช่ค่าเฉลี่ย)", "รายรับแยกช่องทาง (สด/โอน/บัตร) และประเภท", "กราฟ SVG เขียนเอง ไม่พึ่ง library", "ลูกหนี้ค้างผ่อน = Σ balance_due"],
    db: ["อ่านอย่างเดียว (payment + opd.stock_used + staff_earning + expense + customer_course)"],
    checks: [
      chk("รายรับ (งวดแรก + add-on)", fin.data?.income === 5900, "5,900฿", `${fin.data?.income}฿`),
      chk("ต้นทุนสินค้า (จริงตาม lot)", fin.data?.cogs === 700, "700฿", `${fin.data?.cogs}฿`),
      chk("ค่ามือ + คอม", fin.data?.labor_cost === 1400, "1,400฿ (650+750)", `${fin.data?.labor_cost}฿`),
      chk("มี time-series (กราฟเส้น)", Array.isArray(fin.data?.series) && fin.data.series.length > 0, "มีข้อมูล", `${fin.data?.series?.length} วัน`),
      chk("ยอดขายแยกคอร์ส (กราฟวง)", (fin.data?.sales_by_course || []).length >= 1, "≥1 คอร์ส", `${(fin.data?.sales_by_course || []).length} คอร์ส`),
      chk("เคสที่ปิด", fin.data?.cases_closed === 1, "1 เคส", `${fin.data?.cases_closed} เคส`),
    ],
    b64: await capture(),
  });

  // ===== 10. รายได้ของฉัน (สิทธิ์) =====
  const earnDoc = await call(H("doctor", "US-006"), "GET", `/earnings?from=${today}&to=${today}`);
  const finAsDoc = await call(H("doctor", "US-006"), "GET", `/finance/summary?branch_ID=BR-001`);
  await as("US-006", users); await go("/my-earnings");
  addStep({
    num: 10, title: "รายได้ของฉัน + การควบคุมสิทธิ์ (RBAC)", actor: "หมอ / BT / Sale",
    narrative: "หมอ/BT/sale เห็นรายได้เฉพาะของตัวเองเท่านั้น (บังคับที่ API ไม่ใช่แค่ซ่อน UI) · หน้าการเงินรวมเปิดได้เฉพาะ admin/super_admin · ประวัติเงินผูกกับ user_ID ดังนั้นย้ายสาขาแล้วเงินเดิมยังอยู่",
    apis: [`GET /api/earnings?from=${today}&to=${today}  (เป็นหมอ US-006)`, `GET /api/finance/summary  (หมอเปิดหน้าการเงินรวม → ปฏิเสธ)`],
    rules: ["role หมอ/BT/sale → query ได้เฉพาะ user_ID ตัวเอง (บังคับที่ server)", "หน้าการเงินรวม = สิทธิ์ finance เท่านั้น", "earning ผูก user_ID → ย้ายสาขาเงินเดิมคงอยู่"],
    db: ["อ่านอย่างเดียว (staff_earning ของตัวเอง)"],
    checks: [
      chk("หมอเห็นรายได้ตัวเอง", earnDoc.data?.user_ID === "US-006", "US-006", `${earnDoc.data?.user_ID}`),
      chk("ยอดค่ามือจากเคส", earnDoc.data?.total === 500, "500฿ (ฉีด Botox)", `${earnDoc.data?.total}฿`),
      chk("หมอเปิดการเงินรวม → ปฏิเสธ", finAsDoc.status === 403, "HTTP 403", `HTTP ${finAsDoc.status}`),
    ],
    b64: await capture(),
  });

  // ===== 11. ระบบลา =====
  const lv = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: today, date_to: today, reason: "ไข้หวัด" });
  const lvOver = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: plus(3), date_to: plus(7), reason: "ผ่าตัด" });
  const cert = svgURI("ใบรับรองแพทย์", "รพ.ตัวอย่าง", "#2f5d4a", "#1b3a2e");
  const lvCert = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: plus(3), date_to: plus(7), reason: "ผ่าตัด", medical_cert: cert });
  const appr = await call(AS.admin, "PUT", `/leaves/${lv.data.leave_ID}`, { status: "approved" });
  await call(H("BT", "US-007"), "POST", "/leaves", { type: "personal", date_from: today, date_to: today, reason: "ธุระ" });
  await as("US-002", users); await go("/leaves");
  try { await page.getByRole("button", { name: "รออนุมัติ" }).click(); await page.waitForTimeout(700); } catch {}
  addStep({
    num: 11, title: "ระบบลา — ยื่น / อนุมัติ / ใบรับรองแพทย์ / KPI", actor: "พนักงาน (ยื่น) · Admin (อนุมัติ)",
    narrative: "พนักงานยื่นลากิจ/ลาป่วยให้ admin อนุมัติ · ลาป่วยเกินกำหนด (config: sick_cert_threshold_days=2) ต้องแนบใบรับรองแพทย์ · admin ดูขาดงานรายวัน + KPI สรุปวันลาต่อคน",
    apis: [`POST /api/leaves  { type:"sick", 1 วัน }`, `POST /api/leaves  { type:"sick", 5 วัน ไม่มีใบรับรอง → ปฏิเสธ }`, `POST /api/leaves  { type:"sick", 5 วัน + medical_cert → ผ่าน }`, `PUT  /api/leaves/{id}  { status:"approved" }`],
    rules: ["พนักงานยื่นให้ตัวเองเท่านั้น (server บังคับ user_ID)", "ลาป่วย > threshold วัน & ไม่มีใบรับรอง → 400", "อนุมัติ/ไม่อนุมัติได้เฉพาะ manager", "พนักงานเห็นแค่ของตัวเอง · admin เห็นทั้งสาขา"],
    db: ["leave_request (สร้าง status=pending → approved)", "medical_cert (data URL) เมื่อแนบ"],
    checks: [
      chk("ยื่นลาป่วย 1 วัน", lv.ok && lv.data?.status === "pending", "pending", `${lv.data?.status}`),
      chk("ลาเกินกำหนดไม่มีใบ → ปฏิเสธ", lvOver.status === 400, "HTTP 400", `HTTP ${lvOver.status}`),
      chk("ลาเกินกำหนด + แนบใบ → ผ่าน", lvCert.ok, "HTTP 200", `HTTP ${lvCert.status}`),
      chk("admin อนุมัติ", appr.data?.status === "approved", "approved", `${appr.data?.status}`),
    ],
    b64: await capture(),
  });

  await browser.close();
  return fin;
}

// ---------------- build PDF ----------------
function stepCard(s) {
  const stepOk = s.checks.every((c) => c.ok);
  const checksRows = s.checks.map((c) => `<tr><td>${esc(c.label)}</td><td class="exp">${esc(c.expected)}</td><td class="act">${esc(c.actual)}</td><td class="${c.ok ? "ok" : "no"}">${c.ok ? "✓" : "✗"}</td></tr>`).join("");
  const apis = s.apis.map((a) => esc(a)).join("<br/>");
  const rules = s.rules.map((r) => `<li>${esc(r)}</li>`).join("");
  const db = s.db.map((r) => `<li>${esc(r)}</li>`).join("");
  return `
  <div class="step">
    <div class="s-head"><span class="s-num">${s.num}</span><span class="s-title">${esc(s.title)}</span>
      <span class="s-actor">${esc(s.actor)}</span>
      <span class="s-badge ${stepOk ? "ok" : "no"}">${stepOk ? "ผ่าน ✓" : "ไม่ผ่าน ✗"}</span></div>
    <div class="s-narr">${esc(s.narrative)}</div>
    <div class="grid2">
      <div class="col">
        <div class="h4">API ที่เรียก</div><pre>${apis}</pre>
        <div class="h4">กติกาธุรกิจที่บังคับ</div><ul>${rules}</ul>
        <div class="h4">ข้อมูลที่เปลี่ยนใน DB</div><ul>${db}</ul>
      </div>
      <div class="col">
        <div class="h4">ผลตรวจสอบจริง (${s.checks.filter((c) => c.ok).length}/${s.checks.length})</div>
        <table class="chk"><thead><tr><th>รายการ</th><th>คาดหวัง</th><th>จริง</th><th></th></tr></thead><tbody>${checksRows}</tbody></table>
      </div>
    </div>
    <div class="h4">ภาพหน้าจอจริงจากแอป</div>
    <img src="data:image/png;base64,${s.b64}" />
  </div>`;
}

function buildHTML(fin) {
  const totalChecks = steps.reduce((a, s) => a + s.checks.length, 0);
  const passChecks = steps.reduce((a, s) => a + s.checks.filter((c) => c.ok).length, 0);
  const passSteps = steps.filter((s) => s.checks.every((c) => c.ok)).length;

  const collections = [
    ["branch", "สาขา (multi-branch)"], ["room", "ห้องทำหัตถการ (config ได้)"], ["user", "พนักงาน 6 role"],
    ["doctor_schedule", "ตารางหมอ รายสัปดาห์ + override"], ["customer", "ลูกค้า (HN)"], ["product", "แคตตาล็อกสินค้า"],
    ["stock_lot", "การรับของเข้าแต่ละล็อต (ทุนจริง)"], ["inventory_item", "ขวดจริงรายชิ้น (state + cc + ครั้ง)"],
    ["medical_procedure", "หัตถการ + ค่ามือ"], ["course", "คอร์ส (สูตร + อายุ)"], ["promotion", "โปรโมชั่น"],
    ["customer_course", "คอร์สที่ลูกค้าถือ (สิทธิ์ + ผ่อน)"], ["reserve", "การจอง/คิว"], ["opd", "เคสหัตถการ 1 ครั้ง"],
    ["payment", "การรับเงิน"], ["staff_earning", "ค่ามือ/คอมมิชชั่น"], ["expense", "รายจ่ายอื่น"],
    ["leave_request", "คำขอลา"], ["system_config / counter", "ตั้งค่าระบบ + เลขรัน"],
  ].map(([c, v]) => `<tr><td class="mono">${c}</td><td>${v}</td></tr>`).join("");

  const roles = [
    ["super_admin", "ทุกอย่าง · สลับ/ดูรวมทุกสาขา · ตั้งค่าระบบ"],
    ["admin", "จัดการคิว · ปิดเคส · stock · การเงิน · CRUD · อนุมัติลา"],
    ["acception", "OPD · สร้าง HN · จัดการคิว · วัดตัว · ปิดเคส"],
    ["sale", "จองคิว · ขายคอร์ส · รับคอมมิชชั่น"],
    ["doctor / BT", "ดูคิวตัวเอง · บันทึกหัตถการ · ดูรายได้ตัวเองเท่านั้น"],
  ].map(([r, v]) => `<tr><td class="mono">${r}</td><td>${v}</td></tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing:border-box; }
  body { font-family:'Tahoma','Leelawadee UI',sans-serif; color:#201d1a; margin:0; font-size:11.5px; }
  .cover { background:linear-gradient(160deg,#241f1a,#17130f); color:#fff; padding:58px 48px; }
  .cover .mark { width:70px;height:70px;border-radius:18px;background:#b23a33;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 0 2px #e3d6b6; }
  .cover h1 { font-size:29px; margin:20px 0 6px; }
  .cover .sub { color:#e3d6b6; font-size:14px; }
  .cover .meta { margin-top:20px; color:#c9c0b0; font-size:12.5px; line-height:1.9; }
  .section { padding:20px 28px; }
  h2 { color:#8f2b25; border-bottom:2px solid #e3d6b6; padding-bottom:6px; font-size:17px; }
  .summary { display:flex; gap:12px; margin:14px 0; }
  .box { flex:1; border:1px solid #e7e2d8; border-top:3px solid #a5842f; border-radius:10px; padding:12px; text-align:center; }
  .box .n { font-size:24px; font-weight:bold; } .box.g .n { color:#2f7d5b; }
  .step { border:1px solid #e0dacd; border-radius:12px; padding:14px 16px; margin:0 0 16px; break-inside:avoid; page-break-inside:avoid; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .s-head { display:flex; align-items:center; gap:9px; margin-bottom:7px; flex-wrap:wrap; }
  .s-num { width:26px;height:26px;border-radius:8px;background:#b23a33;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0; }
  .s-title { font-weight:bold; font-size:14.5px; }
  .s-actor { font-size:10.5px; color:#7a4f96; background:#f0eaf5; padding:2px 8px; border-radius:12px; }
  .s-badge { margin-left:auto; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:bold; }
  .s-badge.ok { background:#e7f1eb; color:#2f7d5b; } .s-badge.no { background:#f9ecea; color:#b23a33; }
  .s-narr { color:#4a463f; font-size:11.5px; margin-bottom:10px; line-height:1.55; }
  .grid2 { display:flex; gap:16px; align-items:flex-start; margin-bottom:10px; }
  .col { flex:1; min-width:0; }
  .h4 { font-weight:bold; font-size:11px; color:#8f2b25; margin:8px 0 4px; text-transform:uppercase; letter-spacing:.02em; }
  pre { background:#faf8f4; border:1px solid #eee; border-radius:6px; padding:8px 10px; font-size:10px; font-family:monospace; white-space:pre-wrap; word-break:break-word; margin:0; color:#3a362f; }
  ul { margin:0; padding-left:16px; } li { font-size:10.8px; margin:2px 0; color:#4a463f; }
  table.chk { width:100%; border-collapse:collapse; font-size:10.5px; }
  table.chk th { background:#faf8f4; text-align:left; padding:5px 7px; border-bottom:1.5px solid #e3d6b6; color:#5c574f; font-size:10px; }
  table.chk td { padding:5px 7px; border-bottom:1px solid #eee; }
  td.exp { color:#5c574f; } td.act { font-weight:bold; }
  td.ok { color:#2f7d5b; font-weight:bold; text-align:center; } td.no { color:#b23a33; font-weight:bold; text-align:center; }
  .step img { width:100%; border:1px solid #d8d1c4; border-radius:8px; margin-top:2px; }
  .pagebreak { page-break-before:always; }
  .atomic { border:2px solid #b23a33; border-radius:12px; background:#fdf4f2; padding:12px 14px; margin:8px 0; }
  .atomic .t { font-weight:bold; color:#8f2b25; font-size:13px; margin-bottom:6px; }
  .astep { display:flex; gap:9px; padding:4px 0; border-bottom:1px dashed #e6c3c0; font-size:11px; } .astep:last-child{border-bottom:none}
  .astep .k { width:19px;height:19px;border-radius:50%;background:#b23a33;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;flex-shrink:0; }
  .sm-flow { font-family:monospace; font-size:10.5px; background:#faf8f4; border:1px solid #eee; border-radius:8px; padding:9px 11px; line-height:1.7; }
  table.ref { width:100%; border-collapse:collapse; font-size:11px; margin:6px 0; }
  table.ref th { background:#faf8f4; text-align:left; padding:6px 9px; border-bottom:2px solid #e3d6b6; color:#5c574f; }
  table.ref td { padding:6px 9px; border-bottom:1px solid #eee; } .mono { font-family:monospace; color:#8f2b25; }
  h3 { font-size:13px; color:#201d1a; margin:14px 0 6px; }
  </style></head><body>

  <div class="cover">
    <div class="mark">☯</div>
    <h1>Flow การทำงาน + ผลทดสอบ (ฉบับละเอียด) — โอสถ (OSOTH)</h1>
    <div class="sub">ERP คลินิคเสริมความงาม · ทุกขั้นตอน: รายละเอียด · API · กติกา · ผลตรวจสอบจริง · ข้อมูลที่เปลี่ยน · ภาพจริง</div>
    <div class="meta">
      วันที่: ${today}<br/>
      วิธีทดสอบ: ขับ flow จริงผ่านระบบที่รันอยู่ · ยิง API ตรวจค่าจริงหลายรายการต่อขั้น · เก็บ screenshot หน้าจริง (Playwright)<br/>
      ผลรวม: <b style="color:#8fd6a0">${passSteps}/${steps.length} ขั้นผ่าน</b> · จุดตรวจสอบ <b style="color:#8fd6a0">${passChecks}/${totalChecks} รายการผ่าน</b><br/>
      Stack: Next.js 16 · MongoDB/Mongoose · Redux · MVC · กราฟ SVG เขียนเอง · Playwright
    </div>
  </div>

  <div class="section">
    <div class="summary">
      <div class="box"><div class="n">${steps.length}</div><div>ขั้นตอน</div></div>
      <div class="box g"><div class="n">${passSteps}</div><div>ขั้นผ่าน</div></div>
      <div class="box"><div class="n">${totalChecks}</div><div>จุดตรวจสอบ</div></div>
      <div class="box g"><div class="n">${passChecks}</div><div>ผ่าน</div></div>
    </div>
    <h2>Flow การทำงานทีละขั้น (ละเอียด)</h2>
  </div>
  <div class="section" style="padding-top:0">
    ${steps.map(stepCard).join("")}
  </div>

  <div class="section pagebreak">
    <h2>ภาคผนวก A — การปิดเคสแบบ Atomic (หัวใจระบบ)</h2>
    <div class="atomic"><div class="t">🔒 closeCase(opd_ID) — กดครั้งเดียวทำ 5 อย่างในทรานแซกชันเดียว</div>
      <div class="astep"><span class="k">1</span><span><b>ตัด stock FIFO</b> — เลือกขวด in_use ก่อน unused · lot หมดอายุก่อน/รับก่อนถูกหยิบก่อน · ตัดตามสูตร course (sub_unit ต่อครั้ง)</span></div>
      <div class="astep"><span class="k">2</span><span><b>อัปเดตขวด</b> — ลด cc_remaining/uses_remaining · เปลี่ยน state (unused→in_use→empty) · ตั้ง open_expiry_at · เขียน usage_log</span></div>
      <div class="astep"><span class="k">3</span><span><b>นับครั้งคอร์ส</b> — customer_course.uses_remaining −1 (ครบ → completed)</span></div>
      <div class="astep"><span class="k">4</span><span><b>สร้างค่ามือ</b> — staff_earning ให้หมอ/BT ตาม procedures_done (เรทคงที่)</span></div>
      <div class="astep"><span class="k">5</span><span><b>ปิดคิว</b> — reserve=done · opd=closed · บันทึกต้นทุนจริง cost_of_goods = (cc_used / sub_unit_size) × cost_price_per_unit ของ lot</span></div>
    </div>
  </div>

  <div class="section">
    <h2>ภาคผนวก B — Data Flow ระหว่าง collection</h2>
    <div class="sm-flow">
customer_course ─(จอง)▶ reserve ─(เปิดเคส)▶ opd ─(ปิดเคส)┬▶ inventory_item (ตัด cc/state/usage_log)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├▶ customer_course.uses_remaining −−<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└▶ staff_earning (ค่ามือหมอ/BT)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─(ขาย/ผ่อน)▶ payment&nbsp;&nbsp;├─(คอม)▶ staff_earning (sale)&nbsp;&nbsp;└─(add-on)▶ payment (แยกบิล)<br/>
stock_lot ─(รับของเข้า)▶ inventory_item[]&nbsp;&nbsp;·&nbsp;&nbsp;payment + opd.stock_used + staff_earning + expense ▶ finance/summary
    </div>

    <h2 style="margin-top:18px">ภาคผนวก C — State Machines</h2>
    <h3>คิวจอง (reserve)</h3><div class="sm-flow">booked → arrived → ready → in_progress → done&nbsp;&nbsp;|&nbsp;&nbsp;booked → cancelled / no_show&nbsp;&nbsp;(เลื่อนนัด = แก้ วัน/เวลา/ห้อง + เก็บ history)</div>
    <h3>เคสหัตถการ (opd)</h3><div class="sm-flow">open → measuring → (bt_stage) → (doctor_stage) → closed&nbsp;&nbsp;(ข้ามขั้น BT/หมอได้ · ปิดแล้วแก้ไม่ได้)</div>
    <h3>ขวดสินค้า (inventory_item)</h3><div class="sm-flow">unused → in_use → empty&nbsp;&nbsp;(+ discarded ได้ทุก state · เตือนเมื่อเกินวันหมดอายุหลังเปิด)</div>
    <h3>คอร์สลูกค้า (customer_course)</h3><div class="sm-flow">active → completed / expired / cancelled&nbsp;&nbsp;·&nbsp;&nbsp;payment: unpaid → partial → paid</div>
  </div>

  <div class="section pagebreak">
    <h2>ภาคผนวก D — Collections ทั้งหมด (18)</h2>
    <table class="ref"><thead><tr><th style="width:190px">Collection</th><th>หน้าที่</th></tr></thead><tbody>${collections}</tbody></table>

    <h2 style="margin-top:18px">ภาคผนวก E — สิทธิ์ตาม Role (RBAC)</h2>
    <table class="ref"><thead><tr><th style="width:130px">Role</th><th>ทำอะไรได้</th></tr></thead><tbody>${roles}</tbody></table>
    <div style="margin-top:8px;font-size:11px;color:#5c574f">พนักงานทำงานได้เฉพาะสาขาตัวเอง (super_admin เท่านั้นสลับสาขาได้) · ย้ายสาขาได้ ประวัติเงินเดิมยังอยู่ · stock แยกสาขา · ทุกคนยื่นลาได้ (admin อนุมัติ)</div>

    <h2 style="margin-top:18px">ภาคผนวก F — สูตรการเงิน (ตัวเลขจริงจากเคสทดสอบ)</h2>
    <div class="sm-flow">
กำไร = รายรับ − ต้นทุนสินค้า(lot จริง) − ค่ามือ/คอม − รายจ่ายอื่น<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ${fin?.data?.income ?? "-"} − ${fin?.data?.cogs ?? "-"} − ${fin?.data?.labor_cost ?? "-"} − ${fin?.data?.other_expense ?? "-"} = <b>${fin?.data?.net ?? "-"} ฿</b><br/>
COGS ต่อการตัด = (cc_used / sub_unit_size) × cost_price_per_unit ของ lot&nbsp;&nbsp;→&nbsp;&nbsp;(2 / 10) × 3,500 = 700฿<br/>
ลูกหนี้ค้างผ่อน = Σ customer_course.balance_due (payment_status ≠ paid)
    </div>

    <h2 style="margin-top:18px">ภาคผนวก G — Tech Stack</h2>
    <table class="ref"><tbody>
      <tr><td class="mono" style="width:150px">Framework</td><td><b>Next.js 16</b> (App Router · fullstack · Turbopack)</td></tr>
      <tr><td class="mono">UI</td><td>React 19.2</td></tr>
      <tr><td class="mono">Database</td><td>MongoDB + Mongoose 9</td></tr>
      <tr><td class="mono">State</td><td>Redux Toolkit</td></tr>
      <tr><td class="mono">สถาปัตยกรรม</td><td>MVC — models / services / app/api / app/*/page.js</td></tr>
      <tr><td class="mono">กราฟ · PDF · i18n</td><td>SVG เขียนเอง · window.print · dictionary ไทย/อังกฤษ (ไม่พึ่ง lib ใหญ่)</td></tr>
      <tr><td class="mono">Deploy · Test</td><td>Docker + compose · Playwright (Chromium) · ESLint 9</td></tr>
    </tbody></table>
  </div>

  </body></html>`;
}

async function pdf(fin) {
  const html = buildHTML(fin);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.pdf({ path: OUT, format: "A4", printBackground: true, margin: { top: "11mm", bottom: "11mm", left: "9mm", right: "9mm" } });
  await b.close();
  const passSteps = steps.filter((s) => s.checks.every((c) => c.ok)).length;
  const passChecks = steps.reduce((a, s) => a + s.checks.filter((c) => c.ok).length, 0);
  const totalChecks = steps.reduce((a, s) => a + s.checks.length, 0);
  console.log(`\n📄 สร้าง PDF: ${OUT}\nผ่าน ${passSteps}/${steps.length} ขั้น · จุดตรวจสอบ ${passChecks}/${totalChecks}`);
}

const fin = await main();
await pdf(fin);
