"use client";
// ใบเสร็จรับเงิน — หน้าพิมพ์/บันทึก PDF ให้ลูกค้า
// เปิดด้วย ?id=<receipt_ID|receipt_no> หรือ ?cc=<customer_course_ID> (ใบล่าสุดของคอร์ส)
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/client";

const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
const METHOD_TH = { cash: "เงินสด", transfer: "โอน", card: "บัตร", deposit: "หักจากมัดจำ" };
const thDate = (d) => new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

function ReceiptInner() {
  const sp = useSearchParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const id = sp.get("id");
    const cc = sp.get("cc");
    (async () => {
      try {
        if (id) setR(await api(`/receipts/${encodeURIComponent(id)}`));
        else if (cc) {
          const list = await api(`/receipts?cc=${encodeURIComponent(cc)}`);
          if (!list.length) throw new Error("ยังไม่มีใบเสร็จของคอร์สนี้");
          setR(list[0]);
        }
      } catch (e) { setErr(e.message); }
    })();
  }, [sp]);

  return (
    <div className="app-content">
      <div className="container py-3" style={{ maxWidth: 640 }}>
        <div className="d-flex gap-2 mb-3 d-print-none">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์ / บันทึก PDF
          </button>
          <button className="btn btn-outline-secondary" onClick={() => history.back()}>← กลับ</button>
        </div>
        {err && <div className="alert alert-danger py-2">{err}</div>}

        {r && (
          <div className="card shadow-sm rc-doc position-relative">
            {r.status === "voided" && (
              <div className="position-absolute top-50 start-50 translate-middle text-danger fw-bold border border-danger border-3 rounded-3 px-4 py-2"
                   style={{ fontSize: 34, transform: "translate(-50%,-50%) rotate(-18deg)", opacity: 0.55, zIndex: 5 }}>
                ยกเลิก (VOID)
              </div>
            )}
            <div className="card-body p-4" style={{ fontSize: 14, lineHeight: 1.9 }}>
              <div className="text-center border-bottom pb-2 mb-2">
                <div className="fw-bold" style={{ fontSize: 17 }}>{r.company?.name || "คลินิก"}</div>
                {r.company?.address && <div className="small text-muted">{r.company.address}</div>}
                <div className="small text-muted">
                  {r.company?.tax_id && <>เลขประจำตัวผู้เสียภาษี {r.company.tax_id}</>}
                  {r.company?.phone && <> · โทร {r.company.phone}</>}
                </div>
                <div className="fw-bold mt-1" style={{ fontSize: 15 }}>ใบเสร็จรับเงิน</div>
              </div>

              <div className="d-flex justify-content-between">
                <span>เลขที่: <b className="font-monospace">{r.receipt_no}</b></span>
                <span>วันที่: {thDate(r.issued_at)}</span>
              </div>
              <div>
                ได้รับเงินจาก: <b>{r.customer_name || r.HN_number || "ลูกค้า"}</b>
                {r.HN_number && <span className="text-muted small ms-2">({r.HN_number})</span>}
              </div>

              <table className="table table-sm mt-2 mb-2">
                <thead><tr className="table-light"><th>รายการ</th><th className="text-end" style={{ width: 130 }}>จำนวนเงิน</th></tr></thead>
                <tbody>
                  {(r.items || []).map((it, i) => (
                    <tr key={i}><td>{it.description}</td><td className="text-end">{money(it.amount)}</td></tr>
                  ))}
                  <tr className="fw-bold table-light"><td className="text-end">รวมทั้งสิ้น</td><td className="text-end">{money(r.total)} บาท</td></tr>
                </tbody>
              </table>

              <div className="small">
                ชำระโดย: {(r.payments || []).map((p, i) => (
                  <span key={i} className="badge text-bg-light border me-1">{METHOD_TH[p.method] || p.method} {money(p.amount)}฿</span>
                ))}
              </div>
              {r.status === "voided" && (
                <div className="alert alert-danger py-1 small mt-2 mb-0">
                  ยกเลิกเมื่อ {new Date(r.void_at).toLocaleString("th-TH")} · เหตุผล: {r.void_reason}
                </div>
              )}

              <div className="d-flex justify-content-end mt-4">
                <div className="text-center">
                  <div style={{ height: 34 }} />
                  <div>ลงชื่อ ……………………………… ผู้รับเงิน</div>
                  <div className="small text-muted">({r.issued_by})</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
          .rc-doc { border: none !important; box-shadow: none !important; }
          @page { size: A5 portrait; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

export default function ReceiptPage() {
  return <Suspense fallback={null}><ReceiptInner /></Suspense>;
}
