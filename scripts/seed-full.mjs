// seed-full — จำลองธุรกิจจริง ~500+ รายการ "ผ่าน API จริงทั้งหมด" (เงินทุกบาทมีใบเสร็จ/GL/ค่ามือครบ)
// ครอบทุกฟังก์ชัน: พนักงานหลายคนทุก role · incentive ขั้นบันได 3 เซลส์ยอดต่างกัน · จัดซื้อ (PO) ·
// จัดสต๊อก (รับเข้า/นับ/ทิ้ง) · ค่าจองคิว · มัดจำ · จอง→ปิดเคสเต็ม flow · add-on · void ·
// ค่าใช้จ่าย/เจ้าหนี้/งบประมาณ · ลงเวลา/ลางาน · เงินเดือน · เคลียร์บัตร
// รันตามลำดับ: npm run seed && npm run seed:demo && BASE_URL=... node scripts/seed-full.mjs
const BASE = process.env.BASE_URL || "http://localhost:3005/api";

const tokens = {};
async function login(u) {
  if (tokens[u]) return tokens[u];
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: "1234" }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`login ${u} fail: ${j.error}`);
  return (tokens[u] = j.data.token);
}
async function api(user, path, opt = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opt,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await login(user)}` },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
const must = (r, what) => {
  if (r.status !== 200) throw new Error(`${what}: ${r.status} ${r.error || ""}`);
  return r.data;
};
const n = {}; // ตัวนับ
const count = (k, v = 1) => (n[k] = (n[k] || 0) + v);
const pad2 = (x) => String(x).padStart(2, "0");
const dstr = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const pick = (arr, i) => arr[i % arr.length];
const sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

console.log("seed-full เริ่ม →", BASE);

// ── 1. พนักงานเพิ่ม (หลายคนทุก role) ──
const STAFF = [
  { full_name: "ส้ม รุ่งโรจน์", nick_name: "ส้ม", role: "sale", salary: 16000, commission_rate: 0, phone: "0812000002", start_date: dstr(-200) },
  { full_name: "เฟิร์น ใจดี", nick_name: "เฟิร์น", role: "sale", salary: 15000, commission_rate: 0, phone: "0812000003", start_date: dstr(-90) },
  { full_name: "บีม จัดการเก่ง", nick_name: "บีม", role: "admin", salary: 19000, phone: "0812000004", start_date: dstr(-300) },
  { full_name: "มายด์ มือเบา", nick_name: "มายด์", role: "BT", salary: 13500, phone: "0812000005", start_date: dstr(-150) },
  { full_name: "หมอพลอย ผิวใส", nick_name: "หมอพลอย", role: "doctor", salary: 0, phone: "0812000006", start_date: dstr(-120) },
];
const staffIds = {};
for (const s of STAFF) {
  const u = must(await api("owner", "/users", { method: "POST", body: s }), `สร้างพนักงาน ${s.nick_name}`);
  staffIds[s.nick_name] = u.user_ID;
  count("พนักงานใหม่");
}
// ตั้ง login ให้เซลส์ใหม่ (ฝึกใช้งานได้)
await api("owner", `/users/${staffIds["ส้ม"]}/login`, { method: "POST", body: { username: "sale2", password: "1234" } });
await api("owner", `/users/${staffIds["เฟิร์น"]}/login`, { method: "POST", body: { username: "sale3", password: "1234" } });

// ── 2. ตั้งค่า: ค่าจองคิว + ขั้นบันได incentive ──
must(await api("owner", "/config", { method: "PUT", body: { booking_fee: 199 } }), "ตั้งค่าจองคิว");
const cs = must(await api("owner", "/commission-settings"), "อ่าน commission");
must(await api("owner", "/commission-settings", {
  method: "PUT",
  body: {
    ...cs, branch_ID: "BR-001", tier_mode: "whole",
    sale_tiers: [
      { min_sales: 0, percent: 3 },       // ยอด 0+ → 3%
      { min_sales: 150000, percent: 5 },  // แตะ 1.5 แสน → 5% ทั้งยอด
      { min_sales: 500000, percent: 7 },  // แตะ 5 แสน → 7% ทั้งยอด
    ],
  },
}), "ตั้ง incentive tiers");

// ── 3. จัดซื้อ + จัดสต๊อก ──
for (const s of ["บ.เมดิคอลพลัส", "หจก.บิวตี้ซัพพลาย", "บ.ดีฟาร์มา", "ร้านเวชภัณฑ์รวมใจ"]) {
  must(await api("owner", "/suppliers", { method: "POST", body: { name: s, phone: "02-000-11" + count("supplier"), contact_person: "ฝ่ายขาย" } }), "supplier");
}
const products = (await api("owner", "/products?branch_ID=BR-001")).data.filter((p) => p.active);
// PO 5 ใบ → รับของ (ซื้อเชื่อ เข้า AP)
for (let i = 0; i < 5; i++) {
  const items = [0, 1].map((k) => ({
    product_ID: pick(products, i + k).product_ID, qty: 6 + (i % 3) * 2,
    cost_price_per_unit: 900 + ((i + k) % 4) * 350,
  }));
  const po = must(await api("owner", "/purchase-orders", { method: "POST", body: { supplier: pick(["บ.เมดิคอลพลัส", "หจก.บิวตี้ซัพพลาย", "บ.ดีฟาร์มา"], i), items } }), "PO");
  must(await api("owner", `/purchase-orders/${po.po_ID}/receive`, { method: "POST" }), "รับของตาม PO");
  count("PO+รับของ");
}
// รับของตรง (ซื้อสด/เชื่อ ทุนต่าง ให้ FIFO มีหลายชั้นราคา)
for (let i = 0; i < 6; i++) {
  must(await api("owner", "/stock/receive", {
    method: "POST",
    body: { product_ID: pick(products, i).product_ID, cost_price_per_unit: 800 + i * 150, quantity_received: 30, supplier: i % 2 ? "บ.ดีฟาร์มา" : "" },
  }), "รับของตรง");
  count("รับของเข้า lot");
}
// นับสต๊อก (ปรับลด) + ทิ้งขวด
const stockRows = (await api("owner", "/stock/summary?branch_ID=BR-001")).data || [];
const items0 = (await api("owner", `/stock/items?branch_ID=BR-001&product_ID=${pick(products, 0).product_ID}`)).data || [];
for (const it of (Array.isArray(items0) ? items0 : []).slice(0, 2)) {
  const r = await api("owner", `/stock/items/${it.item_ID}/discard`, { method: "POST" });
  if (r.status === 200) count("ทิ้งขวด (discard)");
}

// ── 4. ค่าใช้จ่าย / เจ้าหนี้ / งบประมาณ ──
const EXP = [["rent", "ค่าเช่าตึก", 35000], ["utility", "ค่าไฟ", 4200], ["utility", "ค่าน้ำ", 900], ["other", "ค่าขนส่งของ", 650], ["other", "ค่าทำความสะอาด", 1500], ["other", "ค่าเน็ต/โทรศัพท์", 1290]];
const today = new Date();
for (let i = 0; i < 24; i++) {
  const [category, description, amount] = pick(EXP, i);
  const day = 1 + (i % Math.max(1, today.getDate() - 1));
  const r = await api("owner", "/expenses", {
    method: "POST",
    body: { category, description: `${description} (${i + 1})`, amount: amount + (i % 5) * 111, date: `${dstr(0).slice(0, 8)}${pad2(day)}` },
  });
  if (r.status === 200) count("ค่าใช้จ่าย");
}
for (let i = 0; i < 6; i++) {
  const b = must(await api("owner", "/ap/bills", {
    method: "POST",
    body: { supplier_name: pick(["บ.เมดิคอลพลัส", "หจก.บิวตี้ซัพพลาย", "ร้านเวชภัณฑ์รวมใจ"], i), description: `บิลวัสดุสิ้นเปลือง ${i + 1}`, amount: 3200 + i * 800, bill_date: dstr(-i * 2), due_date: dstr(20 - i), expense_account: "6300" },
  }), "AP bill");
  count("บิลเจ้าหนี้");
  if (i < 3) { await api("owner", `/ap/bills/${b.bill_ID}/pay`, { method: "POST", body: { amount: b.amount, method: "transfer" } }); count("จ่ายเจ้าหนี้"); }
}
for (const [account_code, monthly] of [["4000", 250000], ["5000", 30000], ["5100", 40000], ["6000", 90000], ["6100", 35000], ["6300", 15000]]) {
  const r = await api("owner", "/budgets", { method: "POST", body: { year: today.getFullYear(), account_code, monthly: Array(12).fill(monthly) } });
  if (r.status === 200) count("งบประมาณ");
}

// ── 5. ลูกค้า 60 คน (ประวัติสุขภาพครบ) ──
const FIRST = ["สมศรี", "วิภา", "กมล", "อรทัย", "พิมพ์ใจ", "ธิดา", "มะลิ", "จันทร์เพ็ญ", "รัตนา", "สายฝน", "นารี", "ดวงใจ", "อัมพร", "เพียงขวัญ", "ศิริพร", "บุษบา", "แก้วตา", "วาสนา", "ปรานี", "สุดา"];
const LAST = ["ใจงาม", "ศรีสุข", "ทองดี", "รักสวย", "บุญมา", "แสงทอง", "พูลสุข", "เจริญยิ่ง", "มั่งมี", "สง่างาม"];
const custs = [];
for (let i = 0; i < 60; i++) {
  const hasAllergy = i % 6 === 0;
  const c = must(await api("admin", "/customers", {
    method: "POST",
    body: {
      prefix: pick(["นางสาว", "นาง", "นาย"], i % 10 === 0 ? 2 : i % 2), full_name: pick(FIRST, i), sure_name: pick(LAST, Math.floor(i / FIRST.length) + i),
      nick_name: pick(FIRST, i).slice(0, 3), phone: `08${String(30000000 + i * 137).padStart(8, "0")}`,
      birth_date: `${1975 + (i % 30)}-${pad2(1 + (i % 12))}-${pad2(1 + (i % 27))}`, gender: i % 10 === 0 ? "ชาย" : "หญิง",
      id_card: String(1100000000000 + i * 7919), nationality: "ไทย",
      address: `${10 + i} หมู่ ${1 + (i % 9)} เขตวัฒนา กรุงเทพฯ`, line_id: `cust${i}`,
      emergency: { name: "ญาติ " + pick(FIRST, i + 3), relation: pick(["แม่", "พี่สาว", "สามี", "เพื่อน"], i), phone: `089${String(1000000 + i).padStart(7, "0")}` },
      health_info: {
        chronic: { has: i % 8 === 0, detail: i % 8 === 0 ? "ความดันสูง" : "" },
        hiv: { has: false, detail: "" }, psych_med: { has: false, detail: "" },
        medication: { has: i % 7 === 0, detail: i % 7 === 0 ? "วิตามินซี" : "" },
        allergy: { has: hasAllergy, detail: hasAllergy ? "เพนิซิลลิน" : "" },
        surgery: { has: false, detail: "" }, procedure: { has: i % 5 === 0, detail: i % 5 === 0 ? "โบท็อกซ์" : "" },
        smoke_alcohol: { has: i % 9 === 0, detail: i % 9 === 0 ? "ดื่มสังสรรค์" : "" },
        pregnancy: { has: false, detail: "" },
      },
      history_signature: sig, history_date: dstr(0),
      drug_allergies: hasAllergy ? ["เพนิซิลลิน"] : [], chronic_diseases: i % 8 === 0 ? ["ความดันสูง"] : [],
    },
  }), `ลูกค้า ${i}`);
  custs.push(c); count("ลูกค้า");
}

// ── 6. จองคิว → เคสเต็ม flow (กระจาย 18 วัน · เซลส์ 3 คนยอดต่างกัน → เห็น tier ต่างกัน) ──
const courses = (await api("admin", "/courses?branch_ID=BR-001")).data.filter((c) => c.active);
const doctors = (await api("admin", "/users?role=doctor")).data;
const bts = (await api("admin", "/users?role=BT")).data;
const procedures = (await api("admin", "/procedures?branch_ID=BR-001")).data || [];
const btProc = procedures.find((p) => p.type === "BT");
const drProc = procedures.find((p) => p.type === "doctor");
const sales = [
  { id: (await api("admin", "/users?role=sale")).data.find((u) => u.username === "sale" || u.nick_name === "เซล")?.user_ID || "US-004", w: 6 }, // ตัวหลัก → tier สูง
  { id: staffIds["ส้ม"], w: 3 },
  { id: staffIds["เฟิร์น"], w: 1 },
];
const saleFor = (i) => (i % 10 < 6 ? sales[0].id : i % 10 < 9 ? sales[1].id : sales[2].id);
const ROOMS = ["RM-001", "RM-002", "RM-003"];
const SLOTS = ["09:30", "10:30", "11:30", "13:00", "14:00", "15:00", "16:00", "17:00"];
const addMin = (t, m) => { const [h, mi] = t.split(":").map(Number); const x = h * 60 + mi + m; return `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`; };
const ccOf = {}; // HN → customer_course_ID (ไว้ทำครั้งที่ 2)

let ci = 0;
for (let day = -13; day <= 4; day++) {
  const perDay = day <= 0 ? 6 : 4; // อดีตหนาแน่นกว่า
  for (let k = 0; k < perDay; k++) {
    const i = ci++;
    const cust = pick(custs, i);
    const room = pick(ROOMS, i);
    const slot = pick(SLOTS, Math.floor(i / ROOMS.length));
    const walkIn = day <= 0 && i % 6 === 5;
    // จอง (ค่าจองบังคับสำหรับจองล่วงหน้า)
    let rs = await api("admin", "/reserves", {
      method: "POST",
      body: {
        branch_ID: "BR-001", HN_number: cust.HN_number, contact: { nick_name: cust.nick_name, phone: cust.phone },
        date: dstr(day), time_start: slot, time_end: addMin(slot, 45), room_ID: room,
        doctor_ID: pick(doctors, i)?.user_ID || null, is_walk_in: walkIn,
        booking_fee_method: pick(["cash", "transfer", "card"], i),
      },
    });
    if (rs.status === 409) continue; // ชนสล็อต (เช่นกับ seed-demo) — ข้าม
    if (rs.status !== 200) continue;
    rs = rs.data; count("จองคิว");
    if (rs.booking_fee_paid > 0) count("เก็บค่าจองคิว 199฿");
    // มัดจำเพิ่มบางคิว (เฉพาะคิวอนาคต/วันนี้)
    if (day >= 0 && i % 4 === 0) {
      const dep = await api("admin", `/reserves/${rs.reserve_ID}/deposit`, { method: "POST", body: { amount: pick([300, 500, 1000], i), method: "cash" } });
      if (dep.status === 200) count("วางมัดจำ");
    }
    if (day > 0) continue; // อนาคต = จองค้างไว้

    // อดีต/วันนี้: เดินเรื่องต่อ
    if (i % 12 === 7) { await api("admin", `/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status: "no_show" } }); count("ไม่มาตามนัด"); continue; }
    if (i % 12 === 11) { await api("admin", `/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status: "cancelled" } }); count("ยกเลิกคิว"); continue; }
    if (day === 0 && k >= 3) { await api("admin", `/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status: "arrived" } }); count("มาถึง (รอทำ)"); continue; }

    // เปิดเคส → ปิดเคสเต็ม flow
    const opd = await api("admin", "/opd", { method: "POST", body: { reserve_ID: rs.reserve_ID, HN_number: cust.HN_number } });
    if (opd.status !== 200) continue;
    const opdID = opd.data.opd_ID;
    count("เปิดเคส OPD");

    // ตั้ง "เซลส์ดูแลเคส" + วัดตัว "ก่อนขาย" — คอมขั้นบันไดคิดจาก opd.sale_ID (ไม่ใช่คน login)
    await api("admin", `/opd/${opdID}`, { method: "PUT", body: { sale_ID: saleFor(i), opd_data: { weight_kg: 45 + (i % 40), height_cm: 150 + (i % 25), blood_pressure: "118/76", heart_rate: 72 } } });

    const repeat = ccOf[cust.HN_number]; // ลูกค้าเดิมมีคอร์สค้างครั้ง → ใช้คอร์สเดิม
    let ccID = repeat || null;
    if (!ccID) {
      const course = pick(courses, i);
      const sell = await api("admin", `/opd/${opdID}/course`, { method: "POST", body: { course_ID: course.course_ID, payments: [] } });
      if (sell.status !== 200) continue;
      ccID = sell.data.customer_course?.customer_course_ID || sell.data.customer_course_ID;
      count("ขายคอร์ส");
    } else {
      await api("admin", `/opd/${opdID}/course`, { method: "POST", body: { existing_customer_course_ID: ccID } });
      count("ใช้คอร์สเดิม (ครั้งถัดไป)");
    }

    // จ่าย (ครั้งแรกเท่านั้น — ครั้งถัดไปจ่ายครบแล้ว) · แยกช่องทาง + ใช้มัดจำถ้ามี
    const ccDoc = (await api("admin", `/customer-courses/${ccID}`)).data;
    if (ccDoc && ccDoc.balance_due > 0) {
      const due = ccDoc.balance_due;
      let payments;
      const rsDoc = (await api("admin", `/reserves/${rs.reserve_ID}`)).data;
      if (rsDoc?.deposit_status === "held" && rsDoc.deposit < due) payments = [{ amount: rsDoc.deposit, method: "deposit" }, { amount: due - rsDoc.deposit, method: pick(["cash", "transfer", "card"], i) }];
      else if (i % 3 === 0 && due > 1000) payments = [{ amount: Math.floor(due / 2), method: "cash" }, { amount: due - Math.floor(due / 2), method: "transfer" }];
      else payments = [{ amount: due, method: pick(["cash", "transfer", "card"], i) }];
      const pay = await api("admin", `/customer-courses/${ccID}/pay`, { method: "POST", body: { payments, reserve_ID: rs.reserve_ID } });
      if (pay.status === 200) count("รับชำระคอร์ส (ใบเสร็จ)");
      // health record ครั้งแรกของคอร์ส
      await api("admin", `/customer-courses/${ccID}/health-record`, { method: "POST", body: { health_info: cust.health_info || {}, signature: sig } });
      count("ประวัติสุขภาพประจำคอร์ส");
    }
    // add-on: ครั้งแรกรวมบิล (ต้องก่อนจ่าย — ข้ามเพื่อความง่าย) → ใช้แบบครั้งถัดไป/แยกบิลเมื่อ repeat
    if (repeat && i % 4 === 1 && products.length) {
      const ad = await api("admin", `/opd/${opdID}/addon`, { method: "POST", body: { product_ID: pick(products, i).product_ID, qty: 1, method: "cash", recommended_by: saleFor(i) } });
      if (ad.status === 200) count("add-on แยกบิล");
    }
    // consent + ทีมทำ + ปิดเคส
    await api("admin", `/opd/${opdID}/consent`, { method: "POST", body: { kind: "signature", file: sig, filename: "sig.png", mime: "image/png" } });
    const bt = pick(bts, i)?.user_ID, dr = pick(doctors, i)?.user_ID;
    const procs = [];
    if (btProc && bt) procs.push({ medical_procedure_ID: btProc.medical_procedure_ID, name: btProc.name, type: "BT", performed_by: bt, cost: 0 });
    if (drProc && dr && i % 2 === 0) procs.push({ medical_procedure_ID: drProc.medical_procedure_ID, name: drProc.name, type: "doctor", performed_by: dr, cost: 0 });
    await api("admin", `/opd/${opdID}`, { method: "PUT", body: { BT_ID: bt, doctor_ID: dr, procedures_done: procs } });
    const closed = await api("admin", `/opd/${opdID}/close`, { method: "POST" });
    if (closed.status === 200) {
      count("ปิดเคสสำเร็จ");
      if (!repeat && i % 5 === 2) ccOf[cust.HN_number] = ccID; // จองไว้ให้มาครั้งที่ 2
    } else count(`ปิดเคสไม่ผ่าน (${(closed.error || "").slice(0, 30)})`);
  }
}

// ── 7. void ใบเสร็จ 2 ใบ (ตัวอย่างบิลผิด) ──
const rcs = (await api("owner", `/receipts?from=${dstr(-14)}&to=${dstr(0)}`)).data || [];
for (const rc of rcs.filter((r) => r.status === "issued" && r.total <= 500).slice(0, 2)) {
  const v = await api("owner", `/receipts/${rc.receipt_ID}/void`, { method: "POST", body: { reason: "คีย์ช่องทางผิด — รับใหม่แล้ว" } });
  if (v.status === 200) count("void ใบเสร็จ");
}

// ── 8. บุคคล: ลงเวลาวันนี้ + ใบลา ──
for (const u of ["admin", "sale", "sale2", "sale3", "bt1", "bt2", "dr.mangkorn"]) {
  try { if ((await api(u, "/attendance", { method: "POST", body: { action: "in" } })).status === 200) count("ลงเวลาเข้างานวันนี้"); } catch {}
}
for (const u of ["bt1", "bt2"]) { try { await api(u, "/attendance", { method: "POST", body: { action: "out" } }); } catch {} }
const leaveReqs = [
  ["sale", "personal", 2, "ไปงานบวชญาติ"], ["bt1", "sick", 1, "ไข้หวัด"], ["sale2", "personal", 1, "ติดต่อราชการ"],
  ["bt2", "sick", 3, "ผ่าฟันคุด มีใบรับรองแพทย์"], ["dr.mangkorn", "personal", 1, "ประชุมวิชาการ"], ["sale3", "personal", 2, "กลับต่างจังหวัด"],
];
const leaveIds = [];
for (let i = 0; i < leaveReqs.length; i++) {
  const [u, type, days, reason] = leaveReqs[i];
  try {
    const lv = await api(u, "/leaves", { method: "POST", body: { type, date_start: dstr(7 + i * 2), date_end: dstr(7 + i * 2 + days - 1), reason, medical_cert: type === "sick" && days > 2 ? sig : "" } });
    if (lv.status === 200) { leaveIds.push(lv.data.leave_ID); count("ใบลา"); }
  } catch {}
}
for (let i = 0; i < leaveIds.length; i++) {
  if (i < 3) { await api("admin", `/leaves/${leaveIds[i]}`, { method: "PUT", body: { status: "approved" } }); count("อนุมัติลา"); }
  else if (i === 3) { await api("admin", `/leaves/${leaveIds[i]}`, { method: "PUT", body: { status: "rejected", reject_reason: "ช่วงลูกค้าแน่น ขอเลื่อน" } }); count("ไม่อนุมัติลา"); }
}

// ── 9. เงินเดือนเดือนก่อน (จ่ายจริง + JE) ──
const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })();
const payroll = await api("owner", "/payroll", { method: "POST", body: { period: lastMonth, action: "pay", method: "transfer", rows: [] } });
if (payroll.status === 200) count(`จ่ายเงินเดือนงวด ${lastMonth}`);

// ── 10. เคลียร์เงินบัตรบางส่วน ──
const settle = await api("owner", "/finance/card-settlement");
const pending = settle.data?.pending_1020 || 0;
if (pending > 1000) {
  const amt = Math.floor(pending * 0.6);
  const r = await api("owner", "/finance/card-settlement", { method: "POST", body: { amount: amt, fee: Math.round(amt * 0.018 * 100) / 100 } });
  if (r.status === 200) count("เคลียร์เงินบัตรเข้าธนาคาร");
}

// ── สรุป ──
await api("owner", "/gl/journal/rebuild", { method: "POST" });
const tb = await api("owner", "/gl/reports/trial-balance");
const month = dstr(0).slice(0, 7);
const comm = await api("owner", `/commission/report?month=${month}&branch_ID=BR-001`);
console.log("\n══ seed-full เสร็จ ══");
let total = 0;
for (const [k, v] of Object.entries(n).sort((a, b) => b[1] - a[1])) { console.log(`  ${String(v).padStart(4)}  ${k}`); total += v; }
console.log(`  รวมประมาณ ${total} รายการ (ยังไม่นับใบเสร็จ/JE/ค่ามือที่ระบบสร้างตาม)`);
console.log("trial balance สมดุล:", tb.data?.balanced);
for (const r of comm.data?.rows || [])
  console.log(`  คอมเซลส์ ${r.name}: ยอดขายเดือนนี้ ${(r.sales_base ?? r.total_sales ?? 0).toLocaleString()}฿ → tier ${r.tier_percent}% = ${(r.tier_commission ?? 0).toLocaleString()}฿`);
