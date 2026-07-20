[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
