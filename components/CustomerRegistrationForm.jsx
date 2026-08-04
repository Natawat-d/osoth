"use client";
// ฟอร์ม "ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ" — ตามเอกสาร Beyond Clinic
// ใช้ตอนสร้าง HN ใหม่ (หน้ารับลูกค้า) — กรอกครั้งเดียวต่อ HN รอบหน้ามาคอร์สอื่นใช้ข้อมูลเดิม
// เซ็นชื่อผู้ใช้บริการบนจอ (iPad) ท้ายฟอร์ม
import { useState } from "react";
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
  const [health, setHealth] = useState(() =>
    Object.fromEntries(HEALTH_ITEMS.map(({ key }) => [key, { has: null, detail: "" }])));
  const [signature, setSignature] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setH = (key, patch) => setHealth((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  const unanswered = HEALTH_ITEMS.filter(({ key }) => health[key].has === null).length;
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

  return (
    <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)", overflowY: "auto" }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <b><i className="bi bi-person-plus me-2 text-primary" />ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ — สร้าง HN ใหม่</b>
            <button className="btn-close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <div className="alert alert-light border small py-2 mb-3">
              <i className="bi bi-info-circle me-1 text-primary" />
              กรอกครั้งเดียวต่อ 1 HN — รอบหน้ามาใช้บริการ (แม้คนละคอร์ส) ระบบใช้ข้อมูลชุดนี้เลย ไม่ต้องกรอกใหม่
            </div>

            {/* ข้อมูลส่วนตัว */}
            <h6 className="fw-bold border-bottom pb-1"><i className="bi bi-person me-1" />ข้อมูลส่วนตัว</h6>
            <div className="row g-2 mb-3">
              <div className="col-md-2 col-4">
                <L>คำนำหน้า</L>
                <select className="form-select form-select-sm" value={f.prefix} onChange={set("prefix")}>
                  <option value="">—</option>
                  {PREFIXES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-md-4 col-8"><L>ชื่อ *</L><input className="form-control form-control-sm" value={f.full_name} onChange={set("full_name")} /></div>
              <div className="col-md-4 col-8"><L>นามสกุล</L><input className="form-control form-control-sm" value={f.sure_name} onChange={set("sure_name")} /></div>
              <div className="col-md-2 col-4"><L>ชื่อเล่น</L><input className="form-control form-control-sm" value={f.nick_name} onChange={set("nick_name")} /></div>
              <div className="col-md-5 col-7"><L>เลขบัตรประชาชน / หนังสือเดินทาง</L><input className="form-control form-control-sm" value={f.id_card} onChange={set("id_card")} /></div>
              <div className="col-md-3 col-5"><L>สัญชาติ</L><input className="form-control form-control-sm" value={f.nationality} onChange={set("nationality")} /></div>
              <div className="col-md-2 col-6"><L>วันเกิด</L><input type="date" className="form-control form-control-sm" value={f.birth_date} onChange={set("birth_date")} /></div>
              <div className="col-md-2 col-6">
                <L>เพศ</L>
                <select className="form-select form-select-sm" value={f.gender} onChange={set("gender")}>
                  <option value="">—</option><option value="หญิง">หญิง</option><option value="ชาย">ชาย</option><option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div className="col-12"><L>ที่อยู่ปัจจุบัน</L><textarea rows={2} className="form-control form-control-sm" value={f.address} onChange={set("address")} /></div>
            </div>

            {/* ติดต่อ */}
            <h6 className="fw-bold border-bottom pb-1"><i className="bi bi-telephone me-1" />การติดต่อ</h6>
            <div className="row g-2 mb-3">
              <div className="col-md-4 col-6"><L>เบอร์ติดต่อ</L><input className="form-control form-control-sm" value={f.phone} onChange={set("phone")} /></div>
              <div className="col-md-4 col-6"><L>ID LINE</L><input className="form-control form-control-sm" value={f.line_id} onChange={set("line_id")} /></div>
              <div className="col-md-4 col-12"><L>อีเมล</L><input className="form-control form-control-sm" value={f.email} onChange={set("email")} /></div>
              <div className="col-md-5 col-12"><L>ผู้ติดต่อกรณีฉุกเฉิน (ชื่อ)</L><input className="form-control form-control-sm" value={f.emg_name} onChange={set("emg_name")} /></div>
              <div className="col-md-3 col-6"><L>เกี่ยวข้องเป็น</L><input className="form-control form-control-sm" value={f.emg_relation} onChange={set("emg_relation")} /></div>
              <div className="col-md-4 col-6"><L>เบอร์ฉุกเฉิน</L><input className="form-control form-control-sm" value={f.emg_phone} onChange={set("emg_phone")} /></div>
            </div>

            {/* ข้อมูลสุขภาพ 9 ข้อ */}
            <h6 className="fw-bold border-bottom pb-1"><i className="bi bi-heart-pulse me-1" />ข้อมูลสุขภาพ <span className="text-muted fw-normal small">กรุณากรอกตามความเป็นจริง</span></h6>
            <div className="mb-3">
              {HEALTH_ITEMS.map(({ key, label }, i) => {
                const h = health[key];
                return (
                  <div className="d-flex align-items-center gap-2 py-1 border-bottom flex-wrap" key={key} style={{ borderStyle: "dashed" }}>
                    <span className="small" style={{ minWidth: 250 }}>{i + 1}. {label}</span>
                    <div className="btn-group btn-group-sm" role="group">
                      <button type="button" className={`btn ${h.has === false ? "btn-success" : "btn-outline-secondary"}`}
                              onClick={() => setH(key, { has: false, detail: "" })}>ไม่มี</button>
                      <button type="button" className={`btn ${h.has === true ? "btn-warning" : "btn-outline-secondary"}`}
                              onClick={() => setH(key, { has: true })}>มี</button>
                    </div>
                    {h.has === true && (
                      <input className="form-control form-control-sm" style={{ flex: 1, minWidth: 160 }} placeholder="ระบุ…"
                             value={h.detail} onChange={(e) => setH(key, { detail: e.target.value })} />
                    )}
                  </div>
                );
              })}
              {unanswered > 0 && <div className="text-warning small mt-1"><i className="bi bi-exclamation-triangle me-1" />ยังไม่ได้ตอบ {unanswered} ข้อ</div>}
            </div>

            {/* คำยืนยัน + ลายเซ็น */}
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
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setSignature("")}>เซ็นใหม่</button>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 480 }}>
                  <div className="text-muted small mb-1"><i className="bi bi-pen me-1" />ให้ลูกค้าเซ็นชื่อ (ผู้ใช้บริการ) ในกรอบ แล้วกด "ใช้ลายเซ็นนี้"</div>
                  <SignaturePad height={140} onConfirm={setSignature} />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer py-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>ยกเลิก</button>
            <button className="btn btn-primary px-4" disabled={!canSubmit} onClick={submit}>
              {busy && <span className="spinner-border spinner-border-sm me-1" />}
              สร้าง HN + เปิดเคส →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
