"use client";
// ลูกค้า (HN) — V3 Bootstrap แท้: ค้นหา → โปรไฟล์+แก้ไข · คอร์ส(จ่ายเต็ม) ·
// Timeline ประวัติ (ข้อ 20) · ใบยินยอมย้อนหลังทุกเคส (ข้อ 17) · export CSV
import { useCallback, useEffect, useState, Suspense } from "react";
import { useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import { exportCsv } from "@/lib/exportCsv";
import { HEALTH_ITEMS, ageFromBirth } from "@/lib/healthItems";

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const fmtDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const CC_STATUS_TH = { active: "ใช้งานอยู่", completed: "ครบคอร์ส", expired: "หมดอายุ", cancelled: "ยกเลิก" };

function CustomersInner() {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
    info: (m) => dispatch(pushToast({ type: "info", message: m })),
  };
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [searched, setSearched] = useState(false); // เคยกดค้นหาแล้วหรือยัง (ไว้แสดง empty state)
  const [searching, setSearching] = useState(false);
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
    setSearching(true);
    try {
      const r = await api(`/customers?q=${encodeURIComponent(q)}`);
      setRows(r);
      setSearched(true);
      if (r.length === 0) toast.info("ไม่พบลูกค้า");
    } finally { setSearching(false); }
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

  // สรุปข้อมูลสุขภาพ 9 ข้อจากแบบฟอร์ม (ถ้าเคยกรอก)
  const cust = profile?.customer;
  const health = cust?.health_info || null;
  const healthFlagged = health
    ? HEALTH_ITEMS.filter(({ key }) => health[key]?.has === true).map(({ key, label }) => ({ label, detail: health[key].detail }))
    : [];
  const healthClearCount = health ? HEALTH_ITEMS.filter(({ key }) => health[key]?.has === false).length : 0;
  const age = ageFromBirth(cust?.birth_date);

  const InfoRow = ({ icon, label, children }) => (
    <div className="d-flex gap-2 py-1">
      <span className="text-muted flex-shrink-0" style={{ width: 108 }}><i className={`bi ${icon} me-1`} />{label}</span>
      <span className="text-body">{children}</span>
    </div>
  );

  return (
    <div className="app-content cxz">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center gap-3 mb-3">
          <span className="cx-headico d-inline-flex align-items-center justify-content-center flex-shrink-0">
            <i className="bi bi-people-fill" />
          </span>
          <div>
            <h4 className="fw-bold mb-0">ลูกค้า (HN)</h4>
            <div className="cx-lbl mt-1">โปรไฟล์ · คอร์ส · ประวัติการใช้บริการ</div>
          </div>
        </div>

        {/* ค้นหา */}
        <div className="card shadow-sm mb-3 cx-search-card">
          <div className="card-body py-3">
            <div className="input-group cx-search" style={{ maxWidth: 520 }}>
              <span className="input-group-text bg-body-tertiary"><i className="bi bi-search text-muted" /></span>
              <input className="form-control" value={q} placeholder="HN / ชื่อ / เบอร์โทร"
                     onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="btn btn-primary px-4" disabled={searching} onClick={search}>
                {searching ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-search me-1" />}ค้นหา
              </button>
            </div>

            {!searched && !profile && (
              <div className="text-center text-muted py-4">
                <span className="cx-empty-ico"><i className="bi bi-person-vcard" /></span>
                <div className="small">พิมพ์ HN, ชื่อ, ชื่อเล่น หรือเบอร์โทร แล้วกดค้นหา — เว้นว่างเพื่อดูลูกค้าล่าสุด</div>
              </div>
            )}

            {searched && rows.length === 0 && !profile && (
              <div className="text-center text-muted py-4">
                <span className="cx-empty-ico"><i className="bi bi-search-heart" /></span>
                <div>ไม่พบลูกค้าที่ตรงกับ &ldquo;{q}&rdquo;</div>
                <div className="small mt-1">ลองค้นบางส่วนของชื่อหรือเบอร์ · ลูกค้าใหม่สร้าง HN ได้ที่หน้า ปฏิทิน (รับลูกค้า)</div>
              </div>
            )}

            {rows.length > 0 && !profile && (
              <>
                <div className="text-muted small mt-3 mb-1">พบ {rows.length} ราย{rows.length >= 50 ? " (แสดง 50 รายแรก — พิมพ์ให้เจาะจงขึ้น)" : ""} · กดที่แถวเพื่อเปิดโปรไฟล์</div>
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th className="fw-semibold" style={{ width: 150 }}>HN</th>
                        <th className="fw-semibold">ชื่อ</th>
                        <th className="fw-semibold" style={{ width: 140 }}>เบอร์โทร</th>
                        <th style={{ width: 70 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.HN_number} role="button" onClick={() => open(c.HN_number)}>
                          <td className="font-monospace text-primary">{c.HN_number}</td>
                          <td>{c.full_name} {c.sure_name || ""}{c.nick_name ? <span className="text-muted"> ({c.nick_name})</span> : null}</td>
                          <td>{c.phone || <span className="text-muted">—</span>}</td>
                          <td className="text-end"><button className="btn btn-outline-primary btn-sm" onClick={(e) => { e.stopPropagation(); open(c.HN_number); }}>เปิด</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {profile && rows.length > 0 && (
          <button className="btn btn-link btn-sm px-0 mb-2 text-decoration-none" onClick={() => setProfile(null)}>
            <i className="bi bi-arrow-left me-1" />กลับไปผลค้นหา ({rows.length} ราย)
          </button>
        )}

        {profile && (
          <div className="row g-3">
            <div className="col-lg-7">
              {/* โปรไฟล์ */}
              <div className="card shadow-sm mb-3 cx-hero">
                <div className="cx-hero-head d-flex align-items-center flex-wrap gap-3 px-3 py-3">
                  <span className="cx-avatar flex-shrink-0">
                    {(cust.nick_name || cust.full_name || "?").replace(/^คุณ/, "").trim().charAt(0) || "?"}
                  </span>
                  <div className="me-auto">
                    <div className="fw-bold cx-hero-name">
                      {cust.prefix ? `${cust.prefix} ` : ""}{cust.full_name} {cust.sure_name || ""}
                      {cust.nick_name && <span className="fw-normal cx-hero-nick"> ({cust.nick_name})</span>}
                    </div>
                    <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                      <span className="cx-hn-badge font-monospace">{cust.HN_number}</span>
                      {cust.gender && <span className="cx-hero-meta small">{cust.gender}</span>}
                      {age && <span className="cx-hero-meta small">{age} ปี</span>}
                    </div>
                  </div>
                  <a className="btn cx-hero-btn btn-sm" target="_blank" rel="noreferrer"
                     href={`/app/history-form?hn=${encodeURIComponent(cust.HN_number)}`}>
                    <i className="bi bi-file-earmark-person me-1" />ประวัติผู้ใช้บริการ (PDF)
                  </a>
                  {!editing && <button className="btn cx-hero-btn btn-sm" onClick={startEdit}><i className="bi bi-pencil me-1" />แก้ไข</button>}
                </div>
                <div className="card-body py-3">
                  {!editing ? (
                    <div className="small">
                      <div className="row g-3">
                        {/* กลุ่มติดต่อ */}
                        <div className="col-md-6">
                          <div className="cx-lbl mb-1">การติดต่อ</div>
                          <InfoRow icon="bi-telephone" label="เบอร์โทร">{cust.phone || "—"}</InfoRow>
                          {cust.line_id && <InfoRow icon="bi-chat-dots" label="LINE">{cust.line_id}</InfoRow>}
                          {cust.email && <InfoRow icon="bi-envelope" label="อีเมล">{cust.email}</InfoRow>}
                          {cust.address && <InfoRow icon="bi-geo-alt" label="ที่อยู่">{cust.address}</InfoRow>}
                          {cust.emergency?.name && (
                            <InfoRow icon="bi-person-exclamation" label="ฉุกเฉิน">
                              {cust.emergency.name}{cust.emergency.relation ? ` (${cust.emergency.relation})` : ""}{cust.emergency.phone ? ` · ${cust.emergency.phone}` : ""}
                            </InfoRow>
                          )}
                        </div>
                        {/* กลุ่มความปลอดภัย */}
                        <div className="col-md-6">
                          <div className="cx-lbl mb-1">ข้อควรระวัง</div>
                          <InfoRow icon="bi-capsule" label="แพ้ยา">
                            {cust.drug_allergies?.length
                              ? cust.drug_allergies.map((a) => <span key={a} className="badge text-bg-danger me-1">{a}</span>)
                              : <span className="text-muted">ไม่มี</span>}
                          </InfoRow>
                          <InfoRow icon="bi-heart-pulse" label="โรคประจำตัว">
                            {cust.chronic_diseases?.length ? cust.chronic_diseases.join(", ") : <span className="text-muted">ไม่มี</span>}
                          </InfoRow>
                          {cust.note && <InfoRow icon="bi-sticky" label="หมายเหตุ">{cust.note}</InfoRow>}
                        </div>
                        {/* สรุปแบบฟอร์มสุขภาพ 9 ข้อ */}
                        <div className="col-12">
                          <div className="cx-health rounded-3 p-2 px-3">
                            <div className="d-flex align-items-center flex-wrap gap-2">
                              <span className="cx-lbl">
                                <i className="bi bi-clipboard2-pulse me-1" />ข้อมูลสุขภาพ (แบบฟอร์ม 9 ข้อ)
                              </span>
                              {health ? (
                                <span className="badge bg-body-secondary text-body border ms-auto fw-normal">ตอบแล้ว {healthFlagged.length + healthClearCount}/9 · กรอกเมื่อ {fmtDate(cust.history_date)}</span>
                              ) : (
                                <span className="badge text-bg-warning ms-auto">ยังไม่ได้กรอกแบบฟอร์ม</span>
                              )}
                            </div>
                            {health ? (
                              healthFlagged.length ? (
                                <div className="d-flex flex-wrap gap-1 mt-2">
                                  {healthFlagged.map((it) => (
                                    <span key={it.label} className="badge text-bg-warning fw-normal" title={it.detail}>
                                      {it.label}{it.detail ? `: ${it.detail}` : ""}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-success mt-1"><i className="bi bi-check-circle me-1" />ไม่พบข้อควรระวังจากแบบฟอร์ม (ตอบ &ldquo;ไม่มี&rdquo; ทุกข้อ)</div>
                              )
                            ) : (
                              <div className="text-muted mt-1">ลูกค้าเก่าก่อนมีแบบฟอร์ม — ข้อมูลสุขภาพ 9 ข้อจะถูกบันทึกเมื่อกรอกแบบฟอร์มประวัติผู้ใช้บริการ</div>
                            )}
                          </div>
                        </div>
                      </div>
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
                        <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setEditing(null)}>ยกเลิก</button>
                        <button className="btn btn-primary btn-sm px-4" disabled={busy} onClick={saveEdit}>
                          {busy && <span className="spinner-border spinner-border-sm me-1" />}บันทึก
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* คอร์สที่ถือ + ชำระ */}
              <div className="card shadow-sm mb-3">
                <div className="card-header py-2 fw-semibold d-flex align-items-center gap-2">
                  <span className="cx-ico"><i className="bi bi-grid-3x3-gap" /></span>คอร์สที่ถือ
                </div>
                <div className="card-body p-0 table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th className="fw-semibold">คอร์ส</th><th className="fw-semibold text-center">คงเหลือ</th>
                        <th className="fw-semibold">หมดอายุ</th><th className="fw-semibold text-end">ชำระแล้ว</th>
                        <th className="fw-semibold text-center">สถานะ</th><th style={{ width: 48 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {profile.courses.map((cc) => (
                        <tr key={cc.customer_course_ID}>
                          <td>{cc.course_snapshot?.name}</td>
                          <td className="text-center"><b>{cc.uses_remaining}</b><span className="text-muted">/{cc.uses_total}</span></td>
                          <td className="small">{cc.expires_at ? fmtDate(cc.expires_at) : "—"}</td>
                          <td className="text-end small">
                            {money(cc.paid_amount)}/{money(cc.total_price)}฿
                            {cc.balance_due > 0 && <span className="badge text-bg-warning ms-1">ค้าง {money(cc.balance_due)}฿</span>}
                          </td>
                          <td className="text-center"><span className={`badge text-bg-${{ active: "success", completed: "info", expired: "warning", cancelled: "secondary" }[cc.status] || "light"}`}>{CC_STATUS_TH[cc.status] || cc.status}</span></td>
                          <td className="text-end">
                            {cc.paid_amount > 0 && (
                              <a className="btn btn-outline-secondary btn-sm" title="เปิดใบเสร็จล่าสุดของคอร์สนี้" target="_blank" rel="noreferrer"
                                 href={`/app/receipt?cc=${encodeURIComponent(cc.customer_course_ID)}`} onClick={(e) => e.stopPropagation()}>
                                <i className="bi bi-receipt" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!profile.courses.length && (
                        <tr><td colSpan={6} className="text-center text-muted py-4">
                          <span className="cx-empty-ico cx-empty-sm"><i className="bi bi-bag" /></span>
                          <div>ยังไม่มีคอร์ส — ขายคอร์สได้จากหน้า OPD / หน้าห้อง</div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {profile.courses.some((c) => c.balance_due > 0) && (
                  <div className="card-footer py-2 d-flex gap-2 flex-wrap align-items-end bg-body-tertiary">
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <label className="form-label small mb-1"><i className="bi bi-cash-coin me-1 text-warning" />ชำระค่าคอร์ส (เต็มจำนวน)</label>
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
                    <button className="btn btn-primary btn-sm px-3" disabled={!pay.customer_course_ID || busy} onClick={payFull}>
                      {busy && <span className="spinner-border spinner-border-sm me-1" />}ชำระเต็มจำนวน
                    </button>
                  </div>
                )}
              </div>

              {/* ใบยินยอมย้อนหลัง */}
              <div className="card shadow-sm mb-3">
                <div className="card-header py-2 fw-semibold d-flex align-items-center gap-2">
                  <span className="cx-ico"><i className="bi bi-file-earmark-medical" /></span>ใบยินยอมทั้งหมด
                  <span className="badge cx-count">{consents.length}</span>
                </div>
                <ul className="list-group list-group-flush">
                  {consents.map((c, i) => (
                    <li className="list-group-item py-2 d-flex align-items-center gap-2 small" key={i}>
                      <i className={`bi ${c.kind === "signature" ? "bi-pen" : "bi-file-earmark-check"} text-success`} />
                      <span>{fmtDate(c.date)} · เคส {c.opd_ID}</span>
                      <span className="text-muted">{c.kind === "signature" ? "ลายเซ็นบนจอ" : c.filename || "ไฟล์แนบ"}</span>
                      <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setViewConsent(c)}><i className="bi bi-eye me-1" />ดู</button>
                    </li>
                  ))}
                  {!consents.length && (
                    <li className="list-group-item text-muted small py-4 text-center">
                      <span className="cx-empty-ico cx-empty-sm"><i className="bi bi-file-earmark" /></span>
                      <div>ยังไม่มีใบยินยอม — ลูกค้าเซ็นบนจอได้ในหน้า OPD ก่อนทำหัตถการ</div>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* ขวา: timeline ประวัติ */}
            <div className="col-lg-5">
              <div className="card shadow-sm">
                <div className="card-header py-2 d-flex align-items-center gap-2">
                  <span className="cx-ico"><i className="bi bi-clock-history" /></span>
                  <span className="fw-semibold">Timeline ประวัติ</span>
                  <span className="badge cx-count">{timeline.length}</span>
                  <button className="btn btn-outline-secondary btn-sm ms-auto" disabled={!timeline.length} onClick={exportHistory}><i className="bi bi-download me-1" />CSV</button>
                </div>
                <div className="card-body py-3">
                  <ul className="list-unstyled mb-0">
                    {timeline.map((t, i) => (
                      <li key={t.opd_ID} className="d-flex gap-2 pb-3 position-relative">
                        <span className={`cx-tl-dot d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 ${t.status === "closed" ? "text-bg-success" : "text-bg-warning"}`}
                              style={{ width: 30, height: 30, fontSize: 13, zIndex: 1 }}
                              title={t.status === "closed" ? "ปิดเคสแล้ว" : "เคสยังไม่ปิด"}>
                          <i className={`bi ${t.status === "closed" ? "bi-check2" : "bi-hourglass-split"}`} />
                        </span>
                        {i < timeline.length - 1 && <span className="position-absolute cx-tl-line" style={{ left: 14, top: 32, width: 2, bottom: -4 }} />}
                        <div className="small">
                          <div><b>{fmtDate(t.date)}</b> · เคส {t.opd_ID} · ครั้งที่ {t.session_no}
                            {t.consent > 0 && <span className="badge text-bg-success ms-1" title="มีใบยินยอม">✓ ยินยอม</span>}
                          </div>
                          {t.procs.length > 0 && <div className="text-muted">หัตถการ: {t.procs.join(", ")}</div>}
                          {t.addons.length > 0 && <div className="text-muted">add-on: {t.addons.join(", ")}</div>}
                        </div>
                      </li>
                    ))}
                    {!timeline.length && (
                      <li className="text-muted small text-center py-4">
                        <span className="cx-empty-ico cx-empty-sm"><i className="bi bi-clock-history" /></span>
                        <div>ยังไม่มีประวัติการใช้บริการ</div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ดูไฟล์ consent */}
        {viewConsent && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 2000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setViewConsent(null); }}>
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
                    : <img src={viewConsent.file} alt="consent" style={{ maxWidth: "100%", background: "#fff" }} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* พรีเมียม — scoped ด้วย .cxz เฉพาะหน้านี้ (ธีมกลางไม่เกี่ยว) */}
      <style jsx global>{`
        .cxz { --cx-grad: linear-gradient(135deg, #1560a3, #2a7bc4); }
        /* การ์ด: มุมโค้งสม่ำเสมอ + เงาบางเนียน */
        .cxz .card { border-radius: 14px; border: 1px solid var(--bs-border-color-translucent); overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 35, 60, .05), 0 6px 18px rgba(15, 35, 60, .05); }
        [data-bs-theme="dark"] .cxz .card { box-shadow: 0 1px 2px rgba(0, 0, 0, .35), 0 8px 22px rgba(0, 0, 0, .28); }
        .cxz .card-header { background: transparent; border-bottom: 1px solid var(--bs-border-color-translucent); }
        .cxz .modal-content { border-radius: 14px; overflow: hidden; }

        /* micro-interaction: ปุ่มลื่น + focus ring สีแบรนด์ */
        .cxz .btn { transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease,
          border-color .18s ease, color .18s ease; }
        .cxz .btn:active { transform: scale(.96); }
        .cxz .btn-primary { background-image: var(--cx-grad); border: 0; box-shadow: 0 2px 8px rgba(21, 96, 163, .28); }
        .cxz .btn-primary:hover:not(:disabled) { box-shadow: 0 5px 16px rgba(21, 96, 163, .38); transform: translateY(-1px); }
        .cxz .form-control:focus, .cxz .form-select:focus {
          border-color: #2a7bc4; box-shadow: 0 0 0 .22rem rgba(21, 96, 163, .14); }

        /* หัวหน้าจอ */
        .cxz .cx-headico { width: 42px; height: 42px; border-radius: 13px; background: var(--cx-grad); color: #fff;
          font-size: 19px; box-shadow: 0 4px 12px rgba(21, 96, 163, .32); }
        .cxz .cx-lbl { font-size: 11px; font-weight: 600; letter-spacing: .8px; color: var(--bs-secondary-color); }

        /* hero โปรไฟล์ */
        .cxz .cx-hero-head { background: var(--cx-grad); color: #fff; }
        .cxz .cx-avatar { width: 54px; height: 54px; border-radius: 16px; display: inline-flex; align-items: center;
          justify-content: center; font-size: 24px; font-weight: 700; color: #fff;
          background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .35);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), 0 4px 10px rgba(0, 30, 60, .18); }
        .cxz .cx-hero-name { font-size: 1.1rem; letter-spacing: .2px; }
        .cxz .cx-hero-nick { color: rgba(255, 255, 255, .78); }
        .cxz .cx-hero-meta { color: rgba(255, 255, 255, .82); }
        .cxz .cx-hn-badge { background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .32);
          color: #fff; border-radius: 999px; padding: 1px 10px; font-size: 12px; letter-spacing: .5px; }
        .cxz .cx-hero-btn { --bs-btn-color: #fff; --bs-btn-border-color: rgba(255, 255, 255, .5);
          --bs-btn-hover-color: #fff; --bs-btn-hover-bg: rgba(255, 255, 255, .16); --bs-btn-hover-border-color: #fff;
          --bs-btn-active-color: #fff; --bs-btn-active-bg: rgba(255, 255, 255, .22);
          --bs-btn-active-border-color: #fff; border-width: 1px; }

        /* ไอคอนวงกลม gradient หัวการ์ด + badge จำนวน */
        .cxz .cx-ico { width: 26px; height: 26px; border-radius: 50%; background: var(--cx-grad); color: #fff;
          display: inline-flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(21, 96, 163, .32); }
        .cxz .cx-count { background: color-mix(in srgb, #1560a3 12%, var(--bs-body-bg));
          color: var(--bs-primary-text-emphasis); border: 1px solid color-mix(in srgb, #1560a3 22%, transparent);
          border-radius: 999px; font-weight: 600; }

        /* ชิปสรุปสุขภาพ */
        .cxz .cx-health { background: linear-gradient(135deg, color-mix(in srgb, #1560a3 7%, var(--bs-body-bg)),
          color-mix(in srgb, #1560a3 2%, var(--bs-body-bg))); border: 1px solid color-mix(in srgb, #1560a3 14%, transparent); }

        /* empty state มีบุคลิก */
        .cxz .cx-empty-ico { width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center;
          justify-content: center; font-size: 26px; margin-bottom: .55rem;
          color: #1560a3; background: color-mix(in srgb, #1560a3 9%, var(--bs-body-bg));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, #1560a3 14%, transparent); }
        [data-bs-theme="dark"] .cxz .cx-empty-ico { color: #7cb5e8; }
        .cxz .cx-empty-sm { width: 48px; height: 48px; font-size: 20px; }

        /* ตาราง: หัวเล็ก letter-spacing + ตัวเลข tabular */
        .cxz thead th { letter-spacing: .5px; }
        .cxz .table td { font-variant-numeric: tabular-nums; }
        .cxz .table-hover > tbody > tr:hover > * {
          --bs-table-hover-bg: color-mix(in srgb, #1560a3 6%, var(--bs-body-bg)); }

        /* timeline */
        .cxz .cx-tl-dot { box-shadow: 0 0 0 4px color-mix(in srgb, #1560a3 8%, var(--bs-body-bg)); }
        .cxz .cx-tl-line { background: linear-gradient(var(--bs-border-color), transparent); }
      `}</style>
    </div>
  );
}

export default function CustomersPage() {
  return <Suspense fallback={null}><CustomersInner /></Suspense>;
}
