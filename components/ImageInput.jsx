"use client";
import { useRef } from "react";

// ตั้งค่ารูป: วาง URL หรืออัปโหลดไฟล์ (แปลงเป็น data URL เก็บในฐานข้อมูล) + ตัวอย่าง
export default function ImageInput({ value, onChange, label = "รูปภาพ" }) {
  const fileRef = useRef(null);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      alert("ไฟล์ใหญ่เกิน 1.5MB — ใช้รูปเล็กลงหรือวาง URL แทน");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className="img-preview">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" />
          ) : (
            <span className="muted">ยังไม่มีรูป</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <input
            placeholder="วาง URL รูป เช่น https://..."
            value={value?.startsWith("data:") ? "" : value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
              อัปโหลดไฟล์
            </button>
            {value && (
              <button type="button" className="btn small ghost" onClick={() => onChange("")}>
                ล้างรูป
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{ display: "none" }} />
          <div className="muted" style={{ marginTop: 6 }}>
            รองรับ URL หรืออัปโหลดไฟล์ (≤1.5MB) · แนะนำสัดส่วน 4:3
          </div>
        </div>
      </div>
    </div>
  );
}
