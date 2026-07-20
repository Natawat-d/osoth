[← กลับสารบัญ](../README.md) · [🗃️ ดัชนี collections](README.md)

---

## user (พนักงานทุก role)

```js
{
  user_ID: "US-001",
  branch_ID: "BR-001",            // สาขาหลัก
  role: "super_admin" | "admin" | "acception" | "sale" | "BT" | "doctor",
  full_name: "",
  nick_name: "",
  email: "",                      // mock login: เลือกจากรายชื่อ ยังไม่ใช้ password
  phone: "",
  commission_rate: 0,             // % คอม (ใช้กับ role sale เท่านั้น)
  color: "#c0392b",               // สีแสดงบนปฏิทิน (หมอ)
  active: true,
}
```
