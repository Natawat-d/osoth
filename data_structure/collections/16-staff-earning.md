[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
