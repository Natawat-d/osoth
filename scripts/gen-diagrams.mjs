// เรนเดอร์ diagram การทำงานแต่ละ flow (mermaid → PNG) ธีมโรส-ไวน์
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("test-artifacts/diagrams");
fs.mkdirSync(OUT, { recursive: true });

const DIAGRAMS = {
  "f01-access": `flowchart TD
  S([เข้าเว็บ]) --> L{เลือกบทบาท}
  L -->|ลูกค้า| C[หน้าร้าน /store<br/>anonymous ไม่ต้องล็อกอิน]
  L -->|พนักงาน| P[ฟอร์มล็อกอิน<br/>username + รหัส]
  P --> V{ถูกต้อง?}
  V -->|ผิด 5 ครั้ง| K[ล็อก 15 นาที]
  V -->|ใช่| J[ออก JWT<br/>httpOnly cookie]
  J --> R{ตามบทบาท}
  R --> RA[super_admin/admin: ทุกเมนู]
  R --> RB[sale/acception: จอง/OPD]
  R --> RC[doctor/BT: คิวฉัน/รายได้]`,

  "f02-storefront": `flowchart TD
  A([ลูกค้าเปิด /store]) --> B[เลือกสาขา<br/>เฉพาะที่เปิดหน้าร้าน]
  B --> C[ดูปฏิทินคิว<br/>โหมด privacy]
  C --> D{สนใจจอง?}
  D -->|ใช่| E[กดโทร / แอด LINE]
  D -->|ดูต่อ| C
  C -.ไม่เห็นชื่อผู้จอง.-> C`,

  "f03-staff-account": `flowchart TD
  A([เจ้าของ → หน้า HR]) --> B[ตั้ง username + รหัสเริ่มต้น]
  B --> C[ระบบตั้ง must_change=true]
  C --> D([พนักงานล็อกอินครั้งแรก])
  D --> E[บังคับตั้งรหัสใหม่]
  E --> F[เข้าใช้งานได้]
  A --> G[รีเซ็ตรหัส / ปิดใช้งาน]`,

  "f04-sale": `flowchart TD
  A([Sale เลือกคอร์สให้ลูกค้า]) --> B[บันทึกราคาเต็ม +<br/>snapshot คอร์ส]
  B --> C{ชำระ}
  C -->|เต็มจำนวน| D[paid]
  C -->|บางส่วน| E[partial · ค้างผ่อน]
  D --> F[คิดคอมมิชชั่น sale<br/>ตาม % ขั้นบันได]
  E --> F
  E --> G([จ่ายงวดถัดไปที่หน้าลูกค้า]) --> H{ครบ?}
  H -->|ครบ| D`,

  "f05-booking": `flowchart TD
  A([เลือกห้อง/เวลา/หมอ]) --> B{ห้องชนเวลา?}
  B -->|ชน| X[409 กันจองซ้อน]
  B -->|ว่าง| C{หมอชนเวลา?}
  C -->|ชน| X
  C -->|ว่าง| D[บันทึกคิว = จองแล้ว]
  D --> E[แสดงบนปฏิทิน<br/>ต่อเวลาพอดีไม่ถือว่าชน]`,

  "f06-reception": `flowchart TD
  A([ลูกค้ามาถึง]) --> B{มี HN?}
  B -->|ยัง| C[สร้าง HN อัตโนมัติ<br/>ตาม format]
  B -->|มีแล้ว| D[ค้นด้วย HN/ชื่อ/เบอร์]
  C --> E[อัปเดตสถานะ = มาถึง]
  D --> E
  E --> F{ผูกคอร์สแล้ว?}
  F -->|ยัง| G[เลือกคอร์สก่อน]
  F -->|แล้ว| H[เปิดเคส OPD]
  G --> H`,

  "f07-opd": `flowchart TD
  A([เปิดเคส]) --> B[วัดสัญญาณชีพ<br/>บังคับก่อนทำ]
  B --> C{ต้องปรึกษาหมอ?}
  C -->|ใช่| D[ปรึกษา → เลือกคอร์ส]
  C -->|ไม่| E
  D --> E{ชำระครบ?}
  E -->|ยัง| P[ชำระเงิน แยกช่องทาง<br/>สด/โอน/บัตร]
  P --> F
  E -->|ครบ| F[ตรวจสต๊อกก่อนทำ]
  F --> G[ขั้น BT pre-procedure]
  G --> H[ขั้นแพทย์<br/>ทำ BT เสร็จก่อน]
  H --> I{Add-on?}
  I -->|มี| J[คิดเงิน add-on + คอมคนแนะ]
  I -->|ไม่| K
  J --> K([ปิดเคส · Atomic])
  K --> L[ตัด stock FIFO → นับครั้ง →<br/>ค่ามือหมอ/BT → คิว=เสร็จ]`,

  "f08-stock": `flowchart TD
  A([รับของเข้า]) --> B[สร้าง lot + ขวดตามจำนวน<br/>บันทึกต้นทุน/วันหมดอายุ]
  B --> C[คงคลังเป็นหน่วยย่อย cc]
  C --> D{ตอนปิดเคส}
  D --> E[ตัดจากขวดเก่าสุดก่อน FIFO]
  E --> F{สต๊อกพอ?}
  F -->|ไม่พอ| X[กันตัดติดลบ]
  F -->|พอ| G[ขวดเปิดใช้ = in_use<br/>เหลือ cc/ครั้ง]
  A --> H[ทิ้งขวดเสีย = discarded]`,

  "f09-purchasing": `flowchart TD
  A([ระบบเช็คสินค้าต่ำกว่า reorder]) --> B[แสดงรายการต้องสั่ง]
  B --> C[สร้าง PO = draft]
  C --> D[ยืนยันสั่ง = ordered]
  D --> E([ของมาถึง])
  E --> F[กดรับเข้า = received]
  F --> G[เพิ่ม stock lot อัตโนมัติ]`,

  "f10-customer": `flowchart TD
  A([ค้นหาลูกค้า HN/ชื่อ/เบอร์]) --> B[เปิดโปรไฟล์]
  B --> C[ดูคอร์สที่ถือ + ประวัติ]
  B --> D[แก้ไขข้อมูล + แพ้ยา/โรคประจำตัว]
  B --> E{มีค้างผ่อน?}
  E -->|มี| F[จ่ายงวด → อัปเดตยอดค้าง]
  F --> G{ครบ?}
  G -->|ครบ| H[paid]`,

  "f11-finance": `flowchart TD
  A([เลือกช่วงวัน + สาขา]) --> B[รวมรายรับ/รายจ่าย]
  B --> C[ต้นทุนจริง COGS จาก lot<br/>+ ค่ามือ + คอม]
  C --> D[กราฟแนวโน้ม + แยกช่องทาง/ประเภท]
  A --> E[ปิดยอดสิ้นวัน<br/>เงินสดที่ควรมี + เคสค้าง]
  B --> F[ส่งออก CSV / PDF]`,

  "f12-commission": `flowchart TD
  A([ตั้งค่าคอมต่อสาขา]) --> B{โหมด}
  B -->|ทั้งก้อน| C[ยอดรวมเข้าเกณฑ์ขั้นบันได]
  B -->|แยกคอร์ส| D[คิดทีละคอร์ส]
  C --> E[ได้ % ตามชั้นยอดขาย]
  D --> E
  A --> F[add-on คิดคอมให้ผู้แนะนำ]`,

  "f13-attendance": `flowchart TD
  A([พนักงานกดเข้างาน]) --> B[บันทึก check_in เวลา]
  B --> C([เลิกงานกดออก])
  C --> D[บันทึก check_out]
  D --> E[admin ดูรายวันทั้งสาขา]`,

  "f14-leave": `flowchart TD
  A([พนักงานยื่นลา]) --> B{ลาป่วยเกินเกณฑ์?}
  B -->|ใช่| C[ต้องแนบใบรับรองแพทย์]
  B -->|ไม่| D[รออนุมัติ]
  C --> D
  D --> E{admin}
  E -->|อนุมัติ| F[approved]
  E -->|ไม่อนุมัติ| G[rejected + เหตุผล]
  F --> H[แสดงใน KPI + ขาดงานรายวัน]`,

  "f15-hr": `flowchart TD
  A([HR: จัดการพนักงาน]) --> B[เพิ่ม/แก้ไข/ย้ายสาขา<br/>ประวัติเงินยังอยู่]
  A --> C[ตั้งตารางหมอประจำห้อง<br/>รายสัปดาห์ + override รายวัน]
  A --> D[ดูอัตราทำเคส throughput<br/>ใครทำอะไรบ้าง]
  A --> E[จัดการบัญชี login]`,

  "f16-earning-rbac": `flowchart TD
  A([หมอ/BT/Sale เข้าระบบ]) --> B[รายได้ของฉัน<br/>เห็นเฉพาะของตัวเอง]
  A --> C{เปิดหน้าการเงินรวม?}
  C -->|ไม่มีสิทธิ์| X[403 · หน้าไม่มีสิทธิ์เข้าถึง]
  C -.เมนูถูกซ่อนตามบทบาท.-> A`,

  "f17-branch-settings": `flowchart TD
  A([owner สลับสาขาบน topbar]) --> B[ดูข้อมูลแยก/รวมสาขา]
  A --> C[ตั้งค่าสาขา: เปิดหน้าร้าน + LINE]
  A --> D[ตั้ง format เลข HN]
  A --> E[ห้องทำหัตถการ = แกนปฏิทิน]
  A --> F[Catalog แยกสาขา:<br/>คอร์ส/โปร/สินค้า/หัตถการ]`,
};

const brand = {
  theme: "base",
  themeVariables: {
    primaryColor: "#f7e9ee", primaryBorderColor: "#a8455c", primaryTextColor: "#241a1d",
    lineColor: "#7e2f43", secondaryColor: "#f6efdc", secondaryBorderColor: "#a5842f",
    tertiaryColor: "#e7f1eb", tertiaryBorderColor: "#2f7d5b",
    fontFamily: "Sarabun, Segoe UI, sans-serif", fontSize: "17px",
  },
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

let n = 0;
for (const [key, def] of Object.entries(DIAGRAMS)) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>body{margin:0;background:#fff}#wrap{display:inline-block;padding:26px;background:#fff}</style>
</head><body><div id="wrap"><pre class="mermaid">${def}</pre></div>
<script>mermaid.initialize(${JSON.stringify({ startOnLoad: true, securityLevel: "loose", flowchart: { htmlLabels: true, curve: "basis" }, ...brand })});</script>
</body></html>`;
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForSelector(".mermaid svg", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  const el = await page.$("#wrap");
  if (el) { await el.screenshot({ path: path.join(OUT, key + ".png") }); n++; console.log("  🖼 ", key); }
  else console.log("  ✗ ", key);
}
await browser.close();
console.log(`\nเสร็จ · ${n} diagram → test-artifacts/diagrams/`);
