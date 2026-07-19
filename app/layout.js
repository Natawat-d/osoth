import { Sarabun } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";

// Sarabun = ฟอนต์มาตรฐานเอกสารราชการไทย — เป็นทางการ อ่านง่ายในตาราง/ฟอร์ม
// ใช้ตัวหนา (600/700) เป็นหัวข้อ, ตัวปกติเป็นเนื้อหา
const sarabunDisplay = Sarabun({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

const sarabunBody = Sarabun({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "โอสถ — ERP คลินิคเสริมความงาม",
  description: "ระบบบริหารคลินิคเสริมความงาม",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${sarabunDisplay.variable} ${sarabunBody.variable}`}>
      {/* extension เช่น Grammarly/asbplayer แก้ attribute ของ body ก่อน React hydrate
          — suppress เฉพาะ attribute ชั้นนี้ ไม่กระทบการตรวจ mismatch ของเนื้อหาข้างใน */}
      <body suppressHydrationWarning>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
