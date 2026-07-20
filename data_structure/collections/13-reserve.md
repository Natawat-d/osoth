[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

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
