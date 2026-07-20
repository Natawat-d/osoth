[← กลับสารบัญ](README.md)

---

# สูตรการเงิน (finance module)

- **รายรับ** = Σ payment.amount (แยกดูตาม type/method/สาขา/ช่วงเวลาได้)
- **ต้นทุนขาย (COGS)** = Σ opd.stock_used[].cost_of_goods — ทุนจริงตาม lot:
  `cost_of_goods = (cc_used / sub_unit_size) × stock_lot.cost_price_per_unit`
- **ค่าแรงผันแปร** = Σ staff_earning.amount (ค่ามือ + คอม)
- **รายจ่ายอื่น** = Σ expense.amount
- **กำไรคงเหลือ** = รายรับ − COGS − ค่าแรงผันแปร − รายจ่ายอื่น
- **รายคน**: group staff_earning ตาม user_ID → ทำกี่เคส ทำอะไรบ้าง ได้เงินเท่าไร
- **ลูกหนี้ค้างผ่อน**: Σ customer_course.balance_due (payment_status ≠ paid)
