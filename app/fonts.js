import { Sarabun } from "next/font/google";

// Sarabun = ฟอนต์มาตรฐานเอกสารราชการไทย — ใช้ร่วมทุก root layout (legacy + V2)
// next/font ต้องประกาศเป็น const ระดับโมดูล — แชร์ผ่านไฟล์นี้
export const sarabunDisplay = Sarabun({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const sarabunBody = Sarabun({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});
