"use client";
// ฟอร์ม "ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ" — ตามเอกสาร Beyond Clinic
// ใช้ตอนสร้าง HN ใหม่ (หน้ารับลูกค้า) — กรอกครั้งเดียวต่อ HN รอบหน้ามาคอร์สอื่นใช้ข้อมูลเดิม
// เซ็นชื่อผู้ใช้บริการบนจอ (iPad) ท้ายฟอร์ม
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SignaturePad from "@/components/SignaturePad";
import { HEALTH_ITEMS, PREFIXES } from "@/lib/healthItems";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const EMPTY = {
  prefix: "", full_name: "", sure_name: "", nick_name: "",
  id_card: "", nationality: "ไทย", birth_date: "", gender: "",
  address: "", email: "", line_id: "", phone: "",
  emg_name: "", emg_relation: "", emg_phone: "",
};

export default function CustomerRegistrationForm({ initial = {}, busy = false, onSubmit, onCancel }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  // portal ไป body: กัน stacking context ของหน้าแม่ (เช่น sticky panel) กดโมดัลจมใต้ sidebar
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [health, setHealth] = useState(() =>
    Object.fromEntries(HEALTH_ITEMS.map(({ key }) => [key, { has: null, detail: "" }])));
  const [signature, setSignature] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setH = (key, patch) => setHealth((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  const unanswered = HEALTH_ITEMS.filter(({ key }) => health[key].has === null).length;
  const answered = HEALTH_ITEMS.length - unanswered;
  const canSubmit = f.full_name.trim() && !busy;

  const submit = () => {
    const allergyDetail = health.allergy?.has ? health.allergy.detail : "";
    const chronicDetail = health.chronic?.has ? health.chronic.detail : "";
    onSubmit({
      prefix: f.prefix, full_name: f.full_name.trim(), sure_name: f.sure_name.trim(), nick_name: f.nick_name.trim(),
      id_card: f.id_card.trim(), nationality: f.nationality.trim(), birth_date: f.birth_date, gender: f.gender,
      address: f.address.trim(), email: f.email.trim(), line_id: f.line_id.trim(), phone: f.phone.trim(),
      emergency: { name: f.emg_name.trim(), relation: f.emg_relation.trim(), phone: f.emg_phone.trim() },
      health_info: health,
      history_signature: signature,
      history_date: todayStr(),
      // sync ช่องเดิมที่ระบบใช้เตือนใน OPD
      drug_allergies: allergyDetail ? allergyDetail.split(",").map((s) => s.trim()).filter(Boolean) : [],
      chronic_diseases: chronicDetail ? chronicDetail.split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
  };

  const L = ({ children }) => <label className="form-label small mb-1 text-muted">{children}</label>;
  const Section = ({ no, icon, title, right }) => (
    <div className="d-flex align-items-center gap-2 border-bottom pb-2 mb-2 mt-1">
      <span className="d-inline-flex align-items-center justify-content-center rounded-circle text-bg-primary flex-shrink-0 fw-bold" style={{ width: 26, height: 26, fontSize: 13 }}>{no}</span>
      <h6 className="fw-bold mb-0"><i className={`bi ${icon} me-1 text-primary`} />{title}</h6>
      {right && <span className="ms-auto">{right}</span>}
    </div>
  );

  if (!mounted) return null;
  return createPortal(
    // zIndex 2000: ให้ลอยเหนือ sidebar/topbar ของ AdminLTE (modal ปกติ 1055 แพ้ sidebar)
    <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)", overflowY: "auto", zIndex: 2000 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2 gap-2">
            <b><i className="bi bi-person-plus me-2 text-primary" />ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ — สร้าง HN ใหม่</b>
            <span className={`badge ms-auto ${unanswered ? "text-bg-warning" : "text-bg-success"}`}>
              สุขภาพ {answered}/{HEALTH_ITEMS.length}
            </span>
            <span className={`badge ${signature ? "text-bg-success" : "bg-body-secondary text-body border"}`}>
              {signature ? "เซ็นแล้ว ✓" : "ยังไม่เซ็น"}
            </span>
            <button className="btn-close ms-0" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <div className="alert alert-light border small py-2 mb-3">
              <i className="bi bi-info-circle me-1 text-primary" />
              กรอกครั้งเดียวต่อ 1 HN — รอบหน้ามาใช้บริการ (แม้คนละคอร์ส) ระบบใช้ข้อมูลชุดนี้เลย ไม่ต้องกรอกใหม่
            </div>

            {/* ข้อมูลส่วนตัว */}
            <Section no={1} icon="bi-person" title="ข้อมูลส่วนตัว" />
            <div className="row g-2 mb-4">
              <div className="col-md-2 col-4">
                <L>คำนำหน้า</L>
                <select className="form-select" value={f.prefix} onChange={set("prefix")}>
                  <option value="">—</option>
                  {PREFIXES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-md-4 col-8"><L>ชื่อ *</L><input className="form-control" value={f.full_name} onChange={set("full_name")} /></div>
              <div className="col-md-4 col-8"><L>นามสกุล</L><input className="form-control" value={f.sure_name} onChange={set("sure_name")} /></div>
              <div className="col-md-2 col-4"><L>ชื่อเล่น</L><input className="form-control" value={f.nick_name} onChange={set("nick_name")} /></div>
              <div className="col-md-4 col-7"><L>เลขบัตรประชาชน / หนังสือเดินทาง</L><input className="form-control" inputMode="numeric" value={f.id_card} onChange={set("id_card")} /></div>
              <div className="col-md-3 col-5"><L>สัญชาติ</L><input className="form-control" value={f.nationality} onChange={set("nationality")} /></div>
              <div className="col-md-3 col-6"><L>วันเกิด</L><input type="date" className="form-control" value={f.birth_date} onChange={set("birth_date")} /></div>
              <div className="col-md-2 col-6">
                <L>เพศ</L>
                <select className="form-select" value={f.gender} onChange={set("gender")}>
                  <option value="">—</option><option value="หญิง">หญิง</option><option value="ชาย">ชาย</option><option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div className="col-12"><L>ที่อยู่ปัจจุบัน</L><textarea rows={2} className="form-control" value={f.address} onChange={set("address")} /></div>
            </div>

            {/* ติดต่อ */}
            <Section no={2} icon="bi-telephone" title="การติดต่อ" />
            <div className="row g-2 mb-4">
              <div className="col-md-4 col-6"><L>เบอร์ติดต่อ</L><input className="form-control" inputMode="tel" value={f.phone} onChange={set("phone")} /></div>
              <div className="col-md-4 col-6"><L>ID LINE</L><input className="form-control" value={f.line_id} onChange={set("line_id")} /></div>
              <div className="col-md-4 col-12"><L>อีเมล</L><input className="form-control" inputMode="email" value={f.email} onChange={set("email")} /></div>
              <div className="col-md-5 col-12"><L>ผู้ติดต่อกรณีฉุกเฉิน (ชื่อ)</L><input className="form-control" value={f.emg_name} onChange={set("emg_name")} /></div>
              <div className="col-md-3 col-6"><L>เกี่ยวข้องเป็น</L><input className="form-control" value={f.emg_relation} onChange={set("emg_relation")} /></div>
              <div className="col-md-4 col-6"><L>เบอร์ฉุกเฉิน</L><input className="form-control" inputMode="tel" value={f.emg_phone} onChange={set("emg_phone")} /></div>
            </div>

            {/* ข้อมูลสุขภาพ 9 ข้อ */}
            <Section no={3} icon="bi-heart-pulse" title="ข้อมูลสุขภาพ"
                     right={<span className={`badge ${unanswered ? "text-bg-warning" : "text-bg-success"}`}>{unanswered ? `ตอบแล้ว ${answered}/${HEALTH_ITEMS.length}` : `ครบ ${HEALTH_ITEMS.length} ข้อ ✓`}</span>} />
            <div className="text-muted small mb-2">สอบถามลูกค้าทีละข้อ แล้วแตะ &ldquo;ไม่มี&rdquo; หรือ &ldquo;มี&rdquo; — กรุณากรอกตามความเป็นจริง</div>
            <div className="mb-4">
              {HEALTH_ITEMS.map(({ key, label }, i) => {
                const h = health[key];
                return (
                  <div className={`d-flex align-items-center gap-2 py-2 border-bottom flex-wrap rounded-1 ${h.has === null ? "" : "bg-body-tertiary"}`}
                       key={key} style={{ borderBottomStyle: "dashed", minHeight: 54, paddingLeft: 6, paddingRight: 6 }}>
                    <span className="me-auto" style={{ minWidth: 250, flex: "1 1 250px" }}>
                      <span className="text-muted me-1">{i + 1}.</span>{label}
                    </span>
                    <div className="btn-group" role="group" aria-label={label}>
                      {/* ปุ่มใหญ่กว่าปกติ: ใช้นิ้วแตะบน iPad */}
                      <button type="button" className={`btn px-4 py-2 fw-semibold ${h.has === false ? "btn-success" : "btn-outline-secondary"}`}
                              style={{ minWidth: 96 }} onClick={() => setH(key, { has: false, detail: "" })}>
                        {h.has === false && <i className="bi bi-check-lg me-1" />}ไม่มี
                      </button>
                      <button type="button" className={`btn px-4 py-2 fw-semibold ${h.has === true ? "btn-warning" : "btn-outline-secondary"}`}
                              style={{ minWidth: 96 }} onClick={() => setH(key, { has: true })}>
                        {h.has === true && <i className="bi bi-exclamation-lg me-1" />}มี
                      </button>
                    </div>
                    {h.has === true && (
                      <input className="form-control" style={{ flex: "1 1 200px", minWidth: 180 }} placeholder="ระบุรายละเอียด…" autoFocus
                             value={h.detail} onChange={(e) => setH(key, { detail: e.target.value })} />
                    )}
                  </div>
                );
              })}
              {unanswered > 0 && (
                <div className="text-warning small mt-2"><i className="bi bi-exclamation-triangle me-1" />ยังไม่ได้ตอบ {unanswered} ข้อ — สอบถามลูกค้าให้ครบก่อนสร้าง HN</div>
              )}
            </div>

            {/* คำยืนยัน + ลายเซ็น */}
            <Section no={4} icon="bi-pen" title="คำยืนยัน + ลายเซ็นผู้ใช้บริการ"
                     right={signature ? <span className="badge text-bg-success">เซ็นแล้ว ✓</span> : null} />
            <div className="border rounded-3 p-3 bg-body-tertiary">
              <div className="small mb-2">
                ผู้ใช้บริการขอยืนยันว่าข้อมูลทั้งหมดเป็นความจริง หากมีการปกปิดหรือให้ข้อมูลเท็จ ข้าพเจ้ารับผิดชอบต่อความเสียหายทั้งหมดแต่เพียงผู้เดียว
                และยินยอมเปิดเผยข้อมูลข้างต้นแก่ผู้ให้บริการ คลินิก และแพทย์
              </div>
              {signature ? (
                <div className="d-flex align-items-center gap-3">
                  <img src={signature} alt="ลายเซ็น" style={{ height: 70, background: "#fff", border: "1px solid #dee2e6", borderRadius: 6 }} />
                  <div className="small">
                    <div className="text-success"><i className="bi bi-check-circle me-1" />ลูกค้าเซ็นแล้ว</div>
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setSignature("")}><i className="bi bi-arrow-counterclockwise me-1" />เซ็นใหม่</button>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 480 }}>
                  <div className="text-muted small mb-1"><i className="bi bi-pen me-1" />ยื่น iPad ให้ลูกค้าเซ็นชื่อ (ผู้ใช้บริการ) ในกรอบ แล้วกด &ldquo;ใช้ลายเซ็นนี้&rdquo;</div>
                  <SignaturePad height={140} onConfirm={setSignature} />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer py-2">
            {!f.full_name.trim() && <span className="text-muted small me-auto"><i className="bi bi-info-circle me-1" />กรอกอย่างน้อย &ldquo;ชื่อ&rdquo; จึงจะสร้าง HN ได้</span>}
            <button className="btn btn-outline-secondary" onClick={onCancel}>ยกเลิก</button>
            <button className="btn btn-primary px-4" disabled={!canSubmit} onClick={submit}>
              {busy && <span className="spinner-border spinner-border-sm me-1" />}
              สร้าง HN + เปิดเคส →
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
