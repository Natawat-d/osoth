"use client";
// แบบฟอร์มใบยินยอมมาตรฐาน (พิมพ์ให้ลูกค้าเซ็นบนกระดาษ → สแกน/ถ่ายรูปแนบเข้าเคส)
// เข้าจากปุ่ม "พิมพ์แบบฟอร์ม" ในหน้า OPD · กด "พิมพ์" = window.print (ซ่อน UI ระบบอัตโนมัติ)
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useGetSetupStateQuery } from "@/store/apiSlice";

function ConsentFormInner() {
  const sp = useSearchParams();
  const { data: setup } = useGetSetupStateQuery();
  const company = setup?.company;
  const name = sp.get("name") || "";
  const hn = sp.get("hn") || "";
  const course = sp.get("course") || "";

  return (
    <div className="app-content">
      <div className="container py-3" style={{ maxWidth: 800 }}>
        <div className="d-flex gap-2 mb-3 d-print-none">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> พิมพ์แบบฟอร์ม
          </button>
          <button className="btn btn-outline-secondary" onClick={() => history.back()}>← กลับ</button>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4" style={{ fontSize: 15, lineHeight: 1.9 }}>
            <div className="text-center mb-3">
              <h5 className="fw-bold mb-1">หนังสือแสดงความยินยอมรับการรักษา/ทำหัตถการ</h5>
              <div className="text-muted small">
                {company?.name || "คลินิก"} {company?.address ? `· ${company.address}` : ""}
              </div>
            </div>

            <p>
              ข้าพเจ้า (ชื่อ-สกุล) <b>{name || "…………………………………………………"}</b>
              &nbsp;HN <b>{hn || "………………"}</b>
            </p>
            <p>
              ยินยอมรับการทำหัตถการ/บริการ: <b>{course || "…………………………………………………………………"}</b>
            </p>
            <p>
              โดยข้าพเจ้าได้รับทราบข้อมูลเกี่ยวกับขั้นตอนการทำหัตถการ ประโยชน์ ความเสี่ยง
              ภาวะแทรกซ้อนที่อาจเกิดขึ้น (เช่น อาการบวม แดง ช้ำ อักเสบ ติดเชื้อ หรือผลลัพธ์ที่ไม่เป็นไปตามคาดหวัง)
              รวมถึงทางเลือกอื่นในการรักษาจากแพทย์/เจ้าหน้าที่ของสถานพยาบาลแล้วอย่างครบถ้วน
              และมีโอกาสซักถามจนเป็นที่พอใจ
            </p>
            <p>
              ข้าพเจ้าได้แจ้งประวัติสุขภาพ ประวัติการแพ้ยา/สารต่างๆ และยาที่ใช้ประจำตามความเป็นจริง
              และยินยอมให้สถานพยาบาลบันทึกภาพก่อน-หลังการรักษาเพื่อประโยชน์ในการติดตามผลการรักษาของข้าพเจ้า
            </p>
            <p>
              ข้าพเจ้าเข้าใจดีว่าผลลัพธ์ของการรักษาขึ้นอยู่กับสภาพร่างกายของแต่ละบุคคล
              และขอแสดงความยินยอมโดยสมัครใจ มิได้ถูกบังคับ ขู่เข็ญ หรือชักจูงแต่อย่างใด
            </p>

            <div className="row mt-5 text-center">
              <div className="col-6">
                <div>ลงชื่อ ……………………………………… ผู้รับบริการ</div>
                <div className="mt-2">( ……………………………………… )</div>
                <div className="mt-2">วันที่ ………… / ………… / …………</div>
              </div>
              <div className="col-6">
                <div>ลงชื่อ ……………………………………… เจ้าหน้าที่/พยาน</div>
                <div className="mt-2">( ……………………………………… )</div>
                <div className="mt-2">วันที่ ………… / ………… / …………</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* พิมพ์: ซ่อนเปลือกระบบ เหลือแต่ฟอร์ม */}
      <style jsx global>{`
        @media print {
          .app-sidebar, .app-header, .app-footer, .d-print-none { display: none !important; }
          .app-main { margin: 0 !important; }
          .card { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function ConsentFormPage() {
  return <Suspense fallback={null}><ConsentFormInner /></Suspense>;
}
