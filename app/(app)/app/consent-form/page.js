"use client";
// หนังสือข้อตกลง+ยินยอมทำหัตถการ (ตามเอกสารคลินิก 7 ข้อ) — หน้าพิมพ์
// ปกติลูกค้าเซ็นบนจอ (iPad) ในหน้า OPD · หน้านี้ไว้พิมพ์กระดาษ/บันทึก PDF
// เปิดจาก OPD: /app/consent-form?hn=HN-xxx&course=ชื่อหัตถการ — เติมข้อมูลลูกค้าอัตโนมัติ
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useGetSetupStateQuery } from "@/store/apiSlice";
import { api } from "@/lib/client";
import ConsentAgreement from "@/components/ConsentAgreement";

function ConsentFormInner() {
  const sp = useSearchParams();
  const { data: setup } = useGetSetupStateQuery();
  const hn = sp.get("hn") || "";
  const course = sp.get("course") || "";
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    if (hn) api(`/customers/${encodeURIComponent(hn)}`).then((r) => setCustomer(r.customer)).catch(() => {});
  }, [hn]);

  return (
    <div className="app-content">
      <div className="container py-3" style={{ maxWidth: 860 }}>
        <div className="d-flex gap-2 mb-3 d-print-none">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์ / บันทึก PDF
          </button>
          <button className="btn btn-outline-secondary" onClick={() => history.back()}>← กลับ</button>
          <span className="text-muted small align-self-center">* ปกติให้ลูกค้าเซ็นบนจอในหน้า OPD — หน้านี้สำหรับพิมพ์กระดาษ</span>
        </div>

        <div className="card shadow-sm cf-doc">
          <div className="card-body p-4">
            <ConsentAgreement customer={customer} procedure={course} company={setup?.company} />
          </div>
        </div>
      </div>

      {/* พิมพ์: ซ่อนเปลือกระบบ เหลือแต่ฟอร์ม */}
      <style jsx global>{`
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
          .cf-doc { border: none !important; box-shadow: none !important; }
          .cf-doc .ca-doc { font-size: 11.5px !important; line-height: 1.8 !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

export default function ConsentFormPage() {
  return <Suspense fallback={null}><ConsentFormInner /></Suspense>;
}
