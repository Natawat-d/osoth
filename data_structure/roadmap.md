[← กลับสารบัญ](README.md)

---

# As-Is Workflow (จากสัมภาษณ์พนักงาน — Workflow_Diagrams.pdf, 2026-07-18)

กระบวนการจริงของคลินิก "Beyond Clinic" 10 sessions — ใช้เทียบว่าระบบครอบคลุมพอไหม:

| # | Session | สาระ / จุดที่ระบบต้องรองรับ |
|---|---|---|
| 1 | จอง (Booking) | walk-in / จองล่วงหน้า · **มัดจำ 199฿** · ช่องทาง LINE/QR/beyond clinic |
| 2 | เปิดร้าน/เข้างาน (Opening & Attendance) | พนักงานเข้า ~10:30 · เปิด 11:00–19:00 · **check-in/out** · OT |
| 3 | ลงทะเบียน (Check-in & Registration) | HN · ฟอร์ม OPD · เดิมใช้ Excel |
| 4 | ปรึกษา/ขาย (Consultation & Sales) | ~90% ปิดการขายที่ขั้นนี้ |
| 5 | ชำระเงิน/บันทึก (Payment & Recording) | หลายช่องทาง · ผ่อน |
| 6 | หัตถการ (Treatment) | BT + แพทย์ |
| 7 | เช็คเอาต์ (Checkout) | |
| 8 | ปิดยอดสิ้นวัน (End-of-day Reconciliation) | รวมยอด · เงินสดในลิ้นชัก · exception |
| 9 | สต๊อก/จัดซื้อ (Inventory & Purchasing) | นับ · **PO** · lot/supplier |
| 10 | โปรโมชั่น/จัดการ (Promotion & Management) | |

# GAP Roadmap (จากผลประเมิน HCI — OSOTH_HCI_Evaluation_TH.pdf, คะแนน 58/100)

| สถานะ | รายการ |
|---|---|
| ✅ done (รอบนี้) | Quick Wins 8 ข้อ (loading/toast, auto เวลาจบ, error toast, status legend, scroll-to-card, route guard, ไทย 24ชม./DD-MM, Enter ค้นหา) · แก้/เพิ่มลูกค้า+แพ้ยา (F-16) · เลื่อนนัด UI (F-14) · confirm add-on/รับของ (F-17) · label/ชื่อแทนรหัส (F-08) · global search · **Excel/CSV export** · **ปิดยอดสิ้นวัน** (GAP-04) · **PO reorder** (GAP-05) · **check-in/out** (Session 2) · **มัดจำ** · responsive พื้นฐาน |
| 🚧 started (stub) | LINE แจ้งเตือนจอง (GAP-02) — `services/notify.js` adapter พร้อมต่อเมื่อมี LINE credentials |
| 📋 planned | geofence check-in · approval center รวมศูนย์ · commission tiers AM/BD (GAP-03) · mobile-first เต็มรูปแบบ · global search แบบครอบคลุม reserve/HN |
