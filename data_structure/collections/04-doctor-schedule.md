[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
