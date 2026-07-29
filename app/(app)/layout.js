// Root layout ของแอป V2 (ทุกหน้าใต้ /app) — AdminLTE shell
// แยก root layout จากหน้าเดิม (multiple root layouts) เพื่อไม่โหลด globals.css เก่าที่ชน Bootstrap
import "bootstrap/dist/css/bootstrap.css";
import "admin-lte/dist/css/adminlte.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../adminlte-theme.css";
import "../legacy-compat.css"; // widget เดิม scoped .lgc — ใช้ในแท็บที่ฝังของเดิม (Finance/HR/Setup)
import Providers from "@/components/Providers";
import AdminShell from "@/components/AdminShell";
import { sarabunDisplay, sarabunBody } from "../fonts";

export const metadata = {
  title: "Healthcare Operator System",
  description: "Healthcare Operator System (HOS) — ระบบบริหารคลินิกความงาม",
};

export default function AppRootLayout({ children }) {
  return (
    <html lang="th" className={`${sarabunDisplay.variable} ${sarabunBody.variable}`}>
      {/* class ตาม markup AdminLTE v4: sidebar โชว์บนจอ ≥lg + layout ตรึง header */}
      <body className="layout-fixed sidebar-expand-lg bg-body-tertiary" suppressHydrationWarning>
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
