import { Kanit, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";

// Kanit = ตัวคมมีพลัง สำหรับหัวข้อ/แบรนด์ (geometric, หนักแน่นแบบโปสเตอร์จีน)
const kanit = Kanit({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

// IBM Plex Sans Thai = ตัวคม อ่านง่าย สำหรับเนื้อหา/ตาราง/ฟอร์ม
const plex = IBM_Plex_Sans_Thai({
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
    <html lang="th" className={`${kanit.variable} ${plex.variable}`}>
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
