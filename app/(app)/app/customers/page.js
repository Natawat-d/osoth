"use client";
// ลูกค้า (HN) — V3 Bootstrap แท้: ค้นหา → โปรไฟล์+แก้ไข · คอร์ส(จ่ายเต็ม) ·
// Timeline ประวัติ (ข้อ 20) · ใบยินยอมย้อนหลังทุกเคส (ข้อ 17) · export CSV
import { useCallback, useEffect, useState, Suspense } from "react";
import { useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import { exportCsv } from "@/lib/exportCsv";

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const fmtDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

function CustomersInner() {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
    info: (m) => dispatch(pushToast({ type: "info", message: m })),
  };
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [profile, setProfile] = useState(null);
  const [consents, setConsents] = useState([]);
  const [viewConsent, setViewConsent] = useState(null);
  const [pay, setPay] = useState({ customer_course_ID: "", method: "cash" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (hn) => {
    setProfile(await api(`/customers/${hn}`));
    setEditing(null);
    api(`/customers/${hn}/consents`).then(setConsents).catch(() => setConsents([]));
  }, []);

  useEffect(() => {
    const hn = new URLSearchParams(window.location.search).get("hn");
    if (hn) open(hn);
  }, [open]);

  const search = async () => {
    setProfile(null);
    const r = await api(`/customers?q=${encodeURIComponent(q)}`);
    setRows(r);
    if (r.length === 0) toast.info("ไม่พบลูกค้า");
  };

  const payFull = async () => {
    const cc = profile.courses.find((c) => c.customer_course_ID === pay.customer_course_ID);
    if (!cc) return;
    setBusy(true);
    try {
      await api(`/customer-courses/${pay.customer_course_ID}/pay`, { method: "POST", body: { amount: cc.balance_due, method: pay.method } });
      toast.success("รับชำระเต็มจำนวนแล้ว");
      setPay({ customer_course_ID: "", method: "cash" });
      open(profile.customer.HN_number);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const startEdit = () => {
    const c = profile.customer;
    setEditing({
      full_name: c.full_name || "", sure_name: c.sure_name || "", nick_name: c.nick_name || "",
      phone: c.phone || "", drug_allergies: (c.drug_allergies || []).join(", "),
      chronic_diseases: (c.chronic_diseases || []).join(", "), note: c.note || "",
    });
  };
  const saveEdit = async () => {
    setBusy(true);
    try {
      await api(`/customers/${profile.customer.HN_number}`, {
        method: "PUT",
        body: {
          ...editing,
          drug_allergies: editing.drug_allergies ? editing.drug_allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
          chronic_diseases: editing.chronic_diseases ? editing.chronic_diseases.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      });
      toast.success("บันทึกข้อมูลลูกค้าแล้ว");
      open(profile.customer.HN_number);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const exportHistory = () => {
    exportCsv(`ประวัติ_${profile.customer.HN_number}`, [
      { label: "วันที่", value: (o) => fmtDate(o.date) },
      { label: "เคส", key: "opd_ID" }, { label: "ครั้งที่", key: "session_no" },
      { label: "สถานะ", key: "status" },
      { label: "หัตถการ", value: (o) => (o.procedures_done || []).map((p) => p.name).join("; ") },
      { label: "add-on", value: (o) => (o.add_ons || []).map((a) => a.name).join("; ") },
    ], profile.history);
  };

  // timeline จากประวัติเคส (ใหม่→เก่า)
  const timeline = (profile?.history || []).map((o) => ({
    date: o.date, opd_ID: o.opd_ID, session_no: o.session_no, status: o.status,
    procs: (o.procedures_done || []).map((p) => p.name),
    addons: (o.add_ons || []).map((a) => a.name),
    consent: consents.filter((c) => c.opd_ID === o.opd_ID).length,
  }));

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3">
          <h4 className="fw-bold mb-0">ลูกค้า (HN)</h4>
        </div>

        {/* ค้นหา */}
        <div className="card shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="input-group" style={{ maxWidth: 520 }}>
              <input className="form-control" value={q} placeholder="HN / ชื่อ / เบอร์โทร"
                     onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="btn btn-primary" onClick={search}><i className="bi bi-search me-1" />ค้นหา</button>
            </div>
            {rows.length > 0 && !profile && (
              <table className="table table-sm table-hover mt-3 mb-0">
                <thead className="table-light"><tr><th>HN</th><th>ชื่อ</th><th>เบอร์</th><th /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.HN_number}>
                      <td className="font-monospace">{c.HN_number}</td>
                      <td>{c.full_name} ({c.nick_name})</td>
                      <td>{c.phone}</td>
                      <td className="text-end"><button className="btn btn-outline-primary btn-sm" onClick={() => open(c.HN_number)}>เปิด</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {profile && (
          <div className="row g-3">
            <div className="col-lg-7">
              {/* โปรไฟล์ */}
              <div className="card shadow-sm mb-3">
                <div className="card-header py-2 d-flex align-items-center">
                  <b>{profile.customer.HN_number} — {profile.customer.full_name} {profile.customer.sure_name}</b>
                  <a className="btn btn-outline-primary btn-sm ms-auto" target="_blank" rel="noreferrer"
                     href={`/app/history-form?hn=${encodeURIComponent(profile.customer.HN_number)}`}>
                    <i className="bi bi-file-earmark-person me-1" />ประวัติผู้ใช้บริการ (PDF)
                  </a>
                  {!editing && <button className="btn btn-outline-secondary btn-sm ms-2" onClick={startEdit}><i className="bi bi-pencil me-1" />แก้ไข</button>}
                </div>
                <div className="card-body py-3">
                  {!editing ? (
                    <div className="small">
                      <div className="mb-1"><span className="text-muted">เบอร์:</span> {profile.customer.phone || "—"}</div>
                      <div className="mb-1">
                        <span className="text-muted">แพ้ยา:</span>{" "}
                        {profile.customer.drug_allergies?.length
                          ? <span className="badge text-bg-danger">{profile.customer.drug_allergies.join(", ")}</span>
                          : "—"}
                      </div>
                      <div className="mb-1"><span className="text-muted">โรคประจำตัว:</span> {profile.customer.chronic_diseases?.join(", ") || "—"}</div>
                      {profile.customer.note && <div><span className="text-muted">หมายเหตุ:</span> {profile.customer.note}</div>}
                    </div>
                  ) : (
                    <>
                      <div className="row g-2">
                        {[["full_name", "ชื่อ"], ["sure_name", "นามสกุล"], ["nick_name", "ชื่อเล่น"], ["phone", "เบอร์โทร"]].map(([k, lb]) => (
                          <div className="col-md-3 col-6" key={k}>
                            <label className="form-label small mb-1">{lb}</label>
                            <input className="form-control form-control-sm" value={editing[k]} onChange={(e) => setEditing((s) => ({ ...s, [k]: e.target.value }))} />
                          </div>
                        ))}
                        <div className="col-md-6">
                          <label className="form-label small mb-1">แพ้ยา (คั่นด้วย ,)</label>
                          <input className="form-control form-control-sm" value={editing.drug_allergies} onChange={(e) => setEditing((s) => ({ ...s, drug_allergies: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small mb-1">โรคประจำตัว (คั่นด้วย ,)</label>
                          <input className="form-control form-control-sm" value={editing.chronic_diseases} onChange={(e) => setEditing((s) => ({ ...s, chronic_diseases: e.target.value }))} />
                        </div>
                        <div className="col-12">
                          <label className="form-label small mb-1">หมายเหตุ</label>
                          <input className="form-control form-control-sm" value={editing.note} onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))} />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveEdit}>
                          {busy && <span className="spinner-border spinner-border-sm me-1" />}บันทึก
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(null)}>ยกเลิก</button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* คอร์สที่ถือ + ชำระ */}
              <div className="card shadow-sm mb-3">
                <div className="card-header py-2 fw-semibold"><i className="bi bi-grid-3x3-gap me-1 text-primary" />คอร์สที่ถือ</div>
                <div className="card-body p-0">
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-light"><tr><th>คอร์ส</th><th className="text-center">เหลือ</th><th>หมดอายุ</th><th className="text-end">ชำระ</th><th /></tr></thead>
                    <tbody>
                      {profile.courses.map((cc) => (
                        <tr key={cc.customer_course_ID}>
                          <td>{cc.course_snapshot?.name}</td>
                          <td className="text-center">{cc.uses_remaining}/{cc.uses_total}</td>
                          <td className="small">{cc.expires_at ? fmtDate(cc.expires_at) : "—"}</td>
                          <td className="text-end small">
                            {money(cc.paid_amount)}/{money(cc.total_price)}฿
                            {cc.balance_due > 0 && <span className="badge text-bg-warning ms-1">ค้าง {money(cc.balance_due)}</span>}
                          </td>
                          <td><span className={`badge text-bg-${{ active: "success", completed: "info", expired: "warning", cancelled: "secondary" }[cc.status] || "light"}`}>{cc.status}</span></td>
                        </tr>
                      ))}
                      {!profile.courses.length && <tr><td colSpan={5} className="text-center text-muted py-3">— ไม่มีคอร์ส —</td></tr>}
                    </tbody>
                  </table>
                </div>
                {profile.courses.some((c) => c.balance_due > 0) && (
                  <div className="card-footer py-2 d-flex gap-2 flex-wrap align-items-end">
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <label className="form-label small mb-1">ชำระค่าคอร์ส (เต็มจำนวน)</label>
                      <select className="form-select form-select-sm" value={pay.customer_course_ID} onChange={(e) => setPay((p) => ({ ...p, customer_course_ID: e.target.value }))}>
                        <option value="">— เลือกคอร์สที่ค้าง —</option>
                        {profile.courses.filter((c) => c.balance_due > 0).map((c) => (
                          <option key={c.customer_course_ID} value={c.customer_course_ID}>{c.course_snapshot?.name} (ค้าง {money(c.balance_due)}฿)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label small mb-1">ช่องทาง</label>
                      <select className="form-select form-select-sm" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))}>
                        <option value="cash">เงินสด</option><option value="transfer">โอน</option><option value="card">บัตร</option>
                      </select>
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={!pay.customer_course_ID || busy} onClick={payFull}>ชำระเต็มจำนวน</button>
                  </div>
                )}
              </div>

              {/* ใบยินยอมย้อนหลัง */}
              <div className="card shadow-sm mb-3">
                <div className="card-header py-2 fw-semibold">
                  <i className="bi bi-file-earmark-medical me-1 text-primary" />ใบยินยอมทั้งหมด ({consents.length})
                </div>
                <ul className="list-group list-group-flush">
                  {consents.map((c, i) => (
                    <li className="list-group-item py-2 d-flex align-items-center gap-2 small" key={i}>
                      <i className={`bi ${c.kind === "signature" ? "bi-pen" : "bi-file-earmark-check"} text-success`} />
                      <span>{fmtDate(c.date)} · เคส {c.opd_ID}</span>
                      <span className="text-muted">{c.kind === "signature" ? "ลายเซ็นบนจอ" : c.filename || "ไฟล์แนบ"}</span>
                      <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setViewConsent(c)}>ดู</button>
                    </li>
                  ))}
                  {!consents.length && <li className="list-group-item text-muted small py-3 text-center">— ยังไม่มีใบยินยอม —</li>}
                </ul>
              </div>
            </div>

            {/* ขวา: timeline ประวัติ */}
            <div className="col-lg-5">
              <div className="card shadow-sm">
                <div className="card-header py-2 d-flex align-items-center">
                  <span className="fw-semibold"><i className="bi bi-clock-history me-1 text-primary" />Timeline ประวัติ</span>
                  <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={exportHistory}><i className="bi bi-download me-1" />CSV</button>
                </div>
                <div className="card-body py-3">
                  <ul className="list-unstyled mb-0">
                    {timeline.map((t, i) => (
                      <li key={t.opd_ID} className="d-flex gap-2 pb-3 position-relative">
                        <span className={`d-inline-flex align-items-center justify-content-center rounded-circle ${t.status === "closed" ? "text-bg-success" : "text-bg-warning"}`}
                              style={{ width: 30, height: 30, fontSize: 13, zIndex: 1 }}>
                          <i className={`bi ${t.status === "closed" ? "bi-check2" : "bi-hourglass-split"}`} />
                        </span>
                        {i < timeline.length - 1 && <span className="position-absolute bg-secondary-subtle" style={{ left: 14, top: 30, width: 2, bottom: -6 }} />}
                        <div className="small">
                          <div><b>{fmtDate(t.date)}</b> · เคส {t.opd_ID} · ครั้งที่ {t.session_no}
                            {t.consent > 0 && <span className="badge text-bg-success ms-1" title="มีใบยินยอม">✓ ยินยอม</span>}
                          </div>
                          {t.procs.length > 0 && <div className="text-muted">หัตถการ: {t.procs.join(", ")}</div>}
                          {t.addons.length > 0 && <div className="text-muted">add-on: {t.addons.join(", ")}</div>}
                        </div>
                      </li>
                    ))}
                    {!timeline.length && <li className="text-muted small text-center py-3">— ยังไม่มีประวัติ —</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ดูไฟล์ consent */}
        {viewConsent && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setViewConsent(null); }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <b>{viewConsent.filename || "ใบยินยอม"} · {fmtDate(viewConsent.date)}</b>
                  <a className="btn btn-outline-primary btn-sm ms-auto me-2" href={viewConsent.file} download={viewConsent.filename || "consent"}>
                    <i className="bi bi-download me-1" />ดาวน์โหลด
                  </a>
                  <button className="btn-close" onClick={() => setViewConsent(null)} />
                </div>
                <div className="modal-body text-center" style={{ maxHeight: "75vh", overflow: "auto" }}>
                  {viewConsent.mime === "application/pdf"
                    ? <iframe src={viewConsent.file} title="consent" style={{ width: "100%", height: "70vh", border: 0 }} />
                    : <img src={viewConsent.file} alt="consent" style={{ maxWidth: "100%" }} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return <Suspense fallback={null}><CustomersInner /></Suspense>;
}
