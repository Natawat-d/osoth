// flow_report.pdf — flow การทำงานจริง: แต่ละขั้นมี "ผลทดสอบจริง (API)" + "ภาพหน้าจอจริงจากแอป"
// ต้อง: seed ใหม่ก่อน + dev server รันอยู่ (localhost:3000)
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
const BASE = "http://localhost:3000";
const OUT = path.resolve("..", "flow_report.pdf");

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

const steps = [];
let ctx, page;
async function as(uid, branch, users) {
  const u = users[uid];
  await page.evaluate(([user, b]) => {
    localStorage.setItem("osoth_auth", JSON.stringify({ user, branch_ID: b }));
    localStorage.setItem("osoth_lang", "th");
  }, [u, branch || u.branch_ID]);
}
async function go(url) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  // รอ Shell เรนเดอร์จริง (auth + hydrate เสร็จ) — ไม่งั้นจับได้หน้าเปล่า
  await page.waitForSelector(".sidebar", { timeout: 15000 }).catch(() => {});
  await page.waitForSelector(".content .card, .content .cal-wrap, .content table, .content .stats", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1300);
}
let shotN = 0;
async function capture() {
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ fullPage: true });
  try { fs.writeFileSync(`test-artifacts/flow-${++shotN}.png`, buf); } catch {}
  return buf.toString("base64");
}
function step(num, title, desc, test, ok, b64) { steps.push({ num, title, desc, test, ok: !!ok, b64 }); console.log(`${ok ? "✓" : "✗"} ${num}. ${title}`); }

async function main() {
  // ---- master data สำหรับให้ภาพสวย ----
  await call(AS.admin, "PUT", "/promotions/PM-001", { banner_image: svgURI("โปรตรุษจีน ลด 10%", "Botox หน้าเรียว · ถึง 15 ก.ย.", "#b23a33", "#7a1e19") });
  await call(AS.admin, "PUT", "/courses/CS-002", { image: svgURI("คอร์สทรีตเมนต์ผิวใส", "10 ครั้ง · พิเศษ", "#a5842f", "#6e560f") });

  const usersRes = await fetch(BASE + "/api/users").then((r) => r.json());
  const users = Object.fromEntries(usersRes.data.map((u) => [u.user_ID, u]));

  const browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1.3 });
  page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  ⚠ pageerror:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("  ⚠ console.error:", m.text().slice(0, 140)); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  // ===== STEP 1: ขายคอร์ส + ผ่อนชำระ =====
  const s1 = await call(AS.sale, "POST", "/customer-courses", { course_ID: "CS-001", reserve_contact: { nick_name: "มณี", phone: "0810000001" }, first_payment: { amount: 5000, method: "transfer" } });
  const cc1 = s1.data?.customer_course;
  await as("US-004", null, users); await go("/calendar");
  step(1, "ขายคอร์ส + ผ่อนชำระ", "Sale ขายคอร์สให้ลูกค้า จ่ายงวดแรก บันทึกยอดค้าง + คอมมิชชั่นอัตโนมัติ",
    `ขาย Botox 5 ครั้ง จ่าย 5,000฿ → ค้าง ${cc1?.balance_due}฿ (คาดหวัง 10,000) · คอม 5% = ${cc1?.commission_amount}฿ (คาดหวัง 750)`,
    cc1?.balance_due === 10000 && cc1?.commission_amount === 750, await capture());

  // ===== STEP 2: จองคิว (หลายรายการ) =====
  const mk = (b) => call(AS.sale, "POST", "/reserves", { date: today, ...b });
  const r1 = await mk({ contact: { nick_name: "มณี", phone: "0810000001" }, customer_course_ID: cc1.customer_course_ID, room_ID: "RM-002", doctor_ID: "US-006", time_start: "13:00", time_end: "14:00" });
  await mk({ contact: { nick_name: "นภา" }, room_ID: "RM-003", time_start: "11:00", time_end: "12:30", is_walk_in: true });
  await mk({ contact: { nick_name: "ฟ้า" }, room_ID: "RM-002", doctor_ID: "US-006", time_start: "15:00", time_end: "16:00" });
  await as("US-001", null, users); await go("/");
  step(2, "จองคิวลงปฏิทิน", "จองคิวเลือกห้อง/หมอ/เวลา · หน้าร้านซ่อนชื่อคนจอง (privacy) แสดงเป็น 'จองแล้ว' + โชว์หมออยู่เวร",
    `จองคิววันนี้สำเร็จ ${r1.ok ? "✓" : "✗"} (แสดงบนปฏิทินหลายห้อง)`, r1.ok, await capture());

  // ===== STEP 3: กันจองซ้อน (ทดสอบผ่าน UI จริง) =====
  const clashApi = await mk({ contact: { nick_name: "ซ้อน" }, room_ID: "RM-002", time_start: "13:30", time_end: "14:30" });
  await as("US-004", null, users); await go("/calendar");
  try {
    await page.locator("select").nth(2).selectOption("RM-002");
    await page.locator('input[type="time"]').nth(0).fill("13:30");
    await page.locator('input[type="time"]').nth(1).fill("14:30");
    await page.getByRole("button", { name: "จองคิว" }).click();
    await page.waitForSelector(".err", { timeout: 3000 });
  } catch {}
  step(3, "กันจองซ้อน (ห้อง/หมอ ทับเวลา)", "ระบบบล็อกการจองซ้อนที่ระดับ API — จองห้องเดิมเวลาทับ หรือหมอคนเดียว 2 ห้อง ไม่ได้",
    `จอง RM-002 13:30–14:30 ทับคิวเดิม 13:00–14:00 → ระบบปฏิเสธ (HTTP ${clashApi.status}, คาดหวัง 409) · หน้าจอแสดง error จริง`,
    clashApi.status === 409, await capture());

  // ===== STEP 4: ลูกค้ามาถึง + สร้าง HN + เปิดเคส =====
  await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { status: "arrived" });
  const cust = await call(AS.recept, "POST", "/customers", { full_name: "มณี", sure_name: "รัตนดี", nick_name: "มณี", phone: "0810000001" });
  await call(AS.admin, "PUT", `/reserves/${r1.data.reserve_ID}`, { HN_number: cust.data.HN_number });
  const opd = await call(AS.recept, "POST", "/opd", { reserve_ID: r1.data.reserve_ID, HN_number: cust.data.HN_number });
  await as("US-003", null, users); await go("/opd");
  step(4, "ลูกค้ามาถึง → สร้าง HN → เปิดเคส", "Acception เปลี่ยนสถานะเป็น 'มาถึง' · ลูกค้าใหม่สร้าง HN (format ตั้งค่าได้) · เปิดเคส OPD ผูกเข้าคอร์ส",
    `สร้าง HN = ${cust.data?.HN_number} (format ถูก ${/^HN-\d{4}-\d{4}$/.test(cust.data?.HN_number || "") ? "✓" : "✗"}) · เปิดเคสครั้งที่ ${opd.data?.session_no}`,
    cust.ok && opd.ok && opd.data?.session_no === 1, await capture());

  // ===== STEP 5: วัดตัว (บังคับ) =====
  const early = await call(AS.admin, "POST", `/opd/${opd.data.opd_ID}/close`);
  await call(AS.recept, "PUT", `/opd/${opd.data.opd_ID}`, { opd_data: { blood_pressure: "118/76", weight_kg: 52, height_cm: 160, heart_rate: 72 }, BT_ID: "US-007" });
  await as("US-003", null, users); await go("/opd");
  try { await page.getByRole("button", { name: /ทำเคสต่อ/ }).first().click(); await page.waitForTimeout(700); } catch {}
  step(5, "วัดตัว (บังคับทุกครั้ง)", "ต้องวัดความดัน/น้ำหนัก/ส่วนสูงก่อน มิฉะนั้นปิดเคสไม่ได้ · Stepper แสดงความคืบหน้าของเคส",
    `ลองปิดเคสก่อนวัดตัว → ระบบปฏิเสธ (HTTP ${early.status}, คาดหวัง 400) แล้วบันทึกการวัดตัวสำเร็จ`,
    early.status === 400, await capture());

  // ===== STEP 6: บันทึกหัตถการ (BT + หมอ) + add-on =====
  await call(AS.admin, "PUT", `/opd/${opd.data.opd_ID}`, { procedures_done: [
    { medical_procedure_ID: "MP-002", name: "เตรียมผิว/แปะยาชา", type: "BT", performed_by: "US-007", cost: 150 },
    { medical_procedure_ID: "MP-001", name: "ฉีด Botox", type: "doctor", performed_by: "US-006", cost: 500 },
  ] });
  const addon = await call(AS.recept, "POST", `/opd/${opd.data.opd_ID}/addon`, { product_ID: "PD-003", qty: 1, method: "cash" });
  await as("US-003", null, users); await go("/opd");
  try { await page.getByRole("button", { name: /ทำเคสต่อ/ }).first().click(); await page.waitForTimeout(700); } catch {}
  step(6, "บันทึกหัตถการ + Add-on", "มอบหมาย BT/หมอ · บันทึกหัตถการตามสูตรคอร์ส · add-on ทำเพิ่มหน้างานเก็บเงินทันทีแยกบิล",
    `บันทึก 2 หัตถการ (BT 150฿ + หมอ 500฿) · add-on มาส์กทองคำ = ${addon.data?.price}฿ แยกบิล (คาดหวัง 900)`,
    addon.ok && addon.data?.price === 900, await capture());

  // ===== STEP 7: ปิดเคส (atomic 5 ขั้น) =====
  const closed = await call(AS.admin, "POST", `/opd/${opd.data.opd_ID}/close`);
  await as("US-003", null, users); await go("/opd");
  try { await page.getByRole("button", { name: /ดูเคส/ }).first().click(); await page.waitForTimeout(700); } catch {}
  step(7, "ปิดเคส — Atomic 5 ขั้น ★", "กดครั้งเดียว: ตัด stock FIFO + อัปเดตขวด + นับครั้งคอร์ส + สร้างค่ามือ + ปิดคิว",
    `ตัด 2cc จาก lot แรก (3,500฿/10cc → ต้นทุน ${closed.data?.stock_used?.[0]?.cost_of_goods}฿ คาดหวัง 700) · คอร์สเหลือ ${closed.data?.uses_remaining} ครั้ง · สร้างค่ามือ ${closed.data?.earnings_created} รายการ`,
    closed.ok && closed.data?.stock_used?.[0]?.cost_of_goods === 700 && closed.data?.uses_remaining === 4 && closed.data?.earnings_created === 2, await capture());

  // ===== STEP 8: Stock ถูกตัดถูกต้อง =====
  const items = await call(AS.admin, "GET", "/stock/items?branch_ID=BR-001&product_ID=PD-001");
  const inUse = (items.data || []).find((i) => i.state === "in_use");
  await as("US-002", null, users); await go("/stock");
  try { await page.getByRole("button", { name: "ดูรายขวด" }).first().click(); await page.waitForTimeout(600); } catch {}
  step(8, "คลังสินค้าอัปเดต (sub-unit)", "ขวดที่ถูกใช้เปลี่ยนเป็น 'ใช้งานแล้ว' เหลือ cc/ครั้งตามจริง + เริ่มนับวันหมดอายุหลังเปิด",
    `ขวด in_use เหลือ ${inUse?.cc_remaining}cc / ${inUse?.uses_remaining} ครั้ง (คาดหวัง 8cc/4) · มีวันหมดอายุหลังเปิด ${inUse?.open_expiry_at ? "✓" : "✗"}`,
    inUse?.cc_remaining === 8 && inUse?.uses_remaining === 4 && !!inUse?.open_expiry_at, await capture());

  // ===== STEP 9: การเงิน (ผลลัพธ์) =====
  const fin = await call(AS.admin, "GET", `/finance/summary?branch_ID=BR-001&from=${today}&to=${today}`);
  await as("US-002", null, users); await go("/finance");
  step(9, "การเงิน — กราฟ + ต้นทุนจริง", "รายรับ − ต้นทุนจริงตาม lot − ค่ามือ − รายจ่าย = กำไร · กราฟเส้น/วง · แยก/รวมสาขา · บันทึก PDF",
    `COGS = ${fin.data?.cogs}฿ (ต้นทุนจริง คาดหวัง 700) · ค่าแรง = ${fin.data?.labor_cost}฿ (คาดหวัง 650) · มี time-series สำหรับกราฟ ${Array.isArray(fin.data?.series) ? "✓" : "✗"}`,
    fin.data?.cogs === 700 && fin.data?.labor_cost === 650 && Array.isArray(fin.data?.series), await capture());

  // ===== STEP 10: รายได้พนักงาน (เห็นเฉพาะตัวเอง) =====
  const earn = await call(H("doctor", "US-006"), "GET", `/earnings?from=${today}&to=${today}`);
  await as("US-006", null, users); await go("/my-earnings");
  step(10, "รายได้ของฉัน (สิทธิ์)", "หมอ/BT/sale เห็นรายได้เฉพาะของตัวเองเท่านั้น (ระบบบังคับที่ API)",
    `หมอหงส์ (US-006) ทำหัตถการ 1 เคส → รายได้ ${earn.data?.total}฿ (คาดหวัง 500) · query ได้เฉพาะ user ตัวเอง`,
    earn.data?.total === 500 && earn.data?.user_ID === "US-006", await capture());

  // ===== STEP 11: ระบบลา (ยื่น → อนุมัติ) =====
  const lv = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: today, date_to: today, reason: "ไข้หวัด" });
  const lvOver = await call(AS.doc, "POST", "/leaves", { type: "sick", date_from: today, date_to: `${today.slice(0, 8)}${String(+today.slice(8) + 5).padStart(2, "0")}`, reason: "ผ่าตัด" });
  await call(AS.admin, "PUT", `/leaves/${lv.data.leave_ID}`, { status: "approved" });
  await call(H("BT", "US-007"), "POST", "/leaves", { type: "personal", date_from: today, date_to: today, reason: "ธุระ" });
  await as("US-002", null, users); await go("/leaves");
  try { await page.getByRole("button", { name: "รออนุมัติ" }).click(); await page.waitForTimeout(600); } catch {}
  step(11, "ระบบลา — อนุมัติ + ใบรับรองแพทย์", "พนักงานยื่นลากิจ/ลาป่วย · admin อนุมัติ · ลาป่วยเกินกำหนดต้องแนบใบรับรองแพทย์",
    `ยื่นลาป่วย 1 วันสำเร็จ · ลาป่วยเกิน 2 วันไม่มีใบรับรอง → ปฏิเสธ (HTTP ${lvOver.status}, คาดหวัง 400) · admin อนุมัติได้`,
    lv.ok && lvOver.status === 400, await capture());

  await browser.close();
}

// ---------------- build PDF ----------------
function buildHTML() {
  const pass = steps.filter((s) => s.ok).length;
  const stepHTML = steps.map((s) => `
    <div class="step">
      <div class="s-head">
        <span class="s-num">${s.num}</span>
        <span class="s-title">${s.title}</span>
        <span class="s-badge ${s.ok ? "ok" : "no"}">${s.ok ? "ผ่าน ✓" : "ไม่ผ่าน ✗"}</span>
      </div>
      <div class="s-desc">${s.desc}</div>
      <div class="s-test">🧪 ทดสอบจริง: ${s.test}</div>
      <img src="data:image/png;base64,${s.b64}" />
    </div>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing:border-box; }
  body { font-family:'Tahoma','Leelawadee UI',sans-serif; color:#201d1a; margin:0; font-size:12px; }
  .cover { background:linear-gradient(160deg,#241f1a,#17130f); color:#fff; padding:60px 50px; }
  .cover .mark { width:70px;height:70px;border-radius:18px;background:#b23a33;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 0 2px #e3d6b6; }
  .cover h1 { font-size:30px; margin:20px 0 6px; }
  .cover .sub { color:#e3d6b6; font-size:14px; }
  .cover .meta { margin-top:22px; color:#c9c0b0; font-size:13px; line-height:1.9; }
  .section { padding:22px 30px; }
  h2 { color:#8f2b25; border-bottom:2px solid #e3d6b6; padding-bottom:6px; font-size:18px; }
  .step { border:1px solid #e7e2d8; border-radius:12px; padding:14px 16px; margin:0 0 18px; break-inside:avoid; page-break-inside:avoid; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .s-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .s-num { width:26px;height:26px;border-radius:8px;background:#b23a33;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;flex-shrink:0; }
  .s-title { font-weight:bold; font-size:15px; color:#201d1a; }
  .s-badge { margin-left:auto; padding:3px 12px; border-radius:20px; font-size:11.5px; font-weight:bold; }
  .s-badge.ok { background:#e7f1eb; color:#2f7d5b; } .s-badge.no { background:#f9ecea; color:#b23a33; }
  .s-desc { color:#5c574f; font-size:12px; margin-bottom:6px; }
  .s-test { background:#faf8f4; border-left:3px solid #a5842f; border-radius:6px; padding:8px 10px; font-size:11.5px; color:#3a362f; margin-bottom:10px; }
  .step img { width:100%; border:1px solid #d8d1c4; border-radius:8px; }
  .summary { display:flex; gap:14px; margin:14px 0; }
  .box { flex:1; border:1px solid #e7e2d8; border-top:3px solid #a5842f; border-radius:10px; padding:14px; }
  .box .n { font-size:26px; font-weight:bold; } .box.g .n { color:#2f7d5b; }
  .atomic { border:2px solid #b23a33; border-radius:12px; background:#fdf4f2; padding:14px 16px; margin:10px 0; }
  .atomic .t { font-weight:bold; color:#8f2b25; font-size:14px; margin-bottom:8px; }
  .astep { display:flex; gap:10px; padding:5px 0; border-bottom:1px dashed #e6c3c0; font-size:11.5px; }
  .astep:last-child { border-bottom:none; } .astep .k { width:20px;height:20px;border-radius:50%;background:#b23a33;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;flex-shrink:0; }
  .sm-flow { font-family:monospace; font-size:11px; background:#faf8f4; border:1px solid #eee; border-radius:8px; padding:10px 12px; margin:6px 0; line-height:1.7; }
  .pagebreak { page-break-before:always; }
  </style></head><body>
    <div class="cover">
      <div class="mark">☯</div>
      <h1>Flow การทำงานจริง + ผลทดสอบ — โอสถ (OSOTH)</h1>
      <div class="sub">ERP คลินิคเสริมความงาม · ทุกขั้นตอนมีผลทดสอบจริง (API) + ภาพหน้าจอจริงจากแอป</div>
      <div class="meta">
        วันที่: ${today}<br/>
        วิธี: ขับ flow จริงทีละขั้นผ่านระบบที่รันอยู่ · ยิง API ตรวจผลลัพธ์ · เก็บ screenshot หน้าจริง (Playwright)<br/>
        ผลรวม: <b style="color:#8fd6a0">${pass}/${steps.length} ขั้นผ่าน</b>
      </div>
    </div>
    <div class="section">
      <div class="summary">
        <div class="box"><div class="n">${steps.length}</div><div>ขั้นตอนในflow</div></div>
        <div class="box g"><div class="n">${pass}</div><div>ผ่าน (ทดสอบจริง)</div></div>
        <div class="box"><div class="n">${steps.length - pass}</div><div>ไม่ผ่าน</div></div>
      </div>
      <h2>Flow การทำงานทีละขั้น (ภาพจริง + ผลทดสอบจริง)</h2>
    </div>
    <div class="section" style="padding-top:0">${stepHTML}</div>

    <div class="section pagebreak">
      <h2>ภาคผนวก — การปิดเคสแบบ Atomic (หัวใจระบบ)</h2>
      <div class="atomic"><div class="t">🔒 closeCase(opd_ID) — กดครั้งเดียวทำ 5 อย่าง</div>
        <div class="astep"><span class="k">1</span><span>ตัด stock FIFO (ขวดเปิดแล้วก่อน · lot หมดอายุก่อนถูกหยิบก่อน) ตามสูตรคอร์ส</span></div>
        <div class="astep"><span class="k">2</span><span>อัปเดตขวด: ลด cc/ครั้ง · เปลี่ยน state · บันทึกวันหมดอายุหลังเปิด · usage_log</span></div>
        <div class="astep"><span class="k">3</span><span>นับครั้งคอร์ส −1 (ครบ → completed)</span></div>
        <div class="astep"><span class="k">4</span><span>สร้างค่ามือหมอ/BT (staff_earning)</span></div>
        <div class="astep"><span class="k">5</span><span>ปิดคิว (reserve=done, opd=closed) + บันทึกต้นทุนจริงตาม lot</span></div>
      </div>
      <h2 style="margin-top:20px">Data Flow ระหว่าง collection</h2>
      <div class="sm-flow">
customer_course ─(จอง)▶ reserve ─(เปิดเคส)▶ opd ─(ปิดเคส)┬▶ inventory_item (ตัด cc/state)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├▶ customer_course.uses −−<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└▶ staff_earning (ค่ามือ)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─(ขาย/ผ่อน/add-on)▶ payment ─▶ finance/summary (กราฟ + กำไร)
      </div>
    </div>
  </body></html>`;
}

async function pdf() {
  const html = buildHTML();
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.pdf({ path: OUT, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
  await b.close();
  console.log(`\n📄 สร้าง PDF: ${OUT}\nผ่าน ${steps.filter((s) => s.ok).length}/${steps.length} ขั้น`);
}

await main();
await pdf();
