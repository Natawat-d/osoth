[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

## attendance  *(เพิ่ม 2026-07-18 — As-Is Session 2: ลงเวลาเข้า/ออกงาน)*

```js
{
  att_ID: "AT-000001",
  branch_ID: "BR-001",
  user_ID: "US-005",
  date: "2026-07-18",            // local date (unique ต่อ user/วัน)
  check_in: Date,
  check_out: Date,
}
```

> **reserve.deposit** *(เพิ่ม)* — มัดจำตอนจอง (As-Is: 199฿) → สร้าง `payment` type `deposit` แยก
> **payment.type** เพิ่มค่า `deposit`; **payment.ref** เพิ่ม `reserve_ID`
