[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

## inventory_item (ขวดจริงรายชิ้น — 1 doc = 1 unit)

```js
{
  item_ID: "IV-000001",
  branch_ID: "BR-001",
  product_ID: "PD-001",
  lot_ID: "LOT-0001",
  state: "unused" | "in_use" | "empty" | "discarded",
  opened_at: null,                // timestamp ตอน state เปลี่ยนเป็น in_use ครั้งแรก
  open_expiry_at: null,           // = opened_at + shelf_life_after_open_days (ไว้เตือน ไม่บังคับ)
  uses_remaining: 5,              // ครั้งที่เหลือ (เริ่ม = default_uses_per_unit)
  cc_remaining: 10,               // ปริมาณที่เหลือ (เริ่ม = sub_unit_size)
  usage_log: [                    // ประวัติการตัดทุกครั้ง — audit trail
    { opd_ID: "OPD-0001",
      session_no: 1,
      cc_used: 2,
      used_at: "",
      closed_by: "US-002" },
  ],
}
// FIFO: เวลาตัด เลือก item จาก lot ที่ expiry_date เก่าสุด → received_at เก่าสุด
// โดยให้ state=in_use มาก่อน unused (ใช้ขวดที่เปิดแล้วให้หมดก่อนเปิดขวดใหม่)
```
