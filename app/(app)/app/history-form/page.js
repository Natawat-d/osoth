"use client";
// เอกสาร "ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ" ของ HN — เลย์เอาต์ตามแบบฟอร์มคลินิก
// เปิดจากหน้ารับลูกค้า/โปรไฟล์ลูกค้า · พิมพ์/บันทึก PDF ด้วยปุ่มพิมพ์ (window.print)
// ลูกค้าเดิมมารอบใหม่ (คนละคอร์ส) ใช้เอกสารชุดนี้เดิม — ไม่ต้องกรอกใหม่
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useGetSetupStateQuery } from "@/store/apiSlice";
import { api } from "@/lib/client";
import { HEALTH_ITEMS, thaiDocDate, ageFromBirth } from "@/lib/healthItems";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
const U = ({ v, w = "auto" }) => (
  <span className="hf-u" style={{ minWidth: w }}>{v || " "}</span>
);

function HistoryFormInner() {
  const sp = useSearchParams();
  const hnParam = sp.get("hn") || "";
  const ccId = sp.get("cc") || ""; // โหมดเอกสารประจำคอร์ส (health_record ที่เซ็นตอนเริ่มคอร์สครั้งแรก)
  const { data: setup } = useGetSetupStateQuery();
  const company = setup?.company;
  const [c, setC] = useState(null);
  const [ccDoc, setCcDoc] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (ccId) {
          const cc = await api(`/customer-courses/${encodeURIComponent(ccId)}`);
          setCcDoc(cc);
          if (cc.HN_number) setC((await api(`/customers/${encodeURIComponent(cc.HN_number)}`)).customer);
        } else if (hnParam) {
          setC((await api(`/customers/${encodeURIComponent(hnParam)}`)).customer);
        }
      } catch (e) { setErr(e.message); }
    })();
  }, [hnParam, ccId]);

  const hn = ccId ? (ccDoc?.HN_number || "") : hnParam;
  const rec = ccDoc?.health_record || null; // เอกสารประจำคอร์ส: สุขภาพ+ลายเซ็น จาก health_record
  const docDate = rec?.signed_at ? new Date(rec.signed_at).toISOString().slice(0, 10) : null;
  const dt = thaiDocDate(docDate || c?.history_date || (c?.created_at || "").slice(0, 10));
  const bd = c?.birth_date ? c.birth_date.split("-") : null; // [y,m,d]
  const h = rec ? rec.health_info || {} : c?.health_info || {};
  const signatureImg = rec ? rec.signature : c?.history_signature;

  return (
    <div className="app-content">
      <div className="container py-3" style={{ maxWidth: 820 }}>
        <div className="hf-bar d-flex gap-2 mb-3 d-print-none align-items-center flex-wrap">
          <span className="hf-barico flex-shrink-0"><i className="bi bi-file-earmark-person" /></span>
          <div className="me-2">
            <div className="fw-semibold" style={{ fontSize: 14, lineHeight: 1.3 }}>เอกสารประวัติผู้ใช้บริการ</div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>เอกสาร A4 — กด &ldquo;พิมพ์&rdquo; แล้วเลือกบันทึกเป็น PDF ได้</div>
            {c && !c.history_date && (
              <span className="badge text-bg-warning mt-1">ลูกค้าเก่าก่อนมีแบบฟอร์ม — ข้อมูลสุขภาพอาจไม่ครบ</span>
            )}
          </div>
          <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => history.back()}>← กลับ</button>
          <button className="btn btn-primary btn-sm px-4 hf-print" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์ / บันทึก PDF
          </button>
        </div>
        {err && <div className="alert alert-danger py-2">{err}</div>}
        {!hn && !ccId && !err && <div className="alert alert-warning py-2 d-print-none"><i className="bi bi-exclamation-triangle me-1" />ไม่ได้ระบุ HN — เปิดหน้านี้จากโปรไฟล์ลูกค้า หรือหน้ารับลูกค้า</div>}
        {(hn || ccId) && !c && !err && (
          <div className="text-center text-muted py-5 d-print-none">
            <span className="spinner-border spinner-border-sm me-2" />กำลังโหลดข้อมูลลูกค้า {hn}…
          </div>
        )}

        {!((hn || ccId) && !c && !err) && (
        <div className="hf-stage">
        <div className="card shadow-sm hf-doc">
          <div className="card-body p-4" style={{ fontSize: 14.5, lineHeight: 2.1 }}>
            {/* หัวเอกสาร */}
            <div className="d-flex align-items-start mb-1">
              <img src={`${bp}${company?.brand?.logo || "/brand/logo.jpg"}`} alt="logo" width={54} height={54} style={{ borderRadius: 8 }} />
              {/* HN_number ขึ้นต้นด้วย "HN-" อยู่แล้ว — ไม่เติมคำนำหน้าซ้ำเป็น "HN. HN-xxx" */}
              <div className="ms-auto border border-dark rounded px-3 py-1 fw-bold">{c?.HN_number || "HN. …………………"}</div>
            </div>
            <div className="text-center fw-bold" style={{ fontSize: 16 }}>ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ</div>
            {rec && <div className="text-center small text-muted">ประจำคอร์ส: {ccDoc?.course_snapshot?.name || ccDoc?.course_ID} (บันทึกครั้งแรกของคอร์ส)</div>}
            <div className="text-center small text-muted mb-2" style={{ lineHeight: 1.5 }}>
              {company?.name || ""}
              {(company?.address || company?.phone) && (
                <div>
                  {company?.address || ""}{company?.address && company?.phone ? " · " : ""}{company?.phone ? `โทร ${company.phone}` : ""}
                </div>
              )}
            </div>
            <div className="text-end">วันที่ <U v={dt.d} w={36} /> เดือน <U v={dt.m} w={90} /> ปี <U v={dt.y} w={54} /></div>

            <div>
              ชื่อ-นามสกุล: (นาย / นาง / นางสาว) <U v={c ? `${c.prefix ? c.prefix + " " : ""}${c.full_name} ${c.sure_name || ""}`.trim() : ""} w={280} />
              &nbsp;ชื่อเล่น: <U v={c?.nick_name} w={70} />
            </div>
            <div>
              เลขบัตรประชาชน/หนังสือเดินทาง: <U v={c?.id_card} w={220} /> สัญชาติ: <U v={c?.nationality} w={90} />
            </div>
            <div>
              วัน/เดือน/ปีเกิด: <U v={bd ? `${bd[2]} / ${bd[1]} / ${+bd[0] + 543}` : ""} w={120} />
              &nbsp;อายุ: <U v={ageFromBirth(c?.birth_date)} w={40} /> ปี
              &nbsp;เพศ: <U v={c?.gender} w={60} />
            </div>
            <div>ที่อยู่ปัจจุบัน: <U v={c?.address} w={440} /></div>
            <div>
              อีเมล: <U v={c?.email} w={170} /> ID LINE: <U v={c?.line_id} w={120} /> เบอร์ติดต่อ: <U v={c?.phone} w={130} />
            </div>
            <div>
              ชื่อบุคคลที่ติดต่อได้ในกรณีฉุกเฉิน: <U v={c?.emergency?.name} w={170} />
              &nbsp;ความสัมพันธ์ในฐานะ / เกี่ยวข้องเป็น: <U v={c?.emergency?.relation} w={90} />
            </div>
            <div>เบอร์โทรศัพท์ที่ติดต่อได้ในกรณีฉุกเฉิน: <U v={c?.emergency?.phone} w={160} /></div>

            <div className="fw-bold mt-2">ข้อมูลสุขภาพ กรุณากรอกข้อมูลตามความเป็นจริง:</div>
            {HEALTH_ITEMS.map(({ key, label }, i) => {
              const item = h[key] || { has: null, detail: "" };
              return (
                <div key={key}>
                  {i + 1}. {label}:&nbsp;
                  <span className="hf-cb">{item.has === false ? "☑" : "☐"}</span> ไม่มี&nbsp;
                  <span className="hf-cb">{item.has === true ? "☑" : "☐"}</span> มี (ระบุ) <U v={item.has ? item.detail : ""} w={200} />
                </div>
              );
            })}

            <div className="mt-3" style={{ textIndent: 40 }}>
              ผู้ใช้บริการขอยืนยันว่าข้อมูลทั้งหมดเป็นความจริง หากมีการปกปิดหรือให้ข้อมูลเท็จ ข้าพเจ้ารับผิดชอบ
              ต่อความเสียหายทั้งหมดแต่เพียงผู้เดียว และยินยอมเปิดเผยข้อมูลข้างต้นแก่ผู้ให้บริการ คลินิก และแพทย์
            </div>

            <div className="text-end mt-4" style={{ lineHeight: 1.6 }}>
              <div className="d-inline-block text-center">
                {signatureImg
                  ? <img src={signatureImg} alt="ลายเซ็น" style={{ height: 60, display: "block", margin: "0 auto" }} />
                  : <div style={{ height: 40 }} />}
                <div>ลงชื่อ ……………………………………… ผู้ใช้บริการ</div>
                <div>( {c ? `${c.prefix ? c.prefix + " " : ""}${c.full_name} ${c.sure_name || ""}`.trim() : "………………………………………"} )</div>
              </div>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      <style jsx global>{`
        /* เอกสาร = กระดาษ: บังคับพื้นขาวตัวดำเสมอ แม้ระบบอยู่ dark mode (กันพิมพ์/บันทึก PDF ออกมาเป็นพื้นดำ) */
        .hf-doc, .hf-doc .card-body { background: #fff !important; color: #1a1a1a !important; }
        .hf-doc .text-muted { color: #6c757d !important; }
        .hf-doc .border-dark { border-color: #1a1a1a !important; }
        .hf-u { display: inline-block; border-bottom: 1px dotted #888; padding: 0 6px; font-weight: 600; }
        .hf-cb { font-size: 17px; }

        /* กรอบรอบนอก + toolbar หรู (เฉพาะบนจอ — เนื้อเอกสารคงเดิมทางการ) */
        @media screen {
          .hf-bar { background: color-mix(in srgb, var(--bs-body-bg) 78%, transparent);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            border: 1px solid var(--bs-border-color-translucent); border-radius: 14px; padding: .6rem .8rem;
            box-shadow: 0 1px 2px rgba(15, 35, 60, .05), 0 6px 18px rgba(15, 35, 60, .06); }
          .hf-barico { width: 34px; height: 34px; border-radius: 11px; color: #fff; font-size: 16px;
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #1560a3, #2a7bc4); box-shadow: 0 3px 9px rgba(21, 96, 163, .32); }
          .hf-bar .btn { transition: transform .18s ease, box-shadow .18s ease; }
          .hf-bar .btn:active { transform: scale(.96); }
          .hf-print { background-image: linear-gradient(135deg, #1560a3, #2a7bc4); border: 0;
            box-shadow: 0 2px 8px rgba(21, 96, 163, .28); }
          .hf-print:hover { box-shadow: 0 5px 16px rgba(21, 96, 163, .38); transform: translateY(-1px); }
          .hf-stage { padding: 22px; border-radius: 18px;
            background: linear-gradient(160deg, color-mix(in srgb, #1560a3 8%, var(--bs-body-bg)),
              color-mix(in srgb, #1560a3 2%, var(--bs-body-bg)) 65%);
            border: 1px solid color-mix(in srgb, #1560a3 14%, transparent); }
          .hf-doc { border: 1px solid #dfe5eb !important; border-radius: 6px;
            box-shadow: 0 14px 38px rgba(10, 35, 66, .16), 0 3px 10px rgba(10, 35, 66, .08) !important; }
          [data-bs-theme="dark"] .hf-doc { box-shadow: 0 14px 38px rgba(0, 0, 0, .5), 0 3px 10px rgba(0, 0, 0, .35) !important; }
        }
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
          .hf-stage { padding: 0 !important; border: none !important; background: none !important; }
          .hf-doc { border: none !important; box-shadow: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
    </div>
  );
}

export default function HistoryFormPage() {
  return <Suspense fallback={null}><HistoryFormInner /></Suspense>;
}
