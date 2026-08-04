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
  const hn = sp.get("hn") || "";
  const { data: setup } = useGetSetupStateQuery();
  const company = setup?.company;
  const [c, setC] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (hn) api(`/customers/${encodeURIComponent(hn)}`).then((r) => setC(r.customer)).catch((e) => setErr(e.message));
  }, [hn]);

  const dt = thaiDocDate(c?.history_date || (c?.created_at || "").slice(0, 10));
  const bd = c?.birth_date ? c.birth_date.split("-") : null; // [y,m,d]
  const h = c?.health_info || {};

  return (
    <div className="app-content">
      <div className="container py-3" style={{ maxWidth: 820 }}>
        <div className="d-flex gap-2 mb-3 d-print-none">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์ / บันทึก PDF
          </button>
          <button className="btn btn-outline-secondary" onClick={() => history.back()}>← กลับ</button>
          {c && !c.history_date && (
            <span className="badge text-bg-warning align-self-center">ลูกค้าเก่าก่อนมีแบบฟอร์ม — ข้อมูลสุขภาพอาจไม่ครบ</span>
          )}
        </div>
        {err && <div className="alert alert-danger py-2">{err}</div>}

        <div className="card shadow-sm hf-doc">
          <div className="card-body p-4" style={{ fontSize: 14.5, lineHeight: 2.1 }}>
            {/* หัวเอกสาร */}
            <div className="d-flex align-items-start mb-1">
              <img src={`${bp}${company?.brand?.logo || "/brand/logo.jpg"}`} alt="logo" width={54} height={54} style={{ borderRadius: 8 }} />
              <div className="ms-auto border border-dark rounded px-3 py-1 fw-bold">HN. {c?.HN_number || "…………………"}</div>
            </div>
            <div className="text-center fw-bold" style={{ fontSize: 16 }}>ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ</div>
            <div className="text-center small text-muted mb-2">{company?.name || ""}</div>
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
                {c?.history_signature
                  ? <img src={c.history_signature} alt="ลายเซ็น" style={{ height: 60, display: "block", margin: "0 auto" }} />
                  : <div style={{ height: 40 }} />}
                <div>ลงชื่อ ……………………………………… ผู้ใช้บริการ</div>
                <div>( {c ? `${c.prefix ? c.prefix + " " : ""}${c.full_name} ${c.sure_name || ""}`.trim() : "………………………………………"} )</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .hf-u { display: inline-block; border-bottom: 1px dotted #888; padding: 0 6px; font-weight: 600; }
        .hf-cb { font-size: 17px; }
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
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
