// Root layout ของกลุ่มหน้า public/entry V2 (about_me, login, register) — AdminLTE
// แยก root layout จากหน้าเดิม (multiple root layouts) เพื่อไม่โหลด globals.css เก่าที่ชน Bootstrap
import "bootstrap/dist/css/bootstrap.css";
import "admin-lte/dist/css/adminlte.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../adminlte-theme.css";
import Providers from "@/components/Providers";
import { sarabunDisplay, sarabunBody } from "../fonts";

export const metadata = {
  title: "Healthcare Operator System",
  description: "Osoth คลินิกความงาม — บริการ คอร์ส โปรโมชั่น",
};

export default function SiteRootLayout({ children }) {
  return (
    <html lang="th" className={`${sarabunDisplay.variable} ${sarabunBody.variable}`}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
