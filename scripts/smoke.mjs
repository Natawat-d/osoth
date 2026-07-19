// Smoke test: ยิง API ทดสอบ business flow ครบวงจร (ต้อง seed ก่อน + dev server รันอยู่)
const BASE = process.env.BASE_URL || "http://localhost:3000/api";

const AUTH = {
  sale: { "x-user-id": "US-004", "x-user-role": "sale", "x-branch-id": "BR-001" },
  admin: { "x-user-id": "US-002", "x-user-role": "admin", "x-branch-id": "BR-001" },
  acception: { "x-user-id": "US-003", "x-user-role": "acception", "x-branch-id": "BR-001" },
  doctor: { "x-user-id": "US-005", "x-user-role": "doctor", "x-branch-id": "BR-001" },
};

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

async function call(as, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...AUTH[as] },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

const _d = new Date();
const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;

console.log("1) ขาย course (sale, จ่ายงวดแรก 5,000 = ผ่อน)");
const sold = await call("sale", "POST", "/customer-courses", {
  course_ID: "CS-001",
  reserve_contact: { nick_name: "คุณสมใจ", phone: "0812345678" },
  first_payment: { amount: 5000, method: "transfer" },
});
ok("ขายสำเร็จ", sold.ok, JSON.stringify(sold));
const cc = sold.data?.customer_course;
ok("ราคาเต็ม 15000 จ่าย 5000 ค้าง 10000", cc?.balance_due === 10000 && cc?.payment_status === "partial");
ok("คอม sale 5% = 750", cc?.commission_amount === 750);

console.log("2) จองคิว + กันจองซ้อน");
const rs1 = await call("sale", "POST", "/reserves", {
  contact: { nick_name: "คุณสมใจ", phone: "0812345678" },
  customer_course_ID: cc.customer_course_ID,
  date: today, time_start: "13:00", time_end: "14:00",
  room_ID: "RM-001", doctor_ID: "US-005",
});
ok("จองคิวแรกสำเร็จ", rs1.ok, JSON.stringify(rs1));
const clashRoom = await call("sale", "POST", "/reserves", {
  contact: { nick_name: "ซ้อนห้อง" }, date: today,
  time_start: "13:30", time_end: "14:30", room_ID: "RM-001",
});
ok("ห้องซ้อน → 409", clashRoom.status === 409);
const clashDoc = await call("sale", "POST", "/reserves", {
  contact: { nick_name: "ซ้อนหมอ" }, date: today,
  time_start: "13:30", time_end: "14:30", room_ID: "RM-002", doctor_ID: "US-005",
});
ok("หมอซ้อน (คนละห้อง) → 409", clashDoc.status === 409);
const rs2 = await call("sale", "POST", "/reserves", {
  contact: { nick_name: "ไม่ซ้อน" }, date: today,
  time_start: "14:00", time_end: "15:00", room_ID: "RM-001",
});
ok("ต่อเวลาพอดี (14:00) ไม่ถือว่าซ้อน", rs2.ok);

console.log("3) ลูกค้ามาถึง → สร้าง HN → เปิดเคส");
await call("admin", "PUT", `/reserves/${rs1.data.reserve_ID}`, { status: "arrived" });
const cust = await call("acception", "POST", "/customers", {
  full_name: "สมใจ", sure_name: "ใจดี", nick_name: "คุณสมใจ", phone: "0812345678",
});
ok("สร้าง HN สำเร็จ", cust.ok && /^HN-\d{4}-\d{4}$/.test(cust.data.HN_number), cust.data?.HN_number);
const opd = await call("acception", "POST", "/opd", {
  reserve_ID: rs1.data.reserve_ID, HN_number: cust.data.HN_number,
});
ok("เปิดเคสสำเร็จ session 1", opd.ok && opd.data.session_no === 1, JSON.stringify(opd));

console.log("4) ปิดเคสโดยไม่วัดตัว → ต้องโดน block");
const closeEarly = await call("admin", "POST", `/opd/${opd.data.opd_ID}/close`);
ok("ยังไม่วัดตัว → 400", closeEarly.status === 400);

console.log("5) วัดตัว + บันทึกหัตถการ + add-on");
const meas = await call("acception", "PUT", `/opd/${opd.data.opd_ID}`, {
  opd_data: { blood_pressure: "120/80", weight_kg: 55, height_cm: 160 },
  BT_ID: "US-007",
});
ok("วัดตัวสำเร็จ", meas.ok && meas.data.status === "measuring");
const proc = await call("admin", "PUT", `/opd/${opd.data.opd_ID}`, {
  procedures_done: [
    { medical_procedure_ID: "MP-002", name: "เตรียมผิว/แปะยาชา", type: "BT", performed_by: "US-007", cost: 150 },
    { medical_procedure_ID: "MP-001", name: "ฉีด Botox", type: "doctor", performed_by: "US-005", cost: 500 },
  ],
});
ok("บันทึกหัตถการ", proc.ok);
const addon = await call("acception", "POST", `/opd/${opd.data.opd_ID}/addon`, {
  product_ID: "PD-003", qty: 1, method: "cash",
});
ok("add-on มาส์กทองคำ 900฿ แยกบิล", addon.ok && addon.data.price === 900);

console.log("6) ปิดเคส — ตัด stock FIFO + นับครั้ง + ค่ามือ");
const closed = await call("admin", "POST", `/opd/${opd.data.opd_ID}/close`);
ok("ปิดเคสสำเร็จ", closed.ok, JSON.stringify(closed));
ok("ตัด 2cc จาก lot แรก (FIFO)", closed.data?.stock_used?.[0]?.lot_ID === "LOT-00001" && closed.data?.stock_used?.[0]?.cc_used === 2);
ok("ต้นทุนจริง lot 3500฿/10cc → 2cc = 700฿", closed.data?.stock_used?.[0]?.cost_of_goods === 700);
ok("เหลือ 4 ครั้ง", closed.data?.uses_remaining === 4);
ok("สร้างค่ามือ 2 รายการ (BT+หมอ)", closed.data?.earnings_created === 2);
const closedAgain = await call("admin", "POST", `/opd/${opd.data.opd_ID}/close`);
ok("ปิดซ้ำ → 409", closedAgain.status === 409);

console.log("7) ตรวจ stock: ขวดแรกเป็น in_use เหลือ 8cc/4ครั้ง");
const items = await call("admin", "GET", "/stock/items?branch_ID=BR-001&product_ID=PD-001");
const used = items.data.find((i) => i.state === "in_use");
ok("มีขวด in_use", !!used);
ok("เหลือ 8cc / 4 ครั้ง / มีวันควรใช้ก่อน", used?.cc_remaining === 8 && used?.uses_remaining === 4 && !!used?.open_expiry_at);

console.log("8) จ่ายงวดผ่อน 10,000 → paid ครบ");
const paid = await call("admin", "POST", `/customer-courses/${cc.customer_course_ID}/pay`, {
  amount: 10000, method: "cash",
});
ok("จ่ายครบ balance = 0", paid.ok && paid.data.balance_due === 0);

console.log("9) การเงิน + สิทธิ์");
const fin = await call("admin", "GET", `/finance/summary?branch_ID=BR-001&from=${today}&to=${today}`);
ok("รายรับวันนี้ = 5000 (งวดแรก) + 900 (add-on) + 10000 (งวดผ่อน) = 15900", fin.data?.income === 15900, `got ${fin.data?.income}`);
// COGS = 700 (คอร์ส 2cc) + 300 (add-on มาส์ก PD-003 ตัด stock ตอนปิดเคส) = 1000
ok("COGS = 1000 (คอร์ส 700 + add-on 300)", fin.data?.cogs === 1000, `got ${fin.data?.cogs}`);
// ค่าแรง = ค่ามือหัตถการ 650 (BT150+หมอ500) เท่านั้น — คอม sale เป็นขั้นบันไดรายเดือน (หน้า /commission) ไม่ลง daily
ok("ค่าแรง = ค่ามือ 650 (150+500)", fin.data?.labor_cost === 650, `got ${fin.data?.labor_cost}`);
const finAsDoctor = await call("doctor", "GET", `/finance/summary?branch_ID=BR-001`);
ok("หมอเปิดหน้าการเงินรวม → 403", finAsDoctor.status === 403);
const earnDoctor = await call("doctor", "GET", `/earnings?from=${today}&to=${today}`);
ok("หมอเห็นรายได้ตัวเอง 500฿", earnDoctor.data?.total === 500 && earnDoctor.data?.user_ID === "US-005");

console.log(`\nผลรวม: ${pass} ผ่าน, ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
