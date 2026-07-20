[← กลับสารบัญ](../README.md)

---

# 🗃️ Collections (MongoDB)

> convention: ทุก collection มี `_id` (ObjectId), `created_at`, `updated_at` อัตโนมัติ
> field ที่เป็น "รหัสอ่านง่าย" (HN, RS-xxxx ฯลฯ) รันจาก `counter` collection แยกตามสาขา/ปี


## รายการ collection ทั้งหมด

| # | Collection | ไฟล์ |
|---|---|---|
| 1 | **branch**  | [01-branch.md](01-branch.md) |
| 2 | **room**  | [02-room.md](02-room.md) |
| 3 | **user** (พนักงานทุก role) | [03-user.md](03-user.md) |
| 4 | **doctor_schedule** (ตารางหมอประจำห้อง) | [04-doctor-schedule.md](04-doctor-schedule.md) |
| 5 | **customer** (เดิมชื่อ HN_customer) | [05-customer.md](05-customer.md) |
| 6 | **product** (catalog สินค้า — ไม่ใช่ stock จริง) | [06-product.md](06-product.md) |
| 7 | **stock_lot** (การรับของเข้าแต่ละครั้ง) | [07-stock-lot.md](07-stock-lot.md) |
| 8 | **inventory_item** (ขวดจริงรายชิ้น — 1 doc = 1 unit) | [08-inventory-item.md](08-inventory-item.md) |
| 9 | **medical_procedure**  | [09-medical-procedure.md](09-medical-procedure.md) |
| 10 | **course** (catalog — สิ่งที่ขาย) | [10-course.md](10-course.md) |
| 11 | **promotion**  | [11-promotion.md](11-promotion.md) |
| 12 | **customer_course** (course ที่ลูกค้าซื้อแล้ว — 1 doc = 1 การซื้อ) | [12-customer-course.md](12-customer-course.md) |
| 13 | **reserve** (การจอง — 1 doc = 1 คิวบนปฏิทิน) | [13-reserve.md](13-reserve.md) |
| 14 | **opd** (1 doc = การมา 1 ครั้ง / 1 session) — โครงใหม่ แก้ปัญหา array ขนาน | [14-opd.md](14-opd.md) |
| 15 | **payment** (ทุกการรับเงิน — 1 doc = 1 การจ่าย) | [15-payment.md](15-payment.md) |
| 16 | **staff_earning** (ค่ามือ/คอมมิชชั่น — สร้างอัตโนมัติ) | [16-staff-earning.md](16-staff-earning.md) |
| 17 | **expense** (รายจ่ายอื่นๆ นอกจากทุนสินค้า) | [17-expense.md](17-expense.md) |
| 18 | **counter** (เลขรันทุกชนิด) | [18-counter.md](18-counter.md) |
| 19 | **system_config**  | [19-system-config.md](19-system-config.md) |
| 20 | **purchase_order** *(เพิ่ม 2026-07-18 — GAP-05 stock reorder → PO)* | [20-purchase-order.md](20-purchase-order.md) |
| 21 | **attendance** *(เพิ่ม 2026-07-18 — As-Is Session 2: ลงเวลาเข้า/ออกงาน)* | [21-attendance.md](21-attendance.md) |
