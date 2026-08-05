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
        <div className="cf-bar d-flex gap-2 mb-3 d-print-none align-items-center flex-wrap">
          <span className="cf-barico flex-shrink-0"><i className="bi bi-file-earmark-medical" /></span>
          <div className="me-2">
            <div className="fw-semibold" style={{ fontSize: 14, lineHeight: 1.3 }}>หนังสือยินยอมทำหัตถการ</div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>ปกติให้ลูกค้าเซ็นบนจอในหน้า OPD — หน้านี้สำหรับพิมพ์กระดาษ</div>
          </div>
          <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => history.back()}>← กลับ</button>
          <button className="btn btn-primary btn-sm px-4 cf-print" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์ / บันทึก PDF
          </button>
        </div>

        {!hn && (
          <div className="alert alert-warning py-2 d-print-none">
            <i className="bi bi-exclamation-triangle me-1" />ไม่ได้ระบุ HN — เปิดหน้านี้จากหน้า OPD หรือโปรไฟล์ลูกค้า ระบบจะเติมข้อมูลลูกค้าให้อัตโนมัติ (พิมพ์เปล่าเพื่อกรอกมือได้)
          </div>
        )}
        {hn && !customer && (
          <div className="text-center text-muted py-4 d-print-none">
            <span className="spinner-border spinner-border-sm me-2" />กำลังโหลดข้อมูลลูกค้า {hn}…
          </div>
        )}

        <div className="cf-stage">
          <div className="card shadow-sm cf-doc">
            <div className="card-body p-4">
              <ConsentAgreement customer={customer} procedure={course} company={setup?.company} />
            </div>
          </div>
        </div>
      </div>

      {/* พิมพ์: ซ่อนเปลือกระบบ เหลือแต่ฟอร์ม */}
      <style jsx global>{`
        /* เอกสาร = กระดาษ: พื้นขาวตัวดำเสมอ แม้ระบบอยู่ dark mode (กันพิมพ์/บันทึก PDF พื้นดำ) */
        .cf-doc, .cf-doc .card-body { background: #fff !important; color: #1a1a1a !important; }
        .cf-doc .text-muted { color: #6c757d !important; }

        /* กรอบรอบนอก + toolbar หรู (เฉพาะบนจอ — เนื้อเอกสารคงเดิมทางการ) */
        @media screen {
          .cf-bar { background: color-mix(in srgb, var(--bs-body-bg) 78%, transparent);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            border: 1px solid var(--bs-border-color-translucent); border-radius: 14px; padding: .6rem .8rem;
            box-shadow: 0 1px 2px rgba(15, 35, 60, .05), 0 6px 18px rgba(15, 35, 60, .06); }
          .cf-barico { width: 34px; height: 34px; border-radius: 11px; color: #fff; font-size: 16px;
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #1560a3, #2a7bc4); box-shadow: 0 3px 9px rgba(21, 96, 163, .32); }
          .cf-bar .btn { transition: transform .18s ease, box-shadow .18s ease; }
          .cf-bar .btn:active { transform: scale(.96); }
          .cf-print { background-image: linear-gradient(135deg, #1560a3, #2a7bc4); border: 0;
            box-shadow: 0 2px 8px rgba(21, 96, 163, .28); }
          .cf-print:hover { box-shadow: 0 5px 16px rgba(21, 96, 163, .38); transform: translateY(-1px); }
          .cf-stage { padding: 22px; border-radius: 18px;
            background: linear-gradient(160deg, color-mix(in srgb, #1560a3 8%, var(--bs-body-bg)),
              color-mix(in srgb, #1560a3 2%, var(--bs-body-bg)) 65%);
            border: 1px solid color-mix(in srgb, #1560a3 14%, transparent); }
          .cf-doc { border: 1px solid #dfe5eb !important; border-radius: 6px;
            box-shadow: 0 14px 38px rgba(10, 35, 66, .16), 0 3px 10px rgba(10, 35, 66, .08) !important; }
          [data-bs-theme="dark"] .cf-doc { box-shadow: 0 14px 38px rgba(0, 0, 0, .5), 0 3px 10px rgba(0, 0, 0, .35) !important; }
        }
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
          .cf-stage { padding: 0 !important; border: none !important; background: none !important; }
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
