# โอสถ (OSOTH) — ERP คลินิคเสริมความงาม

> ฉบับปรับปรุงตามการตัดสินใจ requirement 30+ ข้อ (2026-07-18)
> เอกสารนี้คือ single source of truth ของ data structure และ business rules ทั้งหมด

## Overview

- ERP ระบบร้านคลินิคเสริมความงาม รองรับ **หลายสาขา (multi-branch) ตั้งแต่แรก** — ทุก collection ที่เป็นข้อมูล operation มี `branch_ID`
- จุดพิเศษของระบบคือการตัด stock แบบ **sub-unit**: สินค้า 1 หน่วย (เช่น ยา 1 ขวด 10cc) แบ่งใช้ได้หลายครั้ง
- ขวดแต่ละขวด (inventory item) มี state: `unused` (ยังไม่ใช้) → `in_use` (ใช้งานแล้ว/เปิดแล้วยังไม่หมด) → `empty` (หมด)
- ขวดที่เปิดแล้ว track **ทั้งจำนวนครั้งที่เหลือและปริมาณ cc ที่เหลือ**
- ขอบเขต: **full system ทุก module ตั้งแต่เวอร์ชั่นแรก** เริ่มข้อมูลจากศูนย์ (ไม่มี import)

## Business Rules สำคัญ (สรุปจากการตัดสินใจ)

| เรื่อง | กติกา |
|---|---|
| จุดตัด stock | ตัดตอน **ทำหัตถการเสร็จ** — admin/acception กด "ปิดเคส" เป็น trigger เดียว |
| ปิดเคส trigger | ตัด stock (FIFO) + นับครั้ง course (uses_remaining--) + สร้างรายการค่ามือหมอ/BT + คอมมิชชั่น sale |
| เลือก lot | **FIFO อัตโนมัติ** (เข้าก่อน/หมดอายุก่อน ใช้ก่อน) |
| ต้นทุน | ใช้ **ราคาทุนจริงของ lot ที่ถูกตัด** (ไม่ใช่ average) |
| หมดอายุหลังเปิดขวด | ระบบ **เตือนอย่างเดียว** ไม่บังคับทิ้ง (คำนวณจาก opened_at + shelf_life_after_open_days) |
| โดสต่อครั้ง | **กำหนดตายตัวใน course** (products[].sub_unit_per_use) |
| add_on | ลูกค้าทำเพิ่มระหว่าง OPD → **เก็บเงินทันที แยกบิล** ผูกกับ OPD ครั้งนั้น ไม่ยุ่งกับเงิน course |
| ค่ามือหมอ/BT | **เรทคงที่ต่อครั้ง (บาท)** ตาม medical_procedure.cost |
| คอม sale | **% ของยอดขาย course** (เรทต่อคน อยู่ที่ user.commission_rate) |
| ชำระเงิน | บันทึกช่องทาง (cash/transfer/card) + **ผ่อนชำระ course ได้** — track ยอดค้างใน customer_course |
| promotion | ได้ 2 แบบ: ส่วนลดทับ course เดิม หรือสร้าง course โปรใหม่แยกตัว |
| อายุ course | มีวันหมดอายุ **ตั้งต่อ course** (validity_days นับจากวันซื้อ) — เตือนก่อนหมด |
| ถือหลาย course | ลูกค้า 1 HN ถือ course ค้างพร้อมกันได้ **ไม่จำกัด** |
| สถานะจอง | booked → arrived → ready → in_progress → done (+ cancelled, no_show, rescheduled) |
| walk-in | รองรับ สร้างคิวหน้างานได้เลย |
| จองซ้อน | **block เด็ดขาด** — ห้อง+ช่วงเวลาซ้อนไม่ได้ และหมอคนเดียวซ้อน 2 ห้องไม่ได้ |
| จองก่อนมี HN | ได้ — จองด้วยชื่อ+เบอร์ สร้าง HN ตอนมา OPD ครั้งแรก แล้วผูกย้อนหลัง |
| OPD_data | **วัดทุกครั้ง บังคับ** ก่อนเข้าหัตถการ |
| format HN | **config ได้** (prefix + ปี + เลขรัน ฯลฯ ตั้งใน system_config) |
| flow เคส | OPD(วัดตัว) → BT pre → หมอทำ → ปิดเคส — **ข้ามขั้น BT หรือหมอได้** ตามชนิดหัตถการใน course |
| login | **mock ก่อน** (เลือก user จากรายการ ไม่มี password จริง) — โครงสร้างรองรับ auth จริงภายหลัง |
| สิทธิ์ role | super_admin: ทุกอย่าง / admin: คิว+ปิดเคส+stock / acception: OPD+คิว / sale: จอง+ขาย course / doctor+BT: คิวตัวเอง+บันทึกการทำ |
| รายได้พนักงาน | หมอ/BT **ดูรายได้สะสมเฉพาะของตัวเอง** ได้ |
| ตารางหมอ | **รายสัปดาห์ ทำซ้ำได้** + override รายวัน (ลา/สลับห้อง) |
| ห้อง | **config ได้** เพิ่ม/ลด/ปิดชั่วคราว — ปฏิทินปรับตาม |
| ภาษา | **i18n ไทย/อังกฤษ สลับได้** |
| อุปกรณ์ | เน้น desktop เป็นหลัก |
| ธีม UI | จีน "โอสถ" แบบ **เบา เน้นใช้งาน** — พื้นขาว/ดำสะอาด แดง+ขอบทองเฉพาะจุดสำคัญ มังกร/หยินหยาง subtle |

## Module

- **advert/sale** — จอง course ให้ลูกค้า ลงเวลานัด, ขาย course, ดูคอมมิชชั่นตัวเอง
- **OPD** — วัดความดัน/น้ำหนัก/ส่วนสูง (บังคับทุกครั้ง), ผูก/สร้าง HN, กำหนด BT ที่จะทำ pre-procedure
- **booking** — admin เปลี่ยนสถานะคิว (arrived → ready → in_progress → done), ปิดเคส
- **promotion_course** — จัดการ course และ promotion
- **stock** — รับของเข้า (lot), ดูขวดรายชิ้น, สถานะ, เตือนหมดอายุ
- **medical_procedure** — ตั้งค่าประเภทหัตถการ + เรทค่ามือ BT และหมอ
- **finance (รายรับรายจ่าย)** — หักทุนจริงตาม lot, ค่ามือรายคน, คอม sale, ยอดค้างผ่อน, สรุปคงเหลือ
- **HR** — พนักงาน 6 role, ตารางหมอประจำห้องรายสัปดาห์ + override

---

# Data Structure (MongoDB Collections)

> convention: ทุก collection มี `_id` (ObjectId), `created_at`, `updated_at` อัตโนมัติ
> field ที่เป็น "รหัสอ่านง่าย" (HN, RS-xxxx ฯลฯ) รันจาก `counter` collection แยกตามสาขา/ปี

## branch

```js
{
  branch_ID: "BR-001",            // รหัสสาขา
  name: "โอสถ สาขาสยาม",
  address: "",
  phone: "",
  active: true,
}
```

## room

```js
{
  room_ID: "RM-001",
  branch_ID: "BR-001",
  name: "ห้อง 1",
  order: 1,                       // ลำดับคอลัมน์บนปฏิทิน (แกน x)
  active: true,                   // ปิดห้องชั่วคราว → หายจากปฏิทิน + จองไม่ได้
}
```

## user (พนักงานทุก role)

```js
{
  user_ID: "US-001",
  branch_ID: "BR-001",            // สาขาหลัก
  role: "super_admin" | "admin" | "acception" | "sale" | "BT" | "doctor",
  full_name: "",
  nick_name: "",
  email: "",                      // mock login: เลือกจากรายชื่อ ยังไม่ใช้ password
  phone: "",
  commission_rate: 0,             // % คอม (ใช้กับ role sale เท่านั้น)
  color: "#c0392b",               // สีแสดงบนปฏิทิน (หมอ)
  active: true,
}
```

## doctor_schedule (ตารางหมอประจำห้อง)

```js
{
  branch_ID: "BR-001",
  doctor_ID: "US-005",            // ref user (role doctor)
  // template รายสัปดาห์ ทำซ้ำทุกสัปดาห์
  weekly: [
    { day_of_week: 1,             // 0=อาทิตย์ … 6=เสาร์
      room_ID: "RM-001",
      time_start: "10:00",
      time_end: "18:00" },
  ],
  // override รายวัน (ลา / สลับห้อง / เวลาพิเศษ) — ชนะ weekly เสมอ
  overrides: [
    { date: "2026-07-20",
      type: "leave" | "custom",
      room_ID: "RM-002",          // เมื่อ type=custom
      time_start: "12:00",
      time_end: "16:00" },
  ],
}
```

## customer (เดิมชื่อ HN_customer)

```js
{
  HN_number: "HN-2569-0001",      // format ตาม system_config, รันจาก counter
  branch_ID: "BR-001",            // สาขาที่ลงทะเบียนครั้งแรก (ข้อมูลลูกค้า share ทุกสาขา)
  full_name: "",
  sure_name: "",
  nick_name: "",
  phone: "",
  email: "",
  birth_date: "",
  gender: "",
  drug_allergies: [""],           // แพ้ยา
  chronic_diseases: [""],         // โรคประจำตัว
  note: "",
  active: true,
}
```

## product (catalog สินค้า — ไม่ใช่ stock จริง)

```js
{
  product_ID: "PD-001",
  name: "Botox 100u",
  type: "injection" | "consumable" | "other",
  unit: "ขวด",                    // หน่วยใหญ่
  sub_unit: "cc",                 // หน่วยย่อย
  sub_unit_size: 10,              // 1 unit = กี่ sub_unit (10cc/ขวด)  — 1 ถ้าแบ่งไม่ได้
  default_uses_per_unit: 5,       // มาตรฐาน 1 ขวดใช้ได้กี่ครั้ง (ไว้ estimate)
  selling_price: 0,               // ราคาขายตอนเป็น add_on
  reorder_point: 3,               // เตือนเมื่อ stock (นับ unit ยังไม่หมด) ต่ำกว่านี้
  shelf_life_after_open_days: 30, // เปิดขวดแล้วควรใช้ภายในกี่วัน (0 = ไม่เตือน)
  active: true,
}
// หมายเหตุ: cost_price ไม่อยู่ที่ product — อยู่ที่ stock_lot เพราะแต่ละ lot ราคาไม่เท่ากัน
```

## stock_lot (การรับของเข้าแต่ละครั้ง)

```js
{
  lot_ID: "LOT-0001",
  branch_ID: "BR-001",            // stock แยกสาขา
  product_ID: "PD-001",
  lot_number: "",                 // เลข lot จากผู้ผลิต
  supplier: "",
  cost_price_per_unit: 3500,      // ทุนจริงต่อ 1 unit ของ lot นี้ ← ใช้คิดต้นทุนในบัญชี
  quantity_received: 10,          // รับเข้ากี่ unit → สร้าง inventory_item เท่านั้นชิ้น
  expiry_date: "2027-01-01",      // หมดอายุบนฉลาก
  received_at: "2026-07-18",
  received_by: "US-002",
}
```

## inventory_item (ขวดจริงรายชิ้น — 1 doc = 1 unit)

```js
{
  item_ID: "IV-000001",
  branch_ID: "BR-001",
  product_ID: "PD-001",
  lot_ID: "LOT-0001",
  state: "unused" | "in_use" | "empty" | "discarded",
  opened_at: null,                // timestamp ตอน state เปลี่ยนเป็น in_use ครั้งแรก
  open_expiry_at: null,           // = opened_at + shelf_life_after_open_days (ไว้เตือน ไม่บังคับ)
  uses_remaining: 5,              // ครั้งที่เหลือ (เริ่ม = default_uses_per_unit)
  cc_remaining: 10,               // ปริมาณที่เหลือ (เริ่ม = sub_unit_size)
  usage_log: [                    // ประวัติการตัดทุกครั้ง — audit trail
    { opd_ID: "OPD-0001",
      session_no: 1,
      cc_used: 2,
      used_at: "",
      closed_by: "US-002" },
  ],
}
// FIFO: เวลาตัด เลือก item จาก lot ที่ expiry_date เก่าสุด → received_at เก่าสุด
// โดยให้ state=in_use มาก่อน unused (ใช้ขวดที่เปิดแล้วให้หมดก่อนเปิดขวดใหม่)
```

## medical_procedure

```js
{
  medical_procedure_ID: "MP-001",
  name: "ฉีด Botox",
  type: "BT" | "doctor",
  cost: 500,                      // ค่ามือเรทคงที่ บาท/ครั้ง
  active: true,
}
```

## course (catalog — สิ่งที่ขาย)

```js
{
  course_ID: "CS-001",
  name: "Botox หน้าเรียว 5 ครั้ง",
  quantity_used: 5,               // จำนวนครั้งทั้งหมดของ course
  validity_days: 365,             // อายุ course นับจากวันซื้อ (0 = ไม่หมดอายุ)
  price: 15000,                   // ราคาขายปกติ
  products: [                     // ของที่ใช้ "ต่อ 1 ครั้ง" — กำหนดตายตัว
    { product_ID: "PD-001",
      sub_unit_per_use: 2 },      // ครั้งละ 2cc
  ],
  BT_procedures: [                // ขั้น BT (ว่างได้ = ข้ามขั้น BT)
    { medical_procedure_ID: "MP-002" },
  ],
  doctor_procedures: [            // ขั้นหมอ (ว่างได้ = ข้ามขั้นหมอ)
    { medical_procedure_ID: "MP-001" },
  ],
  duration_minutes: 60,           // เวลามาตรฐานต่อครั้ง (ไว้ default ช่วงจองปฏิทิน)
  is_promotion_course: false,     // true เมื่อเป็น course โปรที่แตกมาจากตัวอื่น
  origin_course_ID: null,         // ref course ต้นทาง (กรณี course โปร)
  active: true,
}
```

## promotion

```js
{
  promotion_ID: "PM-001",
  name: "โปรตรุษจีน",
  type: "discount" | "new_course",
  // type=discount: ลดทับ course เดิม
  course_ID: "CS-001",
  discount_type: "percent" | "amount",
  discount_value: 10,
  // type=new_course: ชี้ไป course โปรที่สร้างใหม่ (is_promotion_course=true)
  promo_course_ID: null,
  date_start: "2026-07-01",
  date_end: "2026-07-31",
  banner_image: "",               // แสดง panel ขวาของปฏิทินลูกค้า
  active: true,
}
```

## customer_course (course ที่ลูกค้าซื้อแล้ว — 1 doc = 1 การซื้อ)

```js
{
  customer_course_ID: "CC-0001",
  branch_ID: "BR-001",
  HN_number: "HN-2569-0001",      // nullable ชั่วคราว ถ้าซื้อ/จองก่อนมี HN → ผูกตอน OPD แรก
  reserve_contact: {              // ใช้แทนตัวตนก่อนมี HN
    nick_name: "", phone: "", email: "" },
  course_ID: "CS-001",
  course_snapshot: {              // snapshot กันแก้ catalog ย้อนหลังแล้วข้อมูลเก่าเพี้ยน
    name: "", quantity_used: 5, price: 15000,
    products: [], BT_procedures: [], doctor_procedures: [] },
  promotion_ID: null,
  total_price: 13500,             // ราคาหลังโปร
  purchased_at: "",
  expires_at: "",                 // purchased_at + validity_days (null = ไม่หมดอายุ)
  uses_total: 5,
  uses_remaining: 5,              // ลดลงตอน "ปิดเคส" เท่านั้น
  status: "active" | "completed" | "expired" | "cancelled",
  // การเงิน — รองรับผ่อนชำระ
  paid_amount: 5000,
  balance_due: 8500,              // = total_price - paid_amount
  payment_status: "unpaid" | "partial" | "paid",
  // คอมมิชชั่น
  sale_ID: "US-004",
  commission_rate: 5,             // snapshot % ณ วันขาย
  commission_amount: 675,
}
```

## reserve (การจอง — 1 doc = 1 คิวบนปฏิทิน)

```js
{
  reserve_ID: "RS-0001",
  branch_ID: "BR-001",
  // ตัวตนลูกค้า — อย่างน้อยต้องมี contact, HN ผูกทีหลังได้
  HN_number: null,
  contact: { nick_name: "", phone: "", email: "" },
  customer_course_ID: "CC-0001",  // จองใช้สิทธิ์ course ไหน (null = walk-in ยังไม่เลือก)
  date: "2026-07-20",
  time_start: "13:00",
  time_end: "14:00",
  unix_start: 0, unix_end: 0,     // ไว้ query ช่วงเวลา + กันจองซ้อน
  room_ID: "RM-001",
  doctor_ID: "US-005",            // null ได้ถ้า course ไม่มีขั้นหมอ
  BT_ID: null,                    // acception กำหนดตอน OPD ได้
  status: "booked" | "arrived" | "ready" | "in_progress" | "done"
        | "cancelled" | "no_show",
  is_walk_in: false,
  reschedule_history: [           // เลื่อนนัด — เก็บของเดิมไว้
    { from_date: "", from_time_start: "", from_time_end: "",
      from_room_ID: "", moved_at: "", moved_by: "" },
  ],
  status_history: [               // audit ทุกการเปลี่ยนสถานะ
    { status: "", at: "", by: "" },
  ],
  opd_ID: null,                   // ผูกตอนเข้า OPD
  created_by: "US-004",
  note: "",
}
// กติกาจองซ้อน (บังคับที่ API ก่อน insert/update ทุกครั้ง):
// 1) ห้องเดียวกัน + วันเดียวกัน + ช่วงเวลา overlap → reject
// 2) หมอคนเดียวกัน + วันเดียวกัน + ช่วงเวลา overlap (คนละห้องก็ตาม) → reject
// (นับเฉพาะ status ที่ยังมีผล: booked/arrived/ready/in_progress)
```

## opd (1 doc = การมา 1 ครั้ง / 1 session) — โครงใหม่ แก้ปัญหา array ขนาน

```js
{
  opd_ID: "OPD-0001",
  branch_ID: "BR-001",
  reserve_ID: "RS-0001",
  HN_number: "HN-2569-0001",      // บังคับ ณ จุดนี้ (ลูกค้าใหม่สร้าง HN ที่นี่)
  customer_course_ID: "CC-0001",
  session_no: 1,                  // ครั้งที่เท่าไรของ customer_course
  date: "2026-07-20",
  room_ID: "RM-001",
  time_start: "", time_end: "",
  // วัดตัว — บังคับกรอกก่อนไปขั้นถัดไป
  opd_data: {
    blood_pressure: "120/80",
    heart_rate: 0,
    weight_kg: 0,
    height_cm: 0,
    fat_mass: 0,
    muscle_mass: 0,
    other: "",
    measured_by: "US-003",
    measured_at: "",
  },
  BT_ID: null,                    // ใครทำ pre-procedure (null = ข้ามขั้น BT)
  doctor_ID: null,                // ใครทำหัตถการ (null = ข้ามขั้นหมอ)
  procedures_done: [              // สิ่งที่ทำจริงครั้งนี้ (จาก course_snapshot)
    { medical_procedure_ID: "", name: "", type: "BT" | "doctor",
      performed_by: "", cost: 500 },
  ],
  // การตัด stock จริง — เขียนตอนปิดเคส
  stock_used: [
    { item_ID: "IV-000001", lot_ID: "LOT-0001", product_ID: "PD-001",
      cc_used: 2, cost_of_goods: 700 },   // ทุนจริงตามสัดส่วน lot นั้น
  ],
  // add_on — ทำเพิ่มหน้างาน เก็บเงินทันที แยกบิล
  add_ons: [
    { product_ID: "PD-009", name: "", qty: 1, cc_used: 0,
      price: 1500, payment_ID: "PAY-0002" },
  ],
  status: "open" | "measuring" | "bt_stage" | "doctor_stage" | "closed",
  closed_by: "US-002",            // admin/acception เท่านั้น
  closed_at: "",
}
// "ปิดเคส" (status → closed) เป็น atomic operation เดียว ทำ 5 อย่าง:
// 1. ตัด inventory_item ตาม FIFO (in_use ก่อน unused) ตาม course_snapshot.products
// 2. อัปเดต uses_remaining / cc_remaining / state ของขวด + เขียน usage_log
// 3. customer_course.uses_remaining-- (ครบแล้ว status → completed)
// 4. สร้าง staff_earning ค่ามือหมอ/BT ตาม procedures_done
// 5. reserve.status → done
```

## payment (ทุกการรับเงิน — 1 doc = 1 การจ่าย)

```js
{
  payment_ID: "PAY-0001",
  branch_ID: "BR-001",
  HN_number: "",
  type: "course_purchase" | "installment" | "add_on",
  ref: {                          // จ่ายให้อะไร
    customer_course_ID: "CC-0001",  // เมื่อ type = course_purchase | installment
    opd_ID: null },                  // เมื่อ type = add_on
  amount: 5000,
  method: "cash" | "transfer" | "card",
  paid_at: "",
  received_by: "US-002",
  note: "",
}
// จ่าย installment → อัปเดต customer_course.paid_amount / balance_due / payment_status
```

## staff_earning (ค่ามือ/คอมมิชชั่น — สร้างอัตโนมัติ)

```js
{
  earning_ID: "EN-0001",
  branch_ID: "BR-001",
  user_ID: "US-005",
  role: "doctor" | "BT" | "sale",
  type: "procedure_fee" | "commission",
  ref: { opd_ID: "OPD-0001",      // procedure_fee
         customer_course_ID: null }, // commission
  medical_procedure_ID: "MP-001",
  amount: 500,
  date: "2026-07-20",
}
// หมอ/BT query ได้เฉพาะ user_ID ตัวเอง — admin/super_admin เห็นทั้งหมด
```

## expense (รายจ่ายอื่นๆ นอกจากทุนสินค้า)

```js
{
  expense_ID: "EX-0001",
  branch_ID: "BR-001",
  category: "rent" | "salary" | "utility" | "other",
  description: "",
  amount: 0,
  date: "",
  recorded_by: "",
}
```

## counter (เลขรันทุกชนิด)

```js
{
  key: "HN:BR-001:2569",          // ชนิด:สาขา:ปี (HN reset ตาม config)
  seq: 42,
}
```

## system_config

```js
{
  branch_ID: null,                // null = global
  hn_format: {                    // format HN config ได้
    prefix: "HN",
    include_year: true,           // พ.ศ.
    digits: 4,                    // เลขรัน 4 หลัก
    reset_yearly: true,
  },
  default_language: "th",         // i18n: th | en
  currency: "THB",
}
```

---

# สูตรการเงิน (finance module)

- **รายรับ** = Σ payment.amount (แยกดูตาม type/method/สาขา/ช่วงเวลาได้)
- **ต้นทุนขาย (COGS)** = Σ opd.stock_used[].cost_of_goods — ทุนจริงตาม lot:
  `cost_of_goods = (cc_used / sub_unit_size) × stock_lot.cost_price_per_unit`
- **ค่าแรงผันแปร** = Σ staff_earning.amount (ค่ามือ + คอม)
- **รายจ่ายอื่น** = Σ expense.amount
- **กำไรคงเหลือ** = รายรับ − COGS − ค่าแรงผันแปร − รายจ่ายอื่น
- **รายคน**: group staff_earning ตาม user_ID → ทำกี่เคส ทำอะไรบ้าง ได้เงินเท่าไร
- **ลูกหนี้ค้างผ่อน**: Σ customer_course.balance_due (payment_status ≠ paid)

# State Machines

```
inventory_item : unused → in_use → empty        (+ discarded ได้จากทุก state)
reserve        : booked → arrived → ready → in_progress → done
                 booked → cancelled | no_show
                 (เลื่อนนัด = แก้ วัน/เวลา/ห้อง + push reschedule_history, status คงเดิม)
opd            : open → measuring → bt_stage → doctor_stage → closed
                 (ข้าม bt_stage/doctor_stage ได้ตาม course; ถอยหลังไม่ได้หลัง closed)
customer_course: active → completed (ใช้ครบ) | expired (เลยกำหนด) | cancelled
```

# UI and Flow

- Layout: sidebar ซ้ายรวมทุก module, สลับสาขาได้ (ตาม role), สลับภาษา th/en
- **หน้าปฏิทิน (ลูกค้า/จอแสดง)** — panel ซ้าย: คิววันนั้น / panel ขวา: promotion banner
  แกน y = เวลา, แกน x = ห้อง (เฉพาะ active), สีตามหมอที่ HR ตั้ง
- **หน้าปฏิทิน (sale)** — panel ขวา: จอง course + filter หา HN → เห็น course ค้าง เหลือกี่ครั้ง
  กดจอง → เช็คซ้อน (ห้อง+หมอ) → สร้าง reserve → ปฏิทิน update สถานะ
- **หน้า OPD (acception)** — คิวที่ arrived, ลูกค้าใหม่สร้าง HN / ลูกค้าเก่าค้น HN ผูก,
  กรอก opd_data (บังคับ), เลือก BT, ส่งเข้าห้อง
- **หน้าห้อง/ปิดเคส (admin)** — เห็นสถานะทุกห้อง, กดปิดเคส → ระบบทำ 5 ขั้น atomic
- **จัดการ stock** — รับของเข้า (สร้าง lot → gen items), ดูขวดรายชิ้น, เตือน: ใกล้หมดอายุ lot,
  เกินกำหนดหลังเปิดขวด, ต่ำกว่า reorder_point
- **จัดการ course/promotion/medical_procedure/HR/ห้อง/สาขา** — CRUD ตามสิทธิ์
- **การเงิน** — dashboard รายวัน/เดือน, รายคน, ลูกหนี้ค้างผ่อน / หมอ+BT เห็นหน้า "รายได้ของฉัน"

# Tech Stack

- Next.js (App Router) — fullstack frontend + backend (API routes)
- MongoDB + Mongoose
- Redux Toolkit (client state) 
- MVC: models (mongoose) / services (business logic เช่น closeCase, FIFO) / API routes (controller) / views (pages)
- i18n: next-intl (th/en)
- Deploy: Docker (app + mongo ผ่าน docker-compose)
- Auth: mock (เลือก user) — โครงสร้างเผื่อ NextAuth ภายหลัง

# UI ตรีม "โอสถ"

- แนวจีนสมัยใหม่ **แบบเบา เน้นใช้งาน**: พื้นขาว/ดำสะอาด, แดง (#B3282D โทนชาด) เป็น accent,
  ขอบ/เส้นทองบางๆ เฉพาะ header + จุดสำคัญ, ลายมังกร/หยินหยาง subtle (watermark/ไอคอน)
- ฟอนต์ไทยอ่านง่าย (เช่น Noto Sans Thai) หัวข้อใหญ่ใช้น้ำหนักหนา
- ดูเป็นเครื่องมือทำงานทั้งวันได้ไม่ล้าตา ไม่ประดับจนรก
