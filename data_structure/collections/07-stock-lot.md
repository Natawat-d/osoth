[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

## stock_lot (การรับของเข้าแต่ละครั้ง)

```js
{
  lot_ID: "LOT-0001",
  branch_ID: "BR-001",            // stock แยกสาขา
  product_ID: "PD-001",
  lot_number: "",                 // เลข lot จากผู้ผลิต
  supplier: "",
  cost_price_per_unit: 3500,      // ทุนจริงต่อ 1 unit ของ lot นี้ ← ใช้คิดต้นทุนในบัญชี
  quantity_received: 10,          // รับเข้ากี่ unit → สร้าง inventory_item เท่านั้นชิ้น
  expiry_date: "2027-01-01",      // หมดอายุบนฉลาก
  received_at: "2026-07-18",
  received_by: "US-002",
}
```
