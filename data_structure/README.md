# โอสถ (OSOTH) — Data Structure & Business Rules

> เอกสารนี้ถูกแยกจากไฟล์เดียวเป็นโฟลเดอร์ เพื่อให้อ่าน/ใช้งานง่ายขึ้น — เนื้อหาเหมือนเดิมทุกประการ

> ฉบับปรับปรุงตามการตัดสินใจ requirement 30+ ข้อ (2026-07-18)
> เอกสารนี้คือ single source of truth ของ data structure และ business rules ทั้งหมด

## 📚 สารบัญ

### ภาพรวม & กติกา
- [ภาพรวมระบบ + Module](01-overview.md)
- [กติกาธุรกิจ (Business Rules)](02-business-rules.md)

### 🗃️ Collections (MongoDB)  ·  [ดัชนีทั้งหมด →](collections/README.md)
- [`branch`](collections/01-branch.md)
- [`room`](collections/02-room.md)
- [`user`](collections/03-user.md)  — พนักงานทุก role
- [`doctor_schedule`](collections/04-doctor-schedule.md)  — ตารางหมอประจำห้อง
- [`customer`](collections/05-customer.md)  — เดิมชื่อ HN_customer
- [`product`](collections/06-product.md)  — catalog สินค้า — ไม่ใช่ stock จริง
- [`stock_lot`](collections/07-stock-lot.md)  — การรับของเข้าแต่ละครั้ง
- [`inventory_item`](collections/08-inventory-item.md)  — ขวดจริงรายชิ้น — 1 doc = 1 unit
- [`medical_procedure`](collections/09-medical-procedure.md)
- [`course`](collections/10-course.md)  — catalog — สิ่งที่ขาย
- [`promotion`](collections/11-promotion.md)
- [`customer_course`](collections/12-customer-course.md)  — course ที่ลูกค้าซื้อแล้ว — 1 doc = 1 การซื้อ
- [`reserve`](collections/13-reserve.md)  — การจอง — 1 doc = 1 คิวบนปฏิทิน
- [`opd`](collections/14-opd.md)  — 1 doc = การมา 1 ครั้ง / 1 session) — โครงใหม่ แก้ปัญหา array ขนาน
- [`payment`](collections/15-payment.md)  — ทุกการรับเงิน — 1 doc = 1 การจ่าย
- [`staff_earning`](collections/16-staff-earning.md)  — ค่ามือ/คอมมิชชั่น — สร้างอัตโนมัติ
- [`expense`](collections/17-expense.md)  — รายจ่ายอื่นๆ นอกจากทุนสินค้า
- [`counter`](collections/18-counter.md)  — เลขรันทุกชนิด
- [`system_config`](collections/19-system-config.md)
- [`purchase_order`](collections/20-purchase-order.md)
- [`attendance`](collections/21-attendance.md)

### 📖 อ้างอิง & แผน
- [สูตรการเงิน](finance-formulas.md)
- [State Machines](state-machines.md)
- [UI & Flow + ธีม](ui-and-flow.md)
- [Tech Stack](tech-stack.md)
- [As-Is Workflow + GAP Roadmap](roadmap.md)
