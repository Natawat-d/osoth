[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
