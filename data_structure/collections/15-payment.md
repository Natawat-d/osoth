[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
