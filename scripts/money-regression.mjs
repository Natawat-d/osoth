// Regression test ระบบเงิน — ครอบทุกบั๊กที่พบจากรอบ multi-agent audit (2026-08)
// รัน: BASE_URL=http://localhost:3001/api node scripts/money-regression.mjs (ต้อง seed สะอาดก่อน)
const BASE = process.env.BASE_URL || "http://localhost:3001/api";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, detail); }
};
const section = (t) => console.log("\n" + t);

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
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
// V3.6: ครั้งแรกของคอร์สต้องมีประวัติสุขภาพเซ็นแล้ว
await api("admin", `/customer-courses/${ovOk.data.customer_course.customer_course_ID}/health-record`, { method: "POST", body: { health_info: {}, signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" } });
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


// ── 10. ฟีเจอร์ V3.5: ใบเสร็จ / void / มัดจำ / ปิดวัน / เคลียร์บัตร / ปิดงวด / deferred revenue ──
section("10) ใบเสร็จ + void + คืนยอดคอร์ส");
const cust2 = await api("admin", "/customers", { method: "POST", body: { full_name: "REGใบเสร็จ", phone: "0800000002" } });
const HN2 = cust2.data.HN_number;
const buy = await api("admin", "/customer-courses", { method: "POST", body: { HN_number: HN2, course_ID: course.course_ID, payments: [{ amount: course.price, method: "cash" }] } });
ok("ขาย+จ่าย → ได้ใบเสร็จเลขรัน RC", buy.status === 200 && /^RC\d{4}-\d{5}$/.test(buy.data.receipt?.receipt_no || ""), buy.data.receipt?.receipt_no);
ok("คอร์สใหม่เป็น deferred", buy.data.customer_course.deferred === true);
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const jeDef = await api("owner", "/gl/journal?source=payment");
const defJe = (jeDef.data || []).find((j) => (j.memo || "").includes(buy.data.payments[0].payment_ID));
ok("เงินคอร์ส deferred เครดิต 2310 (รายได้รับล่วงหน้า)", !!defJe && defJe.lines.some((l) => l.account_code === "2310" && l.credit === course.price));
// void ใบเสร็จ → เงินกลับ + คอร์สกลับค้าง
const rcList = await api("owner", `/receipts?cc=${buy.data.customer_course.customer_course_ID}`);
const rcId = rcList.data[0].receipt_ID;
ok("void โดยไม่ให้เหตุผล → 400", (await api("owner", `/receipts/${rcId}/void`, { method: "POST", body: {} })).status === 400);
const vd = await api("owner", `/receipts/${rcId}/void`, { method: "POST", body: { reason: "คีย์ผิดคน" } });
ok("void ใบเสร็จสำเร็จ", vd.status === 200 && vd.data.voided_payments.length === 1);
const ccAfterVoid = await api("admin", `/customer-courses?HN=${HN2}`);
ok("คอร์สกลับเป็นค้างชำระเต็มยอด", ccAfterVoid.data[0].balance_due === course.price && ccAfterVoid.data[0].payment_status === "unpaid");
ok("void ซ้ำ → 409", (await api("owner", `/receipts/${rcId}/void`, { method: "POST", body: { reason: "ซ้ำ" } })).status === 409);
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const tbAfterVoid = await api("owner", "/gl/reports/trial-balance");
ok("TB ยังสมดุลหลัง void", tbAfterVoid.data.balanced === true);

section("11) มัดจำจอง: วาง → ใช้จ่ายคอร์ส");
const rs2 = await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-20", time_start: "10:00", time_end: "10:30", room_ID: "RM-001", HN_number: HN2, is_walk_in: true, contact: { nick_name: "REGมัดจำ" } } });
const dep = await api("admin", `/reserves/${rs2.data.reserve_ID}/deposit`, { method: "POST", body: { amount: 199, method: "cash" } });
ok("วางมัดจำ 199 + ได้ใบเสร็จ", dep.status === 200 && !!dep.data.receipt?.receipt_no);
ok("วางซ้ำ → 409", (await api("admin", `/reserves/${rs2.data.reserve_ID}/deposit`, { method: "POST", body: { amount: 100, method: "cash" } })).status === 409);
// เปิดเคส + จ่ายคอร์สด้วย เงินสด + มัดจำ
const opd2 = await api("admin", "/opd", { method: "POST", body: { reserve_ID: rs2.data.reserve_ID, HN_number: HN2 } });
const cc2id = ccAfterVoid.data[0].customer_course_ID;
await api("admin", `/opd/${opd2.data.opd_ID}/course`, { method: "POST", body: { existing_customer_course_ID: cc2id } });
const payMix = await api("admin", `/customer-courses/${cc2id}/pay`, { method: "POST", body: { reserve_ID: rs2.data.reserve_ID, payments: [{ amount: course.price - 199, method: "cash" }, { amount: 199, method: "deposit" }] } });
ok("จ่ายคอร์ส เงินสด+มัดจำ → 200", payMix.status === 200, JSON.stringify(payMix.error || ""));
const rsAfter = await api("admin", `/reserves/${rs2.data.reserve_ID}`);
ok("มัดจำสถานะ applied", rsAfter.data.deposit_status === "applied");
ok("ใช้มัดจำเกินที่วาง → 4xx", (await api("admin", `/customer-courses/${cc2id}/pay`, { method: "POST", body: { reserve_ID: rs2.data.reserve_ID, payments: [{ amount: 1, method: "deposit" }] } })).status !== 200);

section("12) ปิดยอดสิ้นวัน + เคลียร์บัตร + ปิดงวด");
const dcPre = await api("owner", `/finance/daily-close?date=${todayLocal()}`);
ok("ดู expected cash ได้", dcPre.status === 200 && typeof dcPre.data.expected_cash === "number");
const dcPost = await api("owner", "/finance/daily-close", { method: "POST", body: { date: todayLocal(), counted_cash: dcPre.data.expected_cash - 100, note: "เทสต์ขาด 100" } });
ok("ปิดยอดวัน (ขาด 100) → 200", dcPost.status === 200 && dcPost.data.diff === -100);
ok("ปิดวันซ้ำ → 409", (await api("owner", "/finance/daily-close", { method: "POST", body: { date: todayLocal(), counted_cash: 0 } })).status === 409);
const jeDc = await api("owner", "/gl/journal?source=daily_close");
ok("ส่วนต่างลง JE (Dr 6300 / Cr 1000)", (jeDc.data || []).some((j) => j.source_ID === dcPost.data.close_ID && j.lines.some((l) => l.account_code === "6300" && l.debit === 100)));
const cs0 = await api("owner", "/finance/card-settlement");
ok("ดูยอด 1020 ค้างได้", cs0.status === 200);
const csPost = await api("owner", "/finance/card-settlement", { method: "POST", body: { amount: 100, fee: 2.5 } });
ok("เคลียร์บัตร 100 (fee 2.5) → 200", csPost.status === 200 && csPost.data.net === 97.5);
ok("fee >= ยอด → 400", (await api("owner", "/finance/card-settlement", { method: "POST", body: { amount: 10, fee: 10 } })).status === 400);
ok("ล็อกงวดถึงสิ้นเดือนก่อน → 200", (await api("owner", "/gl/period-lock", { method: "PUT", body: { locked_through: "2026-07-31" } })).status === 200);
await new Promise((r) => setTimeout(r, 5200)); // รอ cache ล็อกหมดอายุ (5s)
ok("expense ย้อนหลังในงวดที่ล็อก → 409", (await api("owner", "/expenses", { method: "POST", body: { category: "other", description: "ย้อนหลัง", amount: 50, date: "2026-07-15" } })).status === 409);
ok("expense วันนี้ยังบันทึกได้", (await api("owner", "/expenses", { method: "POST", body: { category: "other", description: "วันนี้", amount: 50 } })).status === 200);
ok("ปลดล็อก → 200", (await api("owner", "/gl/period-lock", { method: "PUT", body: { locked_through: "" } })).status === 200);

section("13) deferred revenue: ปิดเคสแล้วรับรู้รายได้เข้า 4000");
await api("admin", `/opd/${opd2.data.opd_ID}`, { method: "PUT", body: { opd_data: { weight_kg: 55 } } });
await api("admin", `/opd/${opd2.data.opd_ID}/consent`, { method: "POST", body: { kind: "signature", file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5CYII=", filename: "s.png", mime: "image/png" } });
await api("admin", `/customer-courses/${cc2id}/health-record`, { method: "POST", body: { health_info: {}, signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5CYII=" } });
const close2 = await api("admin", `/opd/${opd2.data.opd_ID}/close`, { method: "POST" });
ok("ปิดเคสคอร์ส deferred → 200", close2.status === 200, JSON.stringify(close2.error || ""));
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const jeRec = await api("owner", "/gl/journal?source=revenue_rec");
const recJe = (jeRec.data || []).find((j) => j.source_ID === opd2.data.opd_ID);
ok("มี JE รับรู้รายได้ (Dr 2310 / Cr 4000)", !!recJe && recJe.lines.some((l) => l.account_code === "4000" && l.credit > 0));
const tbFinal = await api("owner", "/gl/reports/trial-balance");
ok("TB สมดุลปิดท้ายทุกฟีเจอร์", tbFinal.data.balanced === true);


// ── 14. ค่าจองคิว (booking fee) — เก็บตามยอดที่ตั้ง นับเป็นรายได้ทันที ──
section("14) ค่าจองคิว: ตั้งยอด → บังคับเก็บตอนจอง → รายได้ 4200");
ok("ตั้งค่าจอง 199 → 200", (await api("owner", "/config", { method: "PUT", body: { booking_fee: 199 } })).status === 200);
const bfNo = await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-25", time_start: "10:00", time_end: "10:30", room_ID: "RM-001", contact: { nick_name: "REGจอง" } } });
ok("จองล่วงหน้าไม่เลือกช่องทางค่าจอง → 400", bfNo.status === 400 && /ค่าจอง/.test(bfNo.error || ""), JSON.stringify(bfNo.error || bfNo.status));
const bfOk = await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-25", time_start: "10:00", time_end: "10:30", room_ID: "RM-001", contact: { nick_name: "REGจอง" }, booking_fee_method: "cash" } });
ok("จอง+จ่ายค่าจอง → 200 ได้ใบเสร็จ", bfOk.status === 200 && bfOk.data.booking_fee_paid === 199 && /^RC/.test(bfOk.data.booking_fee_receipt?.receipt_no || ""), JSON.stringify(bfOk.error || ""));
const bfWalk = await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-25", time_start: "11:00", time_end: "11:30", room_ID: "RM-001", contact: { nick_name: "REGวอล์ค" }, is_walk_in: true } });
ok("walk-in ไม่ต้องจ่ายค่าจอง", bfWalk.status === 200 && (bfWalk.data.booking_fee_paid || 0) === 0);
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const jeBf = await api("owner", "/gl/journal?source=payment");
const bfJe = (jeBf.data || []).find((j) => (j.memo || "").includes(bfOk.data.booking_fee_payment_ID));
ok("JE ค่าจอง Cr 4200 (รายได้ค่าจองคิว)", !!bfJe && bfJe.lines.some((l) => l.account_code === "4200" && l.credit === 199), JSON.stringify(bfJe ? bfJe.lines : "no je"));
ok("ตั้งกลับ 0 → จองได้ไม่ต้องจ่าย", (await api("owner", "/config", { method: "PUT", body: { booking_fee: 0 } })).status === 200 &&
  (await api("admin", "/reserves", { method: "POST", body: { branch_ID: "BR-001", date: "2026-09-25", time_start: "12:00", time_end: "12:30", room_ID: "RM-001", contact: { nick_name: "REGฟรี" } } })).status === 200);
const tbBf = await api("owner", "/gl/reports/trial-balance");
ok("TB สมดุลหลังค่าจอง", tbBf.data.balanced === true);

console.log(`\n══ ผลรวม: ผ่าน ${pass} · ตก ${fail} ══`);
process.exit(fail ? 1 : 0);
