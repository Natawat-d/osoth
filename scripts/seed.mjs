// Seed ข้อมูลตัวอย่าง — standalone (node scripts/seed.mjs)
// ล้างและใส่ข้อมูลฐาน (สาขา/staff/catalog/stock) — ใช้เป็น baseline ของเทสต์
// ข้อมูล demo เยอะๆ (เคสหลายสถานะ) อยู่ที่ scripts/seed-demo.mjs
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/osoth";

// รหัสผ่านเริ่มต้นของทุกบัญชี seed = "1234" (must_change_password=false → login ได้ทันที)
const DEFAULT_PW_HASH = bcrypt.hashSync("1234", 10);
// map user_ID → username สำหรับ login
const SEED_USERNAMES = {
  "US-001": "owner", "US-002": "admin", "US-003": "reception", "US-004": "sale",
  "US-005": "dr.mangkorn", "US-006": "dr.hong", "US-007": "bt1", "US-008": "bt2",
  "US-009": "admin2", "US-010": "sale2", "US-011": "dr.suea", "US-012": "bt3",
};

// ใส่ข้อมูลฐานทั้งหมด (export ให้ seed-demo เรียกต่อได้)
export async function seedBase(db) {
  const collections = [
    "branches", "rooms", "users", "doctorschedules", "customers", "products",
    "stocklots", "inventoryitems", "medicalprocedures", "courses", "promotions",
    "customercourses", "reserves", "opds", "payments", "staffearnings",
    "expenses", "counters", "systemconfigs", "leaverequests",
    "purchaseorders", "attendances", "commissionsettings",
  ];
  for (const c of collections) await db.collection(c).deleteMany({});

  const now = new Date();
  const ts = { created_at: now, updated_at: now };

  await db.collection("branches").insertMany([
    { branch_ID: "BR-001", name: "โอสถ สาขาสยาม", address: "อาคารสยามพารากอน ชั้น 4 กรุงเทพฯ", phone: "02-000-0001", line_id: "@osoth-siam", storefront_enabled: true, active: true, ...ts },
    { branch_ID: "BR-002", name: "โอสถ สาขาทองหล่อ", address: "ซอยทองหล่อ 10 กรุงเทพฯ", phone: "02-000-0002", line_id: "@osoth-thonglor", storefront_enabled: true, active: true, ...ts },
  ]);

  await db.collection("rooms").insertMany([
    { room_ID: "RM-001", branch_ID: "BR-001", name: "ห้อง 1", order: 1, active: true, ...ts },
    { room_ID: "RM-002", branch_ID: "BR-001", name: "ห้อง 2", order: 2, active: true, ...ts },
    { room_ID: "RM-003", branch_ID: "BR-001", name: "ห้อง VIP", order: 3, active: true, ...ts },
    { room_ID: "RM-004", branch_ID: "BR-002", name: "ห้อง 1", order: 1, active: true, ...ts },
    { room_ID: "RM-005", branch_ID: "BR-002", name: "ห้อง 2", order: 2, active: true, ...ts },
  ]);

  await db.collection("users").insertMany([
    { user_ID: "US-001", branch_ID: "BR-001", role: "super_admin", full_name: "เจ้าของร้าน", nick_name: "บอส", email: "boss@osoth.local", phone: "", commission_rate: 0, color: "#8f1f23", active: true, ...ts },
    { user_ID: "US-002", branch_ID: "BR-001", role: "admin", full_name: "แอดมิน หน้าร้าน", nick_name: "มิน", email: "admin@osoth.local", phone: "", commission_rate: 0, color: "#b3282d", active: true, ...ts },
    { user_ID: "US-003", branch_ID: "BR-001", role: "acception", full_name: "ฝ่ายต้อนรับ", nick_name: "ฟ้า", email: "recept@osoth.local", phone: "", commission_rate: 0, color: "#a8871f", active: true, ...ts },
    { user_ID: "US-004", branch_ID: "BR-001", role: "sale", full_name: "เซลล์ คนเก่ง", nick_name: "เซล", email: "sale@osoth.local", phone: "", commission_rate: 5, color: "#1a4e8a", active: true, ...ts },
    { user_ID: "US-005", branch_ID: "BR-001", role: "doctor", full_name: "นพ. มังกร ทองแดง", nick_name: "หมอมังกร", email: "dr.m@osoth.local", phone: "", commission_rate: 0, color: "#2e5d32", active: true, ...ts },
    { user_ID: "US-006", branch_ID: "BR-001", role: "doctor", full_name: "พญ. หงส์ ทองคำ", nick_name: "หมอหงส์", email: "dr.h@osoth.local", phone: "", commission_rate: 0, color: "#6a3a8a", active: true, ...ts },
    { user_ID: "US-007", branch_ID: "BR-001", role: "BT", full_name: "บิวตี้ เทอราปิสต์ หนึ่ง", nick_name: "บีที1", email: "bt1@osoth.local", phone: "", commission_rate: 0, color: "#555", active: true, ...ts },
    { user_ID: "US-008", branch_ID: "BR-001", role: "BT", full_name: "บิวตี้ เทอราปิสต์ สอง", nick_name: "บีที2", email: "bt2@osoth.local", phone: "", commission_rate: 0, color: "#777", active: true, ...ts },
    // สาขาทองหล่อ (BR-002)
    { user_ID: "US-009", branch_ID: "BR-002", role: "admin", full_name: "แอดมิน ทองหล่อ", nick_name: "หลอ", email: "admin2@osoth.local", phone: "", commission_rate: 0, color: "#b3282d", active: true, ...ts },
    { user_ID: "US-010", branch_ID: "BR-002", role: "sale", full_name: "เซลล์ ทองหล่อ", nick_name: "ขายดี", email: "sale2@osoth.local", phone: "", commission_rate: 5, color: "#1a4e8a", active: true, ...ts },
    { user_ID: "US-011", branch_ID: "BR-002", role: "doctor", full_name: "นพ. เสือ ทองแท้", nick_name: "หมอเสือ", email: "dr.t@osoth.local", phone: "", commission_rate: 0, color: "#2e5d32", active: true, ...ts },
    { user_ID: "US-012", branch_ID: "BR-002", role: "BT", full_name: "บิวตี้ ทองหล่อ", nick_name: "บีทีล", email: "bt3@osoth.local", phone: "", commission_rate: 0, color: "#555", active: true, ...ts },
  ]);

  // ให้ทุกบัญชี seed มี login (username + รหัส "1234", ใช้ได้ทันที)
  for (const [uid, uname] of Object.entries(SEED_USERNAMES)) {
    await db.collection("users").updateOne(
      { user_ID: uid },
      { $set: { username: uname, password_hash: DEFAULT_PW_HASH, must_change_password: false, login_active: true, failed_attempts: 0, locked_until: null } }
    );
  }

  await db.collection("doctorschedules").insertMany([
    {
      branch_ID: "BR-001", doctor_ID: "US-005",
      weekly: [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, room_ID: "RM-001", time_start: "10:00", time_end: "18:00" })),
      overrides: [], ...ts,
    },
    {
      branch_ID: "BR-001", doctor_ID: "US-006",
      weekly: [3, 4, 5, 6].map((d) => ({ day_of_week: d, room_ID: "RM-002", time_start: "12:00", time_end: "20:00" })),
      overrides: [], ...ts,
    },
  ]);

  await db.collection("medicalprocedures").insertMany([
    // สาขาสยาม (BR-001)
    { medical_procedure_ID: "MP-001", branch_ID: "BR-001", name: "ฉีด Botox", type: "doctor", cost: 500, active: true, ...ts },
    { medical_procedure_ID: "MP-002", branch_ID: "BR-001", name: "เตรียมผิว/แปะยาชา", type: "BT", cost: 150, active: true, ...ts },
    { medical_procedure_ID: "MP-003", branch_ID: "BR-001", name: "ร้อยไหม", type: "doctor", cost: 800, active: true, ...ts },
    { medical_procedure_ID: "MP-004", branch_ID: "BR-001", name: "ทรีตเมนต์ผิว", type: "BT", cost: 200, active: true, ...ts },
    // สาขาทองหล่อ (BR-002)
    { medical_procedure_ID: "MP-101", branch_ID: "BR-002", name: "ฉีด Botox (ทองหล่อ)", type: "doctor", cost: 600, active: true, ...ts },
    { medical_procedure_ID: "MP-102", branch_ID: "BR-002", name: "เตรียมผิว/แปะยาชา", type: "BT", cost: 180, active: true, ...ts },
  ]);

  await db.collection("products").insertMany([
    // สาขาสยาม (BR-001) — addon_sub_unit_per_use: add-on ตัด stock กี่ sub_unit ต่อ qty
    { product_ID: "PD-001", branch_ID: "BR-001", name: "Botox 100u (10cc)", type: "injection", unit: "ขวด", sub_unit: "cc", sub_unit_size: 10, default_uses_per_unit: 5, selling_price: 2500, addon_sub_unit_per_use: 1, reorder_point: 3, shelf_life_after_open_days: 30, active: true, ...ts },
    { product_ID: "PD-002", branch_ID: "BR-001", name: "Filler 1cc", type: "injection", unit: "กล่อง", sub_unit: "cc", sub_unit_size: 1, default_uses_per_unit: 1, selling_price: 8000, addon_sub_unit_per_use: 1, reorder_point: 2, shelf_life_after_open_days: 0, active: true, ...ts },
    { product_ID: "PD-003", branch_ID: "BR-001", name: "มาส์กหน้าทองคำ", type: "consumable", unit: "ชิ้น", sub_unit: "", sub_unit_size: 1, default_uses_per_unit: 1, selling_price: 900, addon_sub_unit_per_use: 1, reorder_point: 5, shelf_life_after_open_days: 0, active: true, ...ts },
    // สาขาทองหล่อ (BR-002)
    { product_ID: "PD-101", branch_ID: "BR-002", name: "Botox 100u (10cc)", type: "injection", unit: "ขวด", sub_unit: "cc", sub_unit_size: 10, default_uses_per_unit: 5, selling_price: 2800, addon_sub_unit_per_use: 1, reorder_point: 3, shelf_life_after_open_days: 30, active: true, ...ts },
    { product_ID: "PD-102", branch_ID: "BR-002", name: "เซรั่มพรีเมียม", type: "consumable", unit: "ขวด", sub_unit: "", sub_unit_size: 1, default_uses_per_unit: 1, selling_price: 1500, addon_sub_unit_per_use: 1, reorder_point: 4, shelf_life_after_open_days: 0, active: true, ...ts },
  ]);

  await db.collection("courses").insertMany([
    {
      course_ID: "CS-001", branch_ID: "BR-001", name: "Botox หน้าเรียว 5 ครั้ง", quantity_used: 5, validity_days: 365, price: 15000,
      products: [{ product_ID: "PD-001", sub_unit_per_use: 2 }],
      BT_procedures: [{ medical_procedure_ID: "MP-002" }],
      doctor_procedures: [{ medical_procedure_ID: "MP-001" }],
      duration_minutes: 60, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-002", branch_ID: "BR-001", name: "ทรีตเมนต์ผิวใส 10 ครั้ง", quantity_used: 10, validity_days: 365, price: 8000,
      products: [{ product_ID: "PD-003", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-004" }],
      doctor_procedures: [],
      duration_minutes: 45, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-003", branch_ID: "BR-001", name: "[โปร] Botox 5+1 ครั้ง", quantity_used: 6, validity_days: 365, price: 15000,
      products: [{ product_ID: "PD-001", sub_unit_per_use: 2 }],
      BT_procedures: [{ medical_procedure_ID: "MP-002" }],
      doctor_procedures: [{ medical_procedure_ID: "MP-001" }],
      duration_minutes: 60, is_promotion_course: true, origin_course_ID: "CS-001", active: true, ...ts,
    },
    // คอร์สเพิ่ม BR-001 (หลากหลายชนิด)
    {
      course_ID: "CS-004", branch_ID: "BR-001", name: "Filler ปาก 1 ครั้ง", quantity_used: 1, validity_days: 180, price: 8000,
      products: [{ product_ID: "PD-002", sub_unit_per_use: 1 }],
      BT_procedures: [], doctor_procedures: [{ medical_procedure_ID: "MP-001" }],
      duration_minutes: 30, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-005", branch_ID: "BR-001", name: "ร้อยไหมยกกระชับ 3 ครั้ง", quantity_used: 3, validity_days: 365, price: 25000,
      products: [{ product_ID: "PD-002", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-002" }], doctor_procedures: [{ medical_procedure_ID: "MP-003" }],
      duration_minutes: 90, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-006", branch_ID: "BR-001", name: "ดูแลผิว BT 5 ครั้ง", quantity_used: 5, validity_days: 365, price: 5000,
      products: [{ product_ID: "PD-003", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-004" }], doctor_procedures: [],
      duration_minutes: 40, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-007", branch_ID: "BR-001", name: "คอมโบ Botox+Filler 3 ครั้ง", quantity_used: 3, validity_days: 365, price: 30000,
      products: [{ product_ID: "PD-001", sub_unit_per_use: 2 }, { product_ID: "PD-002", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-002" }], doctor_procedures: [{ medical_procedure_ID: "MP-001" }, { medical_procedure_ID: "MP-003" }],
      duration_minutes: 90, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-008", branch_ID: "BR-001", name: "ทรีตเมนต์ทองพรีเมียม 20 ครั้ง", quantity_used: 20, validity_days: 365, price: 12000,
      products: [{ product_ID: "PD-003", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-004" }], doctor_procedures: [],
      duration_minutes: 60, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    // สาขาทองหล่อ (BR-002)
    {
      course_ID: "CS-101", branch_ID: "BR-002", name: "Botox พรีเมียม 5 ครั้ง", quantity_used: 5, validity_days: 365, price: 18000,
      products: [{ product_ID: "PD-101", sub_unit_per_use: 2 }],
      BT_procedures: [{ medical_procedure_ID: "MP-102" }],
      doctor_procedures: [{ medical_procedure_ID: "MP-101" }],
      duration_minutes: 60, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
    {
      course_ID: "CS-102", branch_ID: "BR-002", name: "ทรีตเมนต์ทองหล่อ 8 ครั้ง", quantity_used: 8, validity_days: 365, price: 9000,
      products: [{ product_ID: "PD-102", sub_unit_per_use: 1 }],
      BT_procedures: [{ medical_procedure_ID: "MP-102" }], doctor_procedures: [],
      duration_minutes: 45, is_promotion_course: false, origin_course_ID: null, active: true, ...ts,
    },
  ]);

  const today = new Date();
  const d = (n) => {
    const x = new Date(today.getTime() + n * 86400000);
    return x.toISOString().slice(0, 10);
  };

  await db.collection("promotions").insertMany([
    { promotion_ID: "PM-001", branch_ID: "BR-001", name: "ลด 10% Botox หน้าเรียว", type: "discount", course_ID: "CS-001", discount_type: "percent", discount_value: 10, promo_course_ID: null, date_start: d(-30), date_end: d(60), banner_image: "/courses/botox.jpg", active: true, ...ts },
    { promotion_ID: "PM-002", branch_ID: "BR-001", name: "โปร Botox 5+1", type: "new_course", course_ID: null, discount_type: null, discount_value: 0, promo_course_ID: "CS-003", date_start: d(-10), date_end: d(30), banner_image: "/courses/promo.jpg", active: true, ...ts },
  ]);

  // รูป banner ต่อคอร์ส (AI photo ที่ public/courses/*.jpg — สร้างด้วย scripts/gen-photos.mjs)
  // อยากใช้ vector แทน เปลี่ยน .jpg → .svg (มีทั้งคู่ใน public/courses/)
  const IMG = { "CS-001": "botox", "CS-002": "skincare", "CS-003": "promo", "CS-004": "filler", "CS-005": "thread", "CS-006": "skincare", "CS-007": "combo", "CS-008": "gold", "CS-101": "botox", "CS-102": "gold" };
  for (const [id, n] of Object.entries(IMG)) await db.collection("courses").updateOne({ course_ID: id }, { $set: { image: `/courses/${n}.jpg` } });

  // ตั้งค่าคอมมิชชั่นต่อสาขา: tier ยอดขาย sale + ตารางคอม add-on (sale/หมอ)
  await db.collection("commissionsettings").insertMany([
    {
      branch_ID: "BR-001", tier_mode: "whole",
      sale_tiers: [
        { min_sales: 0, percent: 3 },
        { min_sales: 100000, percent: 5 },
        { min_sales: 300000, percent: 7 },
      ],
      addon_rates: [
        { product_ID: "PD-001", sale_type: "percent", sale_value: 10, doctor_type: "percent", doctor_value: 5 },
        { product_ID: "PD-002", sale_type: "baht", sale_value: 500, doctor_type: "baht", doctor_value: 300 },
        { product_ID: "PD-003", sale_type: "percent", sale_value: 15, doctor_type: "baht", doctor_value: 50 },
      ],
      ...ts,
    },
    {
      branch_ID: "BR-002", tier_mode: "whole",
      sale_tiers: [
        { min_sales: 0, percent: 4 },
        { min_sales: 150000, percent: 6 },
      ],
      addon_rates: [
        { product_ID: "PD-101", sale_type: "percent", sale_value: 10, doctor_type: "percent", doctor_value: 5 },
        { product_ID: "PD-102", sale_type: "percent", sale_value: 20, doctor_type: "baht", doctor_value: 80 },
      ],
      ...ts,
    },
  ]);

  // stock: 2 lot ราคาทุนต่างกัน (ทดสอบ FIFO + ต้นทุนจริงตาม lot)
  await db.collection("stocklots").insertMany([
    { lot_ID: "LOT-00001", branch_ID: "BR-001", product_ID: "PD-001", lot_number: "B2401", supplier: "MedSupply", cost_price_per_unit: 3500, quantity_received: 3, expiry_date: d(120), received_at: d(-20), received_by: "US-002", ...ts },
    { lot_ID: "LOT-00002", branch_ID: "BR-001", product_ID: "PD-001", lot_number: "B2402", supplier: "MedSupply", cost_price_per_unit: 3800, quantity_received: 3, expiry_date: d(240), received_at: d(-5), received_by: "US-002", ...ts },
    { lot_ID: "LOT-00003", branch_ID: "BR-001", product_ID: "PD-003", lot_number: "M001", supplier: "GoldMask", cost_price_per_unit: 300, quantity_received: 10, expiry_date: d(365), received_at: d(-5), received_by: "US-002", ...ts },
    // สาขาทองหล่อ (BR-002)
    { lot_ID: "LOT-00004", branch_ID: "BR-002", product_ID: "PD-101", lot_number: "T2401", supplier: "MedSupply", cost_price_per_unit: 4000, quantity_received: 4, expiry_date: d(200), received_at: d(-10), received_by: "US-009", ...ts },
    { lot_ID: "LOT-00005", branch_ID: "BR-002", product_ID: "PD-102", lot_number: "S001", supplier: "SerumCo", cost_price_per_unit: 500, quantity_received: 8, expiry_date: d(300), received_at: d(-8), received_by: "US-009", ...ts },
  ]);

  const items = [];
  let iv = 1;
  const mkItem = (branch_ID, product_ID, lot_ID, uses, cc) => ({
    item_ID: `IV-${String(iv++).padStart(6, "0")}`,
    branch_ID, product_ID, lot_ID, state: "unused",
    opened_at: null, open_expiry_at: null,
    uses_remaining: uses, cc_remaining: cc, usage_log: [], ...ts,
  });
  for (let i = 0; i < 3; i++) items.push(mkItem("BR-001", "PD-001", "LOT-00001", 5, 10));
  for (let i = 0; i < 3; i++) items.push(mkItem("BR-001", "PD-001", "LOT-00002", 5, 10));
  for (let i = 0; i < 10; i++) items.push(mkItem("BR-001", "PD-003", "LOT-00003", 1, 1));
  for (let i = 0; i < 4; i++) items.push(mkItem("BR-002", "PD-101", "LOT-00004", 5, 10));
  for (let i = 0; i < 8; i++) items.push(mkItem("BR-002", "PD-102", "LOT-00005", 1, 1));
  await db.collection("inventoryitems").insertMany(items);

  await db.collection("systemconfigs").insertOne({
    branch_ID: null,
    hn_format: { prefix: "HN", include_year: true, digits: 4, reset_yearly: true },
    default_language: "th", currency: "THB", sick_cert_threshold_days: 2, ...ts,
  });

  // ตั้ง counter ให้เลยเลขที่ seed ไว้ กัน ID ชนกัน
  await db.collection("counters").insertMany([
    { key: "BR", seq: 10 }, { key: "RM", seq: 10 }, { key: "US", seq: 20 },
    { key: "MP", seq: 110 }, { key: "PD", seq: 110 }, { key: "CS", seq: 110 },
    { key: "PM", seq: 10 }, { key: "LOT", seq: 10 }, { key: "IV", seq: iv },
    { key: "RS", seq: 0 }, { key: "OPD", seq: 0 }, { key: "CC", seq: 0 },
    { key: "PAY", seq: 0 }, { key: "EN", seq: 0 }, { key: "EX", seq: 0 },
    { key: "LV", seq: 0 }, { key: "PO", seq: 0 }, { key: "AT", seq: 0 },
  ]);

}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("connected:", MONGODB_URI);
  await seedBase(mongoose.connection.db);
  console.log("seed เสร็จ ✓ — 2 สาขา · users 12 (BR-001×8, BR-002×4) · catalog แยกสาขา · commission settings 2");
  await mongoose.disconnect();
}

// รันเป็น script โดยตรงเท่านั้น (seed-demo import seedBase มาใช้ได้โดยไม่ trigger)
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/seed.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
