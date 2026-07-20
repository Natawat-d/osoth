[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
