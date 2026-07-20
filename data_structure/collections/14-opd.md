[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
