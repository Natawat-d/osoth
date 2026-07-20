[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
