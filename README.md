# โอสถ (OSOTH) — ERP คลินิคเสริมความงาม

ระบบบริหารคลินิคเสริมความงาม: จองคิว / OPD / ตัด stock แบบ sub-unit / course / การเงิน / HR
Spec ฉบับเต็มอยู่ที่ [`data_structure.md`](data_structure.md) · รายงานผลทดสอบ [`test_function.pdf`](test_function.pdf)

## Tech Stack

- Next.js 16 (App Router, fullstack) + React 19
- MongoDB + Mongoose
- Redux Toolkit (auth mock + ภาษา)
- i18n ไทย/อังกฤษ (สลับที่ปุ่มมุมขวาบน)
- Docker (deploy)

## รันครั้งแรก (dev)

ต้องมี MongoDB รันอยู่ที่ `localhost:27017` (มี service ในเครื่อง หรือ `docker compose up mongo -d`)

```bash
npm install
npm run seed      # ใส่ข้อมูลตัวอย่าง (ล้างของเดิมทั้งหมด!)
npm run dev       # http://localhost:3000
```

เข้าเว็บแล้ว **เลือกผู้ใช้จากหน้า mock login** — มีครบทุก role:
บอส (super_admin) / มิน (admin) / ฟ้า (acception) / เซล (sale 5%) / หมอมังกร·หมอหงส์ (doctor) / บีที1·บีที2 (BT)

## ทดสอบ business flow ทั้งวงจร

```bash
npm run seed && node scripts/smoke.mjs
# 27 ข้อ: ขาย course ผ่อนชำระ → จอง+กันจองซ้อน → HN → OPD → วัดตัว(บังคับ)
# → add-on แยกบิล → ปิดเคส (FIFO + ต้นทุนจริงตาม lot + ค่ามือ) → การเงิน + สิทธิ์
```

## Deploy ด้วย Docker

```bash
docker compose up -d --build      # app :3000 + mongo :27017
docker compose exec app npm run seed   # ครั้งแรกเท่านั้น
```

## โครงสร้างโค้ด (MVC)

| ชั้น | ที่อยู่ | หน้าที่ |
|---|---|---|
| Model | `models/` | Mongoose schema 17 collections ตาม data_structure.md |
| Service | `services/` | business logic: `closeCase` (ปิดเคส 5 ขั้น), `fifo`, `overlap` (กันจองซ้อน), `sales`, `stock`, `ids` (gen HN ตาม config) |
| Controller | `app/api/` | REST API + role guard (`lib/api.js`) |
| View | `app/*/page.js` | client components + Redux |

## กติกาสำคัญที่ฝังในระบบ

- **ปิดเคส** (admin/acception เท่านั้น) = trigger เดียว: ตัด stock FIFO → อัปเดตขวด (ครั้ง+cc) → นับครั้ง course → สร้างค่ามือหมอ/BT → คิวเป็น "เสร็จ"
- **FIFO**: ขวดที่เปิดแล้ว (in_use) ถูกใช้ก่อนขวดใหม่เสมอ, lot หมดอายุก่อนถูกหยิบก่อน
- **ต้นทุน**: คิดจากราคาทุนจริงของ lot ที่ถูกตัด ไม่ใช่ค่าเฉลี่ย
- **จองซ้อน**: block ทั้งห้องซ้อนและหมอซ้อน (คนละห้องก็ห้าม) ที่ API
- **จองก่อนมี HN ได้** — ระบบผูก HN ย้อนหลังให้ตอนเปิดเคสครั้งแรก
- **add-on**: เก็บเงินทันที แยกบิล ไม่ยุ่งกับเงิน course
- **mock auth**: ตัวตนส่งผ่าน header `x-user-id / x-user-role / x-branch-id` — เปลี่ยนเป็น NextAuth ได้ที่ `lib/api.js` จุดเดียว

## ปรับปรุงตามผลประเมิน HCI (2026-07-18)

จากผลประเมิน usability (`../OSOTH_HCI_Evaluation_TH.pdf`, 58/100) — ทำ Quick Wins + sev-3 + เริ่มฟีเจอร์ GAP:

**UX (Quick Wins):** ปุ่ม async มี spinner + toast (`components/ui.jsx` `<AsyncButton>` + `Toaster`) · เวลาจบ auto = เริ่ม + ระยะเวลา · error เป็น toast · แถบ legend สีสถานะ · เลื่อนจอไปหาการ์ดที่เลือก · **route guard** (เข้าหน้าที่ไม่มีสิทธิ์ → หน้า "ไม่มีสิทธิ์") · แสดงวันไทย DD/MM/พ.ศ. + เวลา 24 ชม. · Enter ค้นหา · **global search** บน topbar

**ฟีเจอร์รอบ 2 (update.md):**
- **แยกสาขาเต็ม**: catalog (course/product/procedure/promotion) มี `branch_ID` แยกต่อสาขา · owner เห็นทุกสาขา (topbar "ทุกสาขา") คนอื่นเฉพาะสาขาตัว · HN/ลูกค้ากลางเครือ
- **ปรึกษาหมอก่อนซื้อ** (ครั้งแรก): เปิดเคส → เลือก sale ดูแล → ส่งปรึกษาหมอ → ตกลง (ขาย/ชำระ) หรือ ไม่ซื้อ (ปิดเป็น `consult_no_sale` ไม่ตัด stock) · วัดตัวไม่บังคับถ้าแค่ปรึกษา
- **ตั้งราคาหน้างาน** (admin/owner): ปรับราคาคอร์สตอนขายได้ (sale → 403)
- **Add-on**: ตัด stock ตอนปิดเคส (`addon_sub_unit_per_use`×qty) · มี "คนแนะ" (sale/หมอ) คิดคอม · ครั้งแรก (session 1) รวมบิลคอร์ส
- **คอมมิชชั่น** (`/commission`): ขั้นบันไดยอดขาย sale ต่อเดือน (whole/marginal, ต่อสาขา) + ตารางคอม add-on (sale/หมอ) + รายงานต่อเดือน · คอม add-on ลงอัตโนมัติตอนปิดเคส
- **OPD เป็นตาราง**: filter สถานะ + นับเคส + ค้นหา + legend · spacing compact
- **แยกทำหัตถการเป็น 2 ขั้น**: `bt_stage` (BT ทำ pre-procedure) → `doctor_stage` (แพทย์ทำ) — บันทึกทีละขั้น เดินสถานะคิวบนปฏิทิน (ข้ามขั้นที่คอร์สไม่มีอัตโนมัติ)
- **เช็คสต๊อกก่อนทำหัตถการ**: คำนวณสินค้าที่คอร์สจะใช้ (sub_unit_per_use) เทียบสต๊อกคงเหลือ → เตือน + บล็อกทำหัตถการ/ปิดเคสถ้าของไม่พอ
- **แยกปฏิทินตามหน้าที่**: **ปฏิทิน (จองคิว)** `/calendar` — sale/admin จอง+เลือกคอร์ส (จัดการได้แค่เลื่อนนัด/ยกเลิก) · **ปฏิทิน (รับลูกค้า)** `/reception` — acception/admin รับลูกค้า (มาถึง/สร้าง HN/เปิดเคส) แล้วส่งต่อห้อง (OPD) ที่ panel ขวา
- **จัดซื้อ/สั่งของ** (`/purchasing`) — แนะนำสินค้าต่ำกว่าจุดสั่งซื้อ → สร้าง PO → กดรับของเข้า (สร้าง lot อัตโนมัติ)
- **ลงเวลาเข้า/ออกงาน** (`/attendance`) — พนักงานกดเข้า/ออก + admin ดูรายวัน
- **ปิดยอดสิ้นวัน** (ในหน้าการเงิน) — รายรับแยกช่องทาง + เงินสดที่ควรมี + รายการค้าง
- **แก้ไขลูกค้า + บันทึกแพ้ยา** (หน้าลูกค้า) · **เลื่อนนัด** (หน้าปฏิทิน)
- **flow ชำระเงินคอร์ส**: จองไม่ต้องจ่าย (ไม่มีมัดจำ) → จ่ายค่าคอร์ส **เต็มจำนวน** ก่อนทำหัตถการที่ OPD → **แยกช่องทางได้** (สด/โอน/บัตร) รวมให้ครบยอดถึงจะเริ่ม/ปิดเคสได้
- **Excel/CSV export** (`lib/exportCsv.js`) ที่การเงิน/ลูกค้า/HR/รายได้/จัดซื้อ/ลงเวลา
- **LINE แจ้งเตือนจอง** — `services/notify.js` เป็น adapter (stub) พร้อมต่อเมื่อตั้ง env `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_ID`
- **responsive พื้นฐาน** — จอ ≤900px sidebar เป็น drawer + hamburger

## ข้อจำกัดที่รู้อยู่ (ยังไม่ทำในเฟสนี้)

- ปิดเคสเป็น transaction จริงเมื่อ MongoDB เป็น replica set เท่านั้น (standalone จะรันตามลำดับ ไม่ rollback อัตโนมัติ)
- login เป็น mock ยังไม่มีรหัสผ่าน
- ตารางหมอ (HR) ยังไม่บังคับเช็คกับการจอง (จองนอกเวลาหมอได้ ระบบเตือนแค่จองซ้อน)
- LINE integration จริง, geofence, approval center รวมศูนย์, commission tiers, mobile-first เต็มรูปแบบ — ดู GAP Roadmap ใน `../data_structure.md`
