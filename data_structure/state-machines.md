[← กลับสารบัญ](README.md)

---

# State Machines

```
inventory_item : unused → in_use → empty        (+ discarded ได้จากทุก state)
reserve        : booked → arrived → ready → in_progress → done
                 booked → cancelled | no_show
                 (เลื่อนนัด = แก้ วัน/เวลา/ห้อง + push reschedule_history, status คงเดิม)
opd            : open → measuring → bt_stage → doctor_stage → closed
                 (ข้าม bt_stage/doctor_stage ได้ตาม course; ถอยหลังไม่ได้หลัง closed)
customer_course: active → completed (ใช้ครบ) | expired (เลยกำหนด) | cancelled
```
