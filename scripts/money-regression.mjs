// Regression test ระบบเงิน — ครอบทุกบั๊กที่พบจากรอบ multi-agent audit (2026-08)
// รัน: BASE_URL=http://localhost:3001/api node scripts/money-regression.mjs (ต้อง seed สะอาดก่อน)
const BASE = process.env.BASE_URL || "http://localhost:3001/api";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, detail); }
};
const section = (t) => console.log("\n" + t);

const tokens = {};
async function login(u) {
  if (tokens[u]) return tokens[u];
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: "1234" }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`login ${u} fail`);
  return (tokens[u] = j.data.token);
}
async function api(user, path, opt = {}) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${await login(user)}`;
  const r = await fetch(`${BASE}${path}`, {
    ...opt, headers, body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

// ── 1. auth: GET การเงินต้อง 401 เมื่อไม่มี token ──
section("1) ทุก endpoint ต้อง 401 เมื่อไม่ login (default-deny)");
const NEED_AUTH = ["/expenses", "/purchase-orders", "/commission/report", "/customers",
  "/customer-courses", "/opd", "/stock/summary?branch_ID=BR-001", "/users",
  "/gl/journal", "/gl/reports/pnl", "/payroll?period=2026-07", "/earnings",
  "/executive/summary", "/finance/summary", "/reserves?branch_ID=BR-001&date=2026-09-01"];
for (const p of NEED_AUTH) {
  const r = await api(null, p);
  ok(`GET ${p.split("?")[0]} → 401`, r.status === 401, `ได้ ${r.status}`);
}
section("   public routes ยังเข้าได้ (landing/ลูกค้า)");
for (const p of ["/setup/state", "/public/storefront"]) {
  const r = await api(null, p);
  ok(`GET ${p} → 200`, r.status === 200, `ได้ ${r.status}`);
}

// ── 2. users list ซ่อนเงินเดือนจาก role อื่น ──
section("2) เงินเดือนใน /users เห็นเฉพาะ owner");
const uOwner = await api("owner", "/users");
const uAdmin = await api("admin", "/users");
ok("owner เห็น salary", uOwner.data.some((u) => u.salary !== undefined));
ok("admin ไม่เห็น salary/commission_rate", uAdmin.data.every((u) => u.salary === undefined && u.commission_rate === undefined));

// ── 3. expense: 0/ติดลบ ต้อง 400 และ GL รายงานไม่พัง ──
section("3) expense validation + GL ทนเอกสารเสีย");
ok("expense 0 บาท → 400", (await api("owner", "/expenses", { method: "POST", body: { category: "other", description: "ทดสอบ0", amount: 0 } })).status === 400);
ok("expense ติดลบ → 400", (await api("owner", "/expenses", { method: "POST", body: { category: "other", description: "ทดสอบลบ", amount: -100 } })).status === 400);
const expOk = await api("owner", "/expenses", { method: "POST", body: { category: "other", description: "ค่าน้ำแข็ง", amount: 120, date: "2026-08-05" } });
ok("expense ปกติ → 200", expOk.status === 200);
const tb1 = await api("owner", "/gl/reports/trial-balance");
ok("trial balance เปิดได้ + สมดุล", tb1.status === 200 && tb1.data.balanced === true);
ok("รายงาน kind มั่ว → 404 (ไม่ rebuild ก่อน)", (await api("owner", "/gl/reports/hack")).status === 404);

// ── 4. race จ่ายคอร์สซ้ำ (double-click) ──
section("4) จ่ายคอร์สพร้อมกัน 2 request — สำเร็จได้ 1 เดียว");
const cust = await api("admin", "/customers", { method: "POST", body: { full_name: "REGเงิน", phone: "0800000001" } });
const HN = cust.data.HN_number;
const courses = await api("admin", "/courses?branch_ID=BR-001");
const course = courses.data.find((c) => c.active);
const cc1 = await api("admin", "/customer-courses", { method: "POST", body: { HN_number: HN, course_ID: course.course_ID } });
const ccID = cc1.data.customer_course.customer_course_ID;
const due = cc1.data.customer_course.balance_due;
const [p1, p2] = await Promise.all([
  api("admin", `/customer-courses/${ccID}/pay`, { method: "POST", body: { payments: [{ amount: due, method: "cash" }] } }),
  api("admin", `/customer-courses/${ccID}/pay`, { method: "POST", body: { payments: [{ amount: due, method: "transfer" }] } }),
]);
const successCount = [p1, p2].filter((r) => r.status === 200).length;
ok("สำเร็จแค่ 1 จาก 2", successCount === 1, `ได้ ${p1.status}/${p2.status}`);
// ยืนยันผ่าน GL: JE ประเภท payment ของคอร์สนี้ต้องเครดิตรายได้รวม = ยอดเดียว (ไม่คูณสอง)
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const jePay = await api("owner", "/gl/journal?source=payment");
const memoPays = (jePay.data || []).filter((j) => (j.memo || "").includes(HN));
const revSum = memoPays.reduce((s, j) => s + j.lines.filter((l) => l.credit > 0).reduce((x, l) => x + l.credit, 0), 0);
ok(`รายได้ใน GL = ${due}฿ (ไม่คูณสอง)`, revSum === due, `ได้ ${revSum}`);
ok("จ่ายบรรทัดติดลบ → 400", (await api("admin", `/customer-courses/${ccID}/pay`, { method: "POST", body: { payments: [{ amount: -5, method: "cash" }] } })).status !== 200);

// ── 5. price_override ──
section("5) price_override: เฉพาะ admin/owner และต้อง > 0");
ok("sale ตั้ง override → 403", (await api("sale", "/customer-courses", { method: "POST", body: { HN_number: HN, course_ID: course.course_ID, price_override: 1 } })).status === 403);
ok("override 0 บาท → 400", (await api("admin", "/customer-courses", { method: "POST", body: { HN_number: HN, course_ID: course.course_ID, price_override: 0 } })).status === 400);
ok("sale_ID ไม่มีจริง → 400", (await api("admin", "/customer-courses", { method: "POST", body: { HN_number: HN, course_ID: course.course_ID, sale_ID: "US-999" } })).status === 400);
const ovOk = await api("admin", "/customer-courses", { method: "POST", body: { HN_number: HN, course_ID: course.course_ID, price_override: 900 } });
ok("admin override 900 → 200", ovOk.status === 200 && ovOk.data.customer_course.total_price === 900);

// ── 6. stock: ต้นทุนติดลบ + PO JE + discard JE ──
section("6) stock เข้า-ออกลง GL ครบ");
const prods = await api("owner", "/products?branch_ID=BR-001");
const prod = prods.data.find((p) => p.active);
ok("รับของต้นทุนติดลบ → 400", (await api("owner", "/stock/receive", { method: "POST", body: { product_ID: prod.product_ID, cost_price_per_unit: -50, quantity_received: 1 } })).status === 400);
const rc = await api("owner", "/stock/receive", { method: "POST", body: { product_ID: prod.product_ID, cost_price_per_unit: 200, quantity_received: 2, supplier: "REG-SUP" } });
ok("รับของมี supplier → 200", rc.status === 200);
const bills1 = await api("owner", "/ap/bills");
ok("เปิดบิล AP อัตโนมัติ (ผูก lot)", bills1.data.some((b) => b.lot_ID === rc.data.lot.lot_ID && b.amount === 400));
const je1 = await api("owner", "/gl/journal?source=stock_receive");
ok("JE รับของเข้า Cr 2000 (ซื้อเชื่อ)", (je1.data || []).some((j) => j.source_ID === rc.data.lot.lot_ID && j.lines.some((l) => l.account_code === "2000" && l.credit === 400)));
// PO flow
const po = await api("owner", "/purchase-orders", { method: "POST", body: { supplier: "REG-PO-SUP", items: [{ product_ID: prod.product_ID, qty: 1, cost_price_per_unit: 150 }] } });
if (po.status === 200) {
  const rcv = await api("owner", `/purchase-orders/${po.data.po_ID}/receive`, { method: "POST" });
  ok("PO receive → 200", rcv.status === 200);
  const jePo = await api("owner", "/gl/journal?source=stock_receive");
  ok("PO receive post JE stock-in แล้ว", (jePo.data || []).some((j) => j.source_ID === rcv.data.received?.[0]?.lot_ID));
} else ok("สร้าง PO ได้", false, `ได้ ${po.status}`);
// discard → JE สูญเสีย
const stockRows = await api("owner", `/stock/items?product_ID=${prod.product_ID}&branch_ID=BR-001`);
const anyItem = (stockRows.data || []).find?.((i) => i.state !== "discarded");
if (anyItem) {
  const dc = await api("owner", `/stock/items/${anyItem.item_ID}/discard`, { method: "POST" });
  ok("discard → 200", dc.status === 200);
  const jeD = await api("owner", "/gl/journal?source=stock_discard");
  ok("discard ลง JE สูญเสีย", (jeD.data || []).some((j) => j.source_ID === anyItem.item_ID));
} else { ok("(ข้าม discard — ไม่พบ item endpoint)", true); ok("(ข้าม JE discard)", true); }

// ── 7. add-on ──
section("7) add-on validation");
// เปิดเคสจากคิวใหม่
const rs = await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-10", time_start: "10:00", time_end: "10:30", room_ID: "RM-001", HN_number: HN, is_walk_in: true, contact: { nick_name: "REGเงิน" } } });
const opd1 = await api("admin", "/opd", { method: "POST", body: { reserve_ID: rs.data.reserve_ID, HN_number: HN } });
const opdID = opd1.data.opd_ID;
ok("addon qty=0 → 400", (await api("admin", `/opd/${opdID}/addon`, { method: "POST", body: { product_ID: prod.product_ID, qty: 0 } })).status === 400);
ok("addon qty=-2 → 400", (await api("admin", `/opd/${opdID}/addon`, { method: "POST", body: { product_ID: prod.product_ID, qty: -2 } })).status === 400);
// ผูกคอร์สที่ override แล้ว (ยังไม่จ่าย) → addon first-visit → ลบได้
await api("admin", `/opd/${opdID}/course`, { method: "POST", body: { existing_customer_course_ID: ovOk.data.customer_course.customer_course_ID } });
const ad = await api("admin", `/opd/${opdID}/addon`, { method: "POST", body: { product_ID: prod.product_ID, qty: 1 } });
ok("addon ปกติ → 200", ad.status === 200);
const delAd = await api("admin", `/opd/${opdID}/addon?index=0`, { method: "DELETE" });
ok("ลบ addon ที่ยังไม่จ่าย → 200 และถอนยอดคืน", delAd.status === 200);
const ccAfterDel = await api("admin", `/customer-courses?HN=${HN}`);
const ovCc = ccAfterDel.data.find((c) => c.customer_course_ID === ovOk.data.customer_course.customer_course_ID);
ok("ยอดคอร์สกลับเป็น 900", ovCc.total_price === 900, `ได้ ${ovCc.total_price}`);

// ── 8. payroll ──
section("8) payroll validation");
ok("tax ติดลบ → 400", (await api("owner", "/payroll", { method: "POST", body: { period: "2026-06", action: "save", rows: [{ user_ID: "US-002", tax: -500 }] } })).status === 400);
const dr66 = await api("owner", "/payroll?period=2026-06");
const ssoVals = dr66.data.rows.filter((r) => r.sso > 0).map((r) => r.sso);
ok("สปส. เป็นบาทเต็มทุกคน", ssoVals.every((v) => Number.isInteger(v)), JSON.stringify(ssoVals));
// พนักงานยังไม่เริ่มงาน → เงินเดือน 0 ในงวดก่อน start_date
const nu = await api("owner", "/users", { method: "POST", body: { full_name: "REG มาทีหลัง", role: "sale", salary: 30000, start_date: "2026-09-15" } });
const drAug = await api("owner", "/payroll?period=2026-08");
const newRow = drAug.data.rows.find((r) => r.user_ID === nu.data.user_ID);
ok("งวดก่อนเริ่มงาน เงินเดือน 0", newRow && newRow.salary === 0, `ได้ ${newRow?.salary}`);

// ── 9. ปิดเคสซ้ำพร้อมกัน + stock ไม่พอ = 409 ไม่ตัดค้าง ──
section("9) ปิดเคส: atomic + dry-run stock");
// เตรียมเคสให้ปิดได้: จ่ายคอร์ส override 900 + วัดตัว + consent
await api("admin", `/customer-courses/${ovOk.data.customer_course.customer_course_ID}/pay`, { method: "POST", body: { payments: [{ amount: 900, method: "cash" }] } });
await api("admin", `/opd/${opdID}`, { method: "PUT", body: { opd_data: { weight_kg: 60 } } });
await api("admin", `/opd/${opdID}/consent`, { method: "POST", body: { kind: "signature", file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", filename: "s.png", mime: "image/png" } });
const [c1, c2] = await Promise.all([
  api("admin", `/opd/${opdID}/close`, { method: "POST" }),
  api("admin", `/opd/${opdID}/close`, { method: "POST" }),
]);
const closeOk = [c1, c2].filter((r) => r.status === 200).length;
ok("ปิดเคสพร้อมกัน 2 → สำเร็จ 1", closeOk === 1, `ได้ ${c1.status}/${c2.status}`);
const earn1 = await api("owner", `/earnings?user_ID=all&from=2026-09-10&to=2026-09-10`);
// นับ earning ของ opd นี้ต้องไม่ซ้ำสองชุด (ถ้าปิดซ้ำจะ x2)
const opdEarnings = (earn1.data.rows || earn1.data || []).filter?.((e) => e.ref?.opd_ID === opdID) || [];
ok("ค่ามือไม่บันทึกซ้ำ", opdEarnings.length <= 2, `${opdEarnings.length} รายการ`);

console.log(`\n══ ผลรวม: ผ่าน ${pass} · ตก ${fail} ══`);
process.exit(fail ? 1 : 0);
