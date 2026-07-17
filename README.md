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

## ข้อจำกัดที่รู้อยู่ (ยังไม่ทำในเฟสนี้)

- ปิดเคสเป็น transaction จริงเมื่อ MongoDB เป็น replica set เท่านั้น (standalone จะรันตามลำดับ ไม่ rollback อัตโนมัติ)
- login เป็น mock ยังไม่มีรหัสผ่าน
- ตารางหมอ (HR) ยังไม่บังคับเช็คกับการจอง (จองนอกเวลาหมอได้ ระบบเตือนแค่จองซ้อน)
