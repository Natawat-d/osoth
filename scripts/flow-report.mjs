// สร้างเอกสาร flow การทำงาน + data flow ของระบบ โอสถ (OSOTH) → flow_report.pdf
import { chromium } from "playwright";
import path from "path";
const OUT = path.resolve("..", "flow_report.pdf");

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing:border-box; }
body { font-family:'Tahoma','Leelawadee UI',sans-serif; color:#201d1a; margin:0; font-size:12px; }
.cover { background:linear-gradient(160deg,#241f1a,#17130f); color:#fff; padding:66px 50px; }
.cover .mark { width:70px;height:70px;border-radius:18px;background:#b23a33;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 0 2px #e3d6b6; }
.cover h1 { font-size:32px; margin:22px 0 6px; }
.cover .sub { color:#e3d6b6; font-size:15px; }
.cover .meta { margin-top:24px; color:#c9c0b0; font-size:13px; line-height:1.9; }
.section { padding:24px 34px; }
h2 { color:#8f2b25; border-bottom:2px solid #e3d6b6; padding-bottom:6px; font-size:18px; margin-top:6px; }
h3 { color:#201d1a; font-size:14px; margin:18px 0 8px; }
p.lead { color:#5c574f; margin:6px 0 14px; }
.pagebreak { page-break-before:always; }

/* flow horizontal */
.flow { display:flex; align-items:stretch; flex-wrap:wrap; gap:0; margin:10px 0 6px; }
.node { border:1.5px solid #d8d1c4; border-radius:10px; padding:9px 12px; background:#fff; min-width:112px; text-align:center; position:relative; box-shadow:0 1px 2px rgba(0,0,0,.05); }
.node .nt { font-weight:bold; font-size:12px; }
.node .ns { font-size:10.5px; color:#6b6862; margin-top:2px; }
.arr { display:flex; align-items:center; justify-content:center; color:#a5842f; font-size:20px; padding:0 8px; font-weight:bold; }
/* actor colors */
.a-sale{ border-color:#34618f; background:#eef3f8 } .a-sale .nt{ color:#274c70 }
.a-rec{ border-color:#a5842f; background:#f8f2e2 } .a-rec .nt{ color:#7a611f }
.a-doc{ border-color:#2f7d5b; background:#e9f2ec } .a-doc .nt{ color:#245e44 }
.a-bt{ border-color:#7a4f96; background:#f0eaf5 } .a-bt .nt{ color:#5c3b73 }
.a-adm{ border-color:#b23a33; background:#f9ecea } .a-adm .nt{ color:#8f2b25 }
.a-sys{ border-color:#4a463f; background:#efece7 } .a-sys .nt{ color:#2b2823 }

/* vertical flow */
.vflow { margin:8px 0; }
.vnode { border:1.5px solid #d8d1c4; border-left:4px solid #a5842f; border-radius:8px; padding:10px 14px; background:#fff; margin:0; }
.vnode b { font-size:12.5px; } .vnode .d { font-size:11px; color:#5c574f; margin-top:2px; }
.varr { text-align:center; color:#a5842f; font-size:16px; line-height:1.1; margin:2px 0; }

/* atomic box */
.atomic { border:2px solid #b23a33; border-radius:12px; background:#fdf4f2; padding:14px 16px; margin:10px 0; }
.atomic .title { font-weight:bold; color:#8f2b25; font-size:14px; margin-bottom:8px; }
.astep { display:flex; gap:10px; align-items:flex-start; padding:6px 0; border-bottom:1px dashed #e6c3c0; }
.astep:last-child { border-bottom:none; }
.astep .num { width:22px;height:22px;border-radius:50%;background:#b23a33;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;flex-shrink:0; }

/* data-flow grid */
.legend { display:flex; gap:14px; flex-wrap:wrap; margin:8px 0 14px; font-size:11px; }
.legend span { display:flex; align-items:center; gap:6px; }
.sw { width:12px;height:12px;border-radius:3px;display:inline-block; }

table { width:100%; border-collapse:collapse; font-size:11.5px; margin:8px 0; }
th { background:#faf8f4; text-align:left; padding:7px 9px; border-bottom:2px solid #e3d6b6; color:#5c574f; }
td { padding:7px 9px; border-bottom:1px solid #eee; vertical-align:top; }
.mono { font-family:monospace; color:#8f2b25; }
.sm-flow { font-family:monospace; font-size:11px; background:#faf8f4; border:1px solid #eee; border-radius:8px; padding:10px 12px; margin:6px 0; line-height:1.7; }
.note { background:#f8f2e2; border:1px dashed #e3d6b6; border-radius:8px; padding:10px 12px; font-size:11.5px; color:#5c574f; }
</style></head><body>

<div class="cover">
  <div class="mark">☯</div>
  <h1>Flow การทำงาน &amp; Data Flow — โอสถ (OSOTH)</h1>
  <div class="sub">ERP คลินิคเสริมความงาม · เอกสารอธิบายขั้นตอนการทำงานตั้งแต่ต้นจนจบ</div>
  <div class="meta">
    วันที่: ${today}<br/>
    เนื้อหา: ขั้นตอนพัฒนา · flow ธุรกิจ (ลูกค้า→ปิดเคส) · การปิดเคสแบบ atomic · data flow ระหว่าง collection ·
    state machines · flow การเงิน · หน้าที่ตาม role<br/>
    Stack: Next.js 16 · MongoDB/Mongoose · Redux · MVC
  </div>
</div>

<div class="section">
  <h2>1. ขั้นตอนการพัฒนา (ตั้งแต่แรก)</h2>
  <p class="lead">ลำดับการสร้างระบบ — เก็บ requirement → ออกแบบข้อมูล → หลังบ้าน → หน้าบ้าน → ทดสอบ → ส่งมอบ</p>
  <div class="flow">
    <div class="node a-sys"><div class="nt">1 Requirements</div><div class="ns">ถาม 30+ ข้อ<br/>(กดเลือกตอบ)</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">2 Data Structure</div><div class="ns">data_structure.md<br/>18 collections</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">3 Models</div><div class="ns">Mongoose schema</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">4 Services</div><div class="ns">closeCase, FIFO,<br/>overlap, sales</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">5 API (MVC)</div><div class="ns">app/api + role guard</div></div>
  </div>
  <div class="flow">
    <div class="node a-sys"><div class="nt">6 UI</div><div class="ns">ปฏิทิน/OPD/stock/<br/>การเงิน/HR/ลา</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">7 Theme + i18n</div><div class="ns">ธีมจีน · ไทย/อังกฤษ</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">8 Test</div><div class="ns">Playwright e2e<br/>72 เคส</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">9 Deploy</div><div class="ns">Docker + compose</div></div>
  </div>
</div>

<div class="section">
  <h2>2. Flow ธุรกิจหลัก — เส้นทางลูกค้า 1 เคส</h2>
  <p class="lead">ตั้งแต่ขาย/จอง จนปิดเคส (สีกล่อง = ผู้รับผิดชอบตาม role)</p>
  <div class="legend">
    <span><i class="sw" style="background:#34618f"></i>Sale</span>
    <span><i class="sw" style="background:#a5842f"></i>Acception</span>
    <span><i class="sw" style="background:#7a4f96"></i>BT</span>
    <span><i class="sw" style="background:#2f7d5b"></i>หมอ</span>
    <span><i class="sw" style="background:#b23a33"></i>Admin</span>
    <span><i class="sw" style="background:#4a463f"></i>ระบบ (อัตโนมัติ)</span>
  </div>
  <div class="flow">
    <div class="node a-sale"><div class="nt">ขายคอร์ส</div><div class="ns">customer_course<br/>+ ผ่อนชำระ + คอม</div></div>
    <div class="arr">→</div>
    <div class="node a-sale"><div class="nt">จองคิว</div><div class="ns">reserve · เลือกห้อง/หมอ</div></div>
    <div class="arr">→</div>
    <div class="node a-sys"><div class="nt">เช็คจองซ้อน</div><div class="ns">ห้อง+หมอ ทับเวลา<br/>→ block 409</div></div>
    <div class="arr">→</div>
    <div class="node a-rec"><div class="nt">ลูกค้ามาถึง</div><div class="ns">status: arrived</div></div>
    <div class="arr">→</div>
    <div class="node a-rec"><div class="nt">สร้าง/ค้น HN</div><div class="ns">ลูกค้าใหม่ = gen HN<br/>ผูกเข้าคอร์ส</div></div>
  </div>
  <div class="flow">
    <div class="node a-rec"><div class="nt">เปิดเคส OPD</div><div class="ns">opd · session_no</div></div>
    <div class="arr">→</div>
    <div class="node a-rec"><div class="nt">วัดตัว (บังคับ)</div><div class="ns">ความดัน/น้ำหนัก...<br/>ไม่วัด = ปิดเคสไม่ได้</div></div>
    <div class="arr">→</div>
    <div class="node a-bt"><div class="nt">BT pre-proc</div><div class="ns">(ข้ามได้ตาม course)</div></div>
    <div class="arr">→</div>
    <div class="node a-doc"><div class="nt">หมอทำหัตถการ</div><div class="ns">(ข้ามได้ตาม course)</div></div>
    <div class="arr">→</div>
    <div class="node a-adm"><div class="nt">ปิดเคส ★</div><div class="ns">admin/acception<br/>trigger เดียว</div></div>
  </div>
  <div class="note">★ การกด "ปิดเคส" คือหัวใจของระบบ — จุดเดียวที่ทำ 5 อย่างพร้อมกันแบบ atomic (ดูข้อ 3)</div>
</div>

<div class="section pagebreak">
  <h2>3. การปิดเคส — Atomic Operation (5 ขั้นในครั้งเดียว)</h2>
  <p class="lead">เมื่อ admin กด "ปิดเคส" ระบบทำทั้ง 5 อย่างในทรานแซกชันเดียว (ถ้า mongo เป็น replica set จะ rollback ได้)</p>
  <div class="atomic">
    <div class="title">🔒 closeCase(opd_ID)</div>
    <div class="astep"><div class="num">1</div><div><b>ตัด stock แบบ FIFO</b> — เลือกขวดที่เปิดแล้ว (in_use) ก่อนขวดใหม่ · lot หมดอายุก่อนถูกหยิบก่อน · ตามสูตร course (sub_unit ต่อครั้ง)</div></div>
    <div class="astep"><div class="num">2</div><div><b>อัปเดตขวด</b> — ลด cc_remaining / uses_remaining · เปลี่ยน state (unused→in_use→empty) · บันทึกวันหมดอายุหลังเปิด · เขียน usage_log</div></div>
    <div class="astep"><div class="num">3</div><div><b>นับครั้งคอร์ส</b> — customer_course.uses_remaining − 1 · ครบแล้ว → status = completed</div></div>
    <div class="astep"><div class="num">4</div><div><b>สร้างค่ามือ</b> — staff_earning ให้หมอ/BT ตามหัตถการที่ทำ (เรทคงที่ต่อครั้ง)</div></div>
    <div class="astep"><div class="num">5</div><div><b>ปิดคิว</b> — reserve.status = done · opd.status = closed · บันทึกต้นทุนจริง (cost_of_goods ตาม lot) ลง opd.stock_used</div></div>
  </div>
  <div class="note">การเงินคิดต้นทุนจากราคาจริงของ lot ที่ถูกตัด: cost = (cc_used / sub_unit_size) × cost_price_per_unit ของ lot นั้น</div>
</div>

<div class="section">
  <h2>4. Data Flow — ข้อมูลไหลระหว่าง collection</h2>
  <p class="lead">ลำดับการเขียนข้อมูลของ 1 เคส (ลูกศร = สร้าง/อัปเดต)</p>
  <div class="sm-flow">
customer_course ──(จอง)──▶ reserve ──(เปิดเคส)──▶ opd ──(ปิดเคส)─┬─▶ inventory_item (ตัด cc, state)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─▶ customer_course.uses_remaining −−<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─▶ staff_earning (ค่ามือหมอ/BT)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├──(ขายคอร์ส)──▶ payment (course_purchase / installment)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├──(คอมมิชชั่น)──▶ staff_earning (sale)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──(add-on หน้างาน)──▶ payment (add_on, แยกบิล) + opd.add_ons<br/>
<br/>
stock_lot ──(รับของเข้า)──▶ inventory_item[]&nbsp;&nbsp;&nbsp;&nbsp;(1 lot → หลายขวด)<br/>
payment + opd.stock_used + staff_earning + expense ──▶ finance/summary (สรุป + กราฟ)
  </div>
  <table>
    <thead><tr><th>Collection</th><th>เขียนโดย (event)</th><th>ใช้ต่อที่</th></tr></thead>
    <tbody>
      <tr><td class="mono">reserve</td><td>จองคิว / เปลี่ยนสถานะ</td><td>ปฏิทิน, OPD, กันจองซ้อน</td></tr>
      <tr><td class="mono">opd</td><td>เปิดเคส → วัดตัว → ปิดเคส</td><td>ประวัติหัตถการ, การเงิน (COGS)</td></tr>
      <tr><td class="mono">inventory_item</td><td>รับของเข้า / ปิดเคส (ตัด)</td><td>สรุป stock, ต้นทุน</td></tr>
      <tr><td class="mono">customer_course</td><td>ขายคอร์ส / ปิดเคส / จ่ายงวด</td><td>สิทธิ์คงเหลือ, ลูกหนี้</td></tr>
      <tr><td class="mono">payment</td><td>ซื้อคอร์ส / ผ่อน / add-on</td><td>รายรับ (แยกช่องทาง/ประเภท)</td></tr>
      <tr><td class="mono">staff_earning</td><td>ปิดเคส (ค่ามือ) / ขาย (คอม)</td><td>รายได้ของฉัน, HR throughput</td></tr>
    </tbody>
  </table>
</div>

<div class="section pagebreak">
  <h2>5. State Machines</h2>
  <h3>คิวจอง (reserve)</h3>
  <div class="sm-flow">booked → arrived → ready → in_progress → done<br/>booked → cancelled | no_show&nbsp;&nbsp;&nbsp;&nbsp;(เลื่อนนัด = แก้ วัน/เวลา/ห้อง + เก็บ history)</div>
  <h3>เคสหัตถการ (opd)</h3>
  <div class="sm-flow">open → measuring → (bt_stage) → (doctor_stage) → closed&nbsp;&nbsp;&nbsp;(ข้ามขั้น BT/หมอได้ตาม course · ปิดแล้วแก้ไม่ได้)</div>
  <h3>ขวดสินค้า (inventory_item)</h3>
  <div class="sm-flow">unused → in_use → empty&nbsp;&nbsp;&nbsp;(+ discarded ได้จากทุก state · เตือนเมื่อเกินวันหมดอายุหลังเปิด)</div>
  <h3>คอร์สลูกค้า (customer_course)</h3>
  <div class="sm-flow">active → completed (ใช้ครบ) | expired (เลยกำหนด) | cancelled&nbsp;&nbsp;&nbsp;· payment: unpaid → partial → paid</div>
</div>

<div class="section">
  <h2>6. Flow การเงิน</h2>
  <p class="lead">กำไรคำนวณจากข้อมูลจริงของแต่ละเคส ไม่ใช่ค่าประมาณ</p>
  <div class="flow">
    <div class="node a-sys" style="min-width:150px"><div class="nt">รายรับ</div><div class="ns">Σ payment (สด/โอน/บัตร)</div></div>
    <div class="arr">−</div>
    <div class="node a-adm"><div class="nt">COGS</div><div class="ns">ต้นทุนจริงตาม lot<br/>ที่ถูกตัด</div></div>
    <div class="arr">−</div>
    <div class="node a-adm"><div class="nt">ค่าแรง</div><div class="ns">ค่ามือ + คอม</div></div>
    <div class="arr">−</div>
    <div class="node a-adm"><div class="nt">รายจ่ายอื่น</div><div class="ns">เช่า/เงินเดือน/น้ำไฟ</div></div>
    <div class="arr">=</div>
    <div class="node a-doc" style="min-width:130px"><div class="nt">กำไรคงเหลือ</div><div class="ns">กราฟเส้น + วง<br/>แยก/รวมสาขา · PDF</div></div>
  </div>
  <div class="note">ลูกหนี้ค้างผ่อน = Σ customer_course.balance_due (payment_status ≠ paid) · ดูรายคนได้จาก staff_earning</div>
</div>

<div class="section">
  <h2>7. หน้าที่ตาม Role (สิทธิ์การเข้าถึง)</h2>
  <table>
    <thead><tr><th>Role</th><th>ทำอะไรได้</th></tr></thead>
    <tbody>
      <tr><td class="mono">super_admin</td><td>ทุกอย่าง · สลับ/ดูรวมทุกสาขา · ตั้งค่าระบบ</td></tr>
      <tr><td class="mono">admin</td><td>จัดการคิว · <b>ปิดเคส</b> · stock · การเงิน · CRUD ข้อมูลหลัก · อนุมัติลา</td></tr>
      <tr><td class="mono">acception</td><td>OPD · สร้าง HN · จัดการคิว · วัดตัว · ปิดเคส</td></tr>
      <tr><td class="mono">sale</td><td>จองคิว · ขายคอร์ส · รับคอมมิชชั่น</td></tr>
      <tr><td class="mono">doctor / BT</td><td>ดูคิวตัวเอง · บันทึกหัตถการ · ดูรายได้ของตัวเองเท่านั้น</td></tr>
    </tbody>
  </table>
  <div class="note">พนักงานทำงานได้เฉพาะสาขาตัวเอง (super_admin เท่านั้นที่สลับสาขาได้) · ย้ายสาขาได้ ประวัติเงินเดิมยังอยู่ · stock แยกสาขา · ทุกคนยื่นลาได้ (admin อนุมัติ)</div>
</div>

</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({ path: OUT, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
await browser.close();
console.log("📄 สร้าง PDF: " + OUT);
