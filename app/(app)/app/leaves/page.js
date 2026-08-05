"use client";
// ลางาน — V3 Bootstrap แท้ (ref info-box + inbox): ยื่นลา + คำขอของฉัน · admin อนุมัติ/ขาดงาน/KPI
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import InfoBox from "@/components/InfoBox";

const TYPE_TH = { personal: ["ลากิจ", "info"], sick: ["ลาป่วย", "danger"] };
const STATUS_TH = { pending: ["รออนุมัติ", "warning"], approved: ["อนุมัติแล้ว", "success"], rejected: ["ไม่อนุมัติ", "danger"] };
const fmtD = (d) => (d ? String(d).split("-").reverse().join("/") : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

export default function LeavesPage() {
  const auth = useSelector((s) => s.auth);
  const isManager = ["super_admin", "admin"].includes(auth.user?.role);
  const [tab, setTab] = useState("mine");

  return (
    <div className="app-content">
      <div className="container-fluid pt-3 lv-prem">
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0 prem-title">ลางาน</h4>
          {isManager && (
            <ul className="nav nav-pills ms-auto">
              {[["mine", "ของฉัน"], ["pending", "รออนุมัติ"], ["absence", "ขาดงานรายวัน"], ["kpi", "สรุปการลา"]].map(([k, l]) => (
                <li className="nav-item" key={k}>
                  <button className={`nav-link py-1 ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {tab === "mine" && <MyLeaves auth={auth} />}
        {tab === "pending" && isManager && <PendingApprovals auth={auth} />}
        {tab === "absence" && isManager && <DailyAbsence auth={auth} />}
        {tab === "kpi" && isManager && <LeaveSummary auth={auth} />}
      </div>
      <style jsx global>{`
        .lv-prem { --lv-grad: linear-gradient(135deg, #1560a3, #2a7bc4); }
        .lv-prem .prem-title { letter-spacing: 0.01em; position: relative; padding-bottom: 7px; }
        .lv-prem .prem-title::after {
          content: ""; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px;
          border-radius: 2px; background: var(--lv-grad);
        }
        .lv-prem .nav-pills .nav-link {
          border-radius: 999px; padding-inline: 1rem;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .lv-prem .nav-pills .nav-link:not(.active):hover { background: var(--bs-tertiary-bg); }
        .lv-prem .nav-pills .nav-link.active { background: var(--lv-grad); box-shadow: 0 4px 14px rgba(21, 96, 163, 0.32); }
        .lv-prem .card.shadow-sm { border-color: var(--bs-border-color); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06) !important; }
        .lv-prem .table { font-variant-numeric: tabular-nums; }
        .lv-prem thead th { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.02em; color: var(--bs-secondary-color); }
        .lv-prem .btn-primary {
          background: var(--lv-grad); border-color: #1560a3;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .lv-prem .btn-primary:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 5px 14px rgba(21, 96, 163, 0.32); }
        .lv-prem .btn:active { transform: scale(0.97); }
        /* แถวคำขอ — เส้น accent ซ้ายตามสถานะ + hover เนียน */
        .lv-prem .lv-item { border-left: 3px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
        .lv-prem .lv-item:hover { background: var(--bs-tertiary-bg); }
        .lv-prem .lv-empty i { font-size: 2.6rem; opacity: 0.35; }
        .lv-prem .form-control:focus, .lv-prem .form-select:focus {
          border-color: #2a7bc4; box-shadow: 0 0 0 0.18rem rgba(21, 96, 163, 0.15);
        }
      `}</style>
    </div>
  );
}

function MyLeaves({ auth }) {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [config, setConfig] = useState({ sick_cert_threshold_days: 2 });
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "personal", date_from: todayStr(), date_to: todayStr(), reason: "", medical_cert: "" });

  const load = useCallback(() => { api("/leaves").then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); api("/config").then(setConfig).catch(() => {}); }, [load]);

  const days = daysBetween(form.date_from, form.date_to);
  const threshold = config.sick_cert_threshold_days ?? 2;
  const certRequired = form.type === "sick" && days > threshold;

  const year = todayStr().slice(0, 4);
  const stat = useMemo(() => ({
    pending: rows.filter((r) => r.status === "pending").length,
    usedDays: rows.filter((r) => r.status === "approved" && r.date_from?.startsWith(year)).reduce((s, r) => s + (r.days || 0), 0),
    sick: rows.filter((r) => r.type === "sick" && r.status === "approved" && r.date_from?.startsWith(year)).reduce((s, r) => s + (r.days || 0), 0),
    personal: rows.filter((r) => r.type === "personal" && r.status === "approved" && r.date_from?.startsWith(year)).reduce((s, r) => s + (r.days || 0), 0),
  }), [rows, year]);

  const pickCert = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("ไฟล์ต้องไม่เกิน 3MB");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, medical_cert: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api("/leaves", { method: "POST", body: { ...form, branch_ID: auth.branch_ID } });
      toast.success("ส่งคำขอลาแล้ว");
      setForm({ type: "personal", date_from: todayStr(), date_to: todayStr(), reason: "", medical_cert: "" });
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-3 col-6"><InfoBox ico="bi-hourglass-split" label="รออนุมัติ" value={stat.pending} color="warning" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-calendar-check" label={`ลาแล้วปี ${+year + 543}`} value={`${stat.usedDays} วัน`} color="primary" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-thermometer-half" label="ลาป่วย" value={`${stat.sick} วัน`} color="danger" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-briefcase" label="ลากิจ" value={`${stat.personal} วัน`} color="info" /></div>
      </div>

      <div className="row g-3">
        {/* ฟอร์มยื่นลา */}
        <div className="col-lg-5">
          <div className="card shadow-sm">
            <div className="card-header py-2 fw-semibold"><i className="bi bi-journal-plus me-1 text-primary" />ยื่นคำขอลา</div>
            <div className="card-body py-3">
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <label className="form-label small mb-1">ประเภทการลา</label>
                  <select className="form-select form-select-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="personal">ลากิจ</option>
                    <option value="sick">ลาป่วย</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">ตั้งแต่วันที่</label>
                  <input type="date" className="form-control form-control-sm" value={form.date_from}
                         onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value, date_to: f.date_to < e.target.value ? e.target.value : f.date_to }))} />
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">ถึงวันที่</label>
                  <input type="date" className="form-control form-control-sm" value={form.date_to} min={form.date_from}
                         onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} />
                </div>
                <div className="col-12">
                  <span className="text-muted small">รวมวันลา </span>
                  <span className={`badge ${days > 0 ? "text-bg-primary" : "text-bg-secondary"}`}>{days > 0 ? `${days} วัน` : "—"}</span>
                </div>
              </div>
              <label className="form-label small mb-1">เหตุผล</label>
              <textarea className="form-control form-control-sm mb-2" rows={2} value={form.reason}
                        placeholder={form.type === "sick" ? "อาการ/สาเหตุ เช่น ไข้หวัด ปวดท้อง" : "เช่น ติดต่อราชการ ธุระครอบครัว"}
                        onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              {form.type === "sick" && (
                <div className="mb-2">
                  <label className="form-label small mb-1">
                    ใบรับรองแพทย์ {certRequired ? <span className="text-danger">(จำเป็น — ป่วยเกิน {threshold} วัน)</span> : "(ถ้ามี)"}
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    {form.medical_cert && <img src={form.medical_cert} alt="" width={56} height={56} className="rounded border object-fit-cover" />}
                    <label className="btn btn-outline-secondary btn-sm mb-0">
                      <i className="bi bi-paperclip me-1" />แนบไฟล์
                      <input type="file" accept="image/*,application/pdf" hidden onChange={pickCert} />
                    </label>
                    {form.medical_cert && <button className="btn btn-outline-danger btn-sm" onClick={() => setForm((f) => ({ ...f, medical_cert: "" }))}>ลบ</button>}
                  </div>
                </div>
              )}
              <div className="d-flex align-items-center mt-3">
                {certRequired && !form.medical_cert && <span className="text-danger small">ต้องแนบใบรับรองแพทย์ก่อนส่ง</span>}
                <button className="btn btn-primary ms-auto px-4" disabled={busy || days < 1 || (certRequired && !form.medical_cert)} onClick={submit}>
                  {busy && <span className="spinner-border spinner-border-sm me-1" />}
                  <i className="bi bi-send me-1" />ส่งคำขอ
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* คำขอของฉัน (inbox style) */}
        <div className="col-lg-7">
          <div className="card shadow-sm">
            <div className="card-header py-2 d-flex align-items-center">
              <span className="fw-semibold"><i className="bi bi-inbox me-1 text-primary" />คำขอของฉัน</span>
              {rows.length > 0 && <span className="badge bg-body-tertiary text-body-secondary border ms-2">{rows.length} รายการ</span>}
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {rows.map((r) => {
                const [tl, tc] = TYPE_TH[r.type] || [r.type, "light"];
                const [sl, sc] = STATUS_TH[r.status] || [r.status, "light"];
                return (
                  <div key={r.leave_ID} className="list-group-item py-2 lv-item" style={{ borderLeftColor: `var(--bs-${sc})` }}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`badge text-bg-${tc}`}>{tl}</span>
                      <span className="small fw-semibold">{fmtD(r.date_from)} – {fmtD(r.date_to)}</span>
                      <span className="text-muted small">· {r.days} วัน</span>
                      {r.medical_cert && (
                        <a className="badge bg-body-tertiary text-body-secondary border text-decoration-none" href={r.medical_cert} target="_blank" rel="noreferrer">
                          <i className="bi bi-paperclip" /> ใบรับรอง
                        </a>
                      )}
                      <span className={`badge text-bg-${sc} ms-auto`}>{sl}</span>
                    </div>
                    {r.reason && (
                      <div className="text-muted small mt-1">
                        <i className="bi bi-chat-left-text me-1" />{r.reason}
                      </div>
                    )}
                  </div>
                );
              })}
              {!rows.length && (
                <div className="list-group-item text-center text-muted py-5 lv-empty">
                  <i className="bi bi-inbox d-block mb-2" />
                  ยังไม่มีคำขอลา
                  <div className="small">ยื่นคำขอได้จากฟอร์ม "ยื่นคำขอลา"</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PendingApprovals({ auth }) {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    api(`/leaves?branch_ID=${auth.branch_ID}&status=pending`).then(setRows).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x])))).catch(() => {});
  }, [auth.branch_ID]);
  useEffect(load, [load]);

  const review = async (id, status) => {
    setBusy(id);
    try {
      await api(`/leaves/${id}`, { method: "PUT", body: { status } });
      toast.success(status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธคำขอแล้ว");
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header py-2 fw-semibold">
        <i className="bi bi-check2-square me-1 text-primary" />คำขอรออนุมัติ <span className="badge text-bg-warning ms-1">{rows.length}</span>
      </div>
      <div className="list-group list-group-flush">
        {rows.map((r) => {
          const [tl, tc] = TYPE_TH[r.type] || [r.type, "light"];
          return (
            <div key={r.leave_ID} className="list-group-item py-3 lv-item" style={{ borderLeftColor: `var(--bs-${tc})` }}>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <b>{users[r.user_ID]?.full_name || r.user_ID}</b>
                <span className={`badge text-bg-${tc}`}>{tl}</span>
                <span className="small text-muted">{fmtD(r.date_from)} → {fmtD(r.date_to)} · {r.days} วัน</span>
                {r.medical_cert && <a className="badge bg-body-tertiary text-body-secondary border text-decoration-none" href={r.medical_cert} target="_blank" rel="noreferrer"><i className="bi bi-paperclip" /> ใบรับรองแพทย์</a>}
                <span className="ms-auto d-flex gap-2">
                  <button className="btn btn-success btn-sm" disabled={busy === r.leave_ID} onClick={() => review(r.leave_ID, "approved")}>
                    <i className="bi bi-check2 me-1" />อนุมัติ
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" disabled={busy === r.leave_ID} onClick={() => review(r.leave_ID, "rejected")}>ไม่อนุมัติ</button>
                </span>
              </div>
              {r.reason && <div className="text-muted small mt-1">เหตุผล: {r.reason}</div>}
            </div>
          );
        })}
        {!rows.length && <div className="list-group-item text-center text-muted py-5 lv-empty"><i className="bi bi-cup-hot d-block mb-2" />ไม่มีคำขอรออนุมัติ<div className="small">ทีมงานมาครบ ไม่มีใครยื่นลาเพิ่ม</div></div>}
      </div>
    </div>
  );
}

function DailyAbsence({ auth }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  useEffect(() => {
    api(`/leaves?branch_ID=${auth.branch_ID}&status=approved&from=${date}&to=${date}`).then(setRows).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x])))).catch(() => {});
  }, [auth.branch_ID, date]);

  return (
    <div className="card shadow-sm">
      <div className="card-header py-2 d-flex align-items-center gap-2">
        <span className="fw-semibold"><i className="bi bi-person-dash me-1 text-primary" />คนลาวันที่ {fmtD(date)}</span>
        <span className="badge text-bg-danger">{rows.length} คน</span>
        <input type="date" className="form-control form-control-sm ms-auto" style={{ width: 150 }} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="list-group list-group-flush">
        {rows.map((r) => {
          const [tl, tc] = TYPE_TH[r.type] || [r.type, "light"];
          return (
            <div key={r.leave_ID} className="list-group-item d-flex align-items-center gap-2">
              <b>{users[r.user_ID]?.full_name || r.user_ID}</b>
              <span className={`badge text-bg-${tc}`}>{tl}</span>
              <span className="text-muted small ms-auto">{fmtD(r.date_from)} → {fmtD(r.date_to)}</span>
            </div>
          );
        })}
        {!rows.length && <div className="list-group-item text-center text-muted py-4">— วันนี้ไม่มีคนลา —</div>}
      </div>
    </div>
  );
}

function LeaveSummary({ auth }) {
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  useEffect(() => {
    api(`/leaves?status=approved&from=${from}&to=${to}&branch_ID=${auth.branch_ID}`).then(setRows).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x])))).catch(() => {});
  }, [auth.branch_ID, from, to]);

  const byUser = useMemo(() => {
    const m = {};
    for (const r of rows) {
      m[r.user_ID] = m[r.user_ID] || { user_ID: r.user_ID, sick: 0, personal: 0, total: 0, count: 0 };
      m[r.user_ID][r.type] += r.days || 0;
      m[r.user_ID].total += r.days || 0;
      m[r.user_ID].count += 1;
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [rows]);

  return (
    <div className="card shadow-sm">
      <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold"><i className="bi bi-clipboard-data me-1 text-primary" />สรุปการลา (อนุมัติแล้ว)</span>
        <span className="ms-auto d-flex gap-2 align-items-center">
          <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted">–</span>
          <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </span>
      </div>
      <div className="card-body p-0">
        <table className="table table-sm table-hover mb-0">
          <thead><tr><th className="bg-body-tertiary">พนักงาน</th><th className="bg-body-tertiary text-end">ลาป่วย (วัน)</th><th className="bg-body-tertiary text-end">ลากิจ (วัน)</th><th className="bg-body-tertiary text-end">รวม</th><th className="bg-body-tertiary text-end">จำนวนครั้ง</th></tr></thead>
          <tbody>
            {byUser.map((u) => (
              <tr key={u.user_ID}>
                <td className="fw-semibold">{users[u.user_ID]?.full_name || u.user_ID}</td>
                <td className="text-end">{u.sick}</td>
                <td className="text-end">{u.personal}</td>
                <td className="text-end fw-bold">{u.total}</td>
                <td className="text-end">{u.count}</td>
              </tr>
            ))}
            {!byUser.length && <tr><td colSpan={5} className="text-center text-muted py-4">— ไม่มีการลาในช่วงนี้ —</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
