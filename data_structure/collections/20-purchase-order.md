[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

## purchase_order  *(เพิ่ม 2026-07-18 — GAP-05 stock reorder → PO)*

```js
{
  po_ID: "PO-00001",
  branch_ID: "BR-001",
  supplier: "",
  items: [{ product_ID, name, qty, cost_price_per_unit }],
  status: "draft" | "ordered" | "received" | "cancelled",
  note: "",
  created_by: "US-002",
  received_at: null,              // กด "รับของเข้า" → เรียก receiveStock ทุก item → set received
}
```
