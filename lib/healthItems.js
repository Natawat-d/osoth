// ข้อมูลสุขภาพ 9 ข้อ — ตามเอกสาร "ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ" (Beyond Clinic)
// ใช้ร่วมกัน: ฟอร์มสร้าง HN (รับลูกค้า) + หน้าพิมพ์ประวัติ /app/history-form
export const HEALTH_ITEMS = [
  { key: "chronic", label: "โรคประจำตัว" },
  { key: "hiv", label: "ประวัติการรักษาหรือวินิจฉัยโรคเอชไอวี (HIV)" },
  { key: "psych_med", label: "เคยใช้ / กำลังใช้ยาทางจิตเวช" },
  { key: "medication", label: "การใช้ยา / อาหารเสริม" },
  { key: "allergy", label: "ประวัติการแพ้ยา / อาหาร" },
  { key: "surgery", label: "การผ่าตัดที่ผ่านมา" },
  { key: "procedure", label: "การทำหัตถการที่ผ่านมา" },
  { key: "smoke_alcohol", label: "การสูบบุหรี่ / ดื่มแอลกอฮอล์" },
  { key: "pregnancy", label: "การตั้งครรภ์" },
];

export const PREFIXES = ["นาย", "นาง", "นางสาว"];

// วันที่ไทยแบบเอกสาร: วันที่ 12 เดือน มกราคม ปี 2569
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export function thaiDocDate(iso) {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, m, d] = iso.split("-").map(Number);
  return { d: String(d), m: MONTHS_TH[m - 1] || "", y: String(y + 543) };
}

export function ageFromBirth(birth_date) {
  if (!birth_date) return "";
  const b = new Date(birth_date + "T00:00:00");
  if (isNaN(b)) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : "";
}
