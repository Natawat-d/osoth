"use client";
// ลงเวลาเข้างาน — V3 Bootstrap แท้ (ref info-box): เช็คอิน/เอาท์ + ประวัติของฉัน · admin ดูทีมรายวัน
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import InfoBox from "@/components/InfoBox";
import { exportCsv } from "@/lib/exportCsv";

const hhmm = (d) => (d ? new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
const fmtD = (d) => (d ? String(d).split("-").reverse().join("/") : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hoursOf = (r) => (r?.check_in && r?.check_out ? ((new Date(r.check_out) - new Date(r.check_in)) / 3600000) : null);
const wd = (d) => (d ? new Date(d).toLocaleDateString("th-TH", { weekday: "short" }) : "");
const ROLE_TH = { super_admin: "เจ้าของ", admin: "แอดมิน", sale: "ฝ่ายขาย", doctor: "แพทย์", BT: "BT" };

export default function AttendancePage() {
  const auth = useSelector((s) => s.auth);
  const isManager = ["super_admin", "admin"].includes(auth.user?.role);
  const [tab, setTab] = useState("me");

  return (
    <div className="app-content">
      <div className="container-fluid pt-3 att-prem">
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0 prem-title">ลงเวลาเข้างาน</h4>
          {isManager && (
            <ul className="nav nav-pills ms-auto">
              {[["me", "ของฉัน"], ["day", "ทีมรายวัน"]].map(([k, l]) => (
                <li className="nav-item" key={k}>
                  <button className={`nav-link py-1 ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {tab === "me" ? <MyAttendance /> : <TeamAttendance auth={auth} />}
      </div>
      <style jsx global>{`
        .att-prem { --att-grad: linear-gradient(135deg, #1560a3, #2a7bc4); }
        .att-prem .prem-title { letter-spacing: 0.01em; position: relative; padding-bottom: 7px; }
        .att-prem .prem-title::after {
          content: ""; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px;
          border-radius: 2px; background: var(--att-grad);
        }
        .att-prem .nav-pills .nav-link {
          border-radius: 999px; padding-inline: 1rem;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .att-prem .nav-pills .nav-link:not(.active):hover { background: var(--bs-tertiary-bg); }
        .att-prem .nav-pills .nav-link.active { background: var(--att-grad); box-shadow: 0 4px 14px rgba(21, 96, 163, 0.32); }
        .att-prem .table { font-variant-numeric: tabular-nums; }
        .att-prem thead th { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.02em; color: var(--bs-secondary-color); }
        .att-prem .card.shadow-sm { border-color: var(--bs-border-color); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06) !important; }
        /* ── การ์ดลงเวลา (พระเอก) ── */
        .att-prem .att-hero {
          border: 0; border-radius: 1.1rem; overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
        }
        .att-band { color: #fff; padding: 1.35rem 1rem 1.15rem; }
        .att-band-none { background: linear-gradient(150deg, #66707c, #454e58); }
        .att-band-working { background: linear-gradient(150deg, #1560a3, #2a7bc4); }
        .att-band-done { background: linear-gradient(150deg, #177347, #2fa26b); }
        .att-status-chip {
          display: inline-flex; align-items: center; background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.3); color: #fff;
          font-size: 0.8rem; font-weight: 600; letter-spacing: 0.03em;
          padding: 0.26rem 0.85rem; border-radius: 999px;
        }
        .att-ring {
          width: 198px; height: 198px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid rgba(255, 255, 255, 0.38);
          box-shadow: inset 0 0 0 10px rgba(255, 255, 255, 0.08), 0 6px 18px rgba(0, 0, 0, 0.15);
        }
        .att-band-working .att-ring { animation: attPulse 2.6s ease-in-out infinite; }
        @keyframes attPulse {
          0%, 100% { box-shadow: inset 0 0 0 10px rgba(255, 255, 255, 0.08), 0 0 0 0 rgba(255, 255, 255, 0.3); }
          50% { box-shadow: inset 0 0 0 10px rgba(255, 255, 255, 0.12), 0 0 0 16px rgba(255, 255, 255, 0); }
        }
        .att-clock { font-size: 2.45rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.05; letter-spacing: 0.01em; }
        .att-date { font-size: 0.76rem; opacity: 0.88; margin-top: 0.4rem; }
        .att-prem .att-hero .btn-lg {
          border-radius: 999px; font-weight: 600;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .att-prem .att-hero .btn-lg:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22); }
        .att-prem .att-hero .btn-lg:active { transform: scale(0.96); }
        .att-prem .att-empty i { font-size: 2.6rem; opacity: 0.35; }
      `}</style>
    </div>
  );
}

function MyAttendance() {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState("");
  const today = todayStr();

  const load = useCallback(() => { api("/attendance").then(setRows).catch(() => {}); }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("th-TH", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const todayRec = rows.find((r) => r.date === today);
  const workedToday = hoursOf(todayRec);
  const monthRows = rows.filter((r) => r.date?.startsWith(today.slice(0, 7)));
  const monthHours = monthRows.reduce((s, r) => s + (hoursOf(r) || 0), 0);

  const check = async (action) => {
    setBusy(true);
    try {
      await api("/attendance", { method: "POST", body: { action } });
      toast.success(action === "in" ? "ลงเวลาเข้างานแล้ว" : "ลงเวลาออกงานแล้ว");
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const state = !todayRec?.check_in ? ["ยังไม่เข้างาน", "secondary", "bi-door-open"]
    : !todayRec?.check_out ? ["กำลังทำงาน", "success", "bi-person-workspace"]
    : ["ออกงานแล้ว", "dark", "bi-house-check"];
  const band = !todayRec?.check_in ? "none" : !todayRec?.check_out ? "working" : "done";

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-3 col-6"><InfoBox ico={state[2]} label="สถานะวันนี้" value={state[0]} color={state[1]} /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-box-arrow-in-right" label="เวลาเข้า" value={hhmm(todayRec?.check_in)} color="primary" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-box-arrow-right" label="เวลาออก" value={hhmm(todayRec?.check_out)} color="info" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-hourglass-split" label="ชม.เดือนนี้" value={monthHours.toFixed(1)} sub={`วันนี้ ${workedToday ? workedToday.toFixed(1) + " ชม." : "—"}`} color="warning" /></div>
      </div>

      <div className="row g-3">
        {/* การ์ดลงเวลา (พระเอก) */}
        <div className="col-lg-4">
          <div className="card att-hero text-center">
            <div className={`att-band att-band-${band}`}>
              <span className="att-status-chip">
                <i className={`bi ${state[2]} me-1`} />{state[0]}
              </span>
              <div className="att-ring mx-auto mt-3 mb-1">
                <div>
                  <div className="att-clock">{clock || "--:--:--"}</div>
                  <div className="att-date">
                    {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body py-4">
              {!todayRec?.check_in && (
                <>
                  <button className="btn btn-success btn-lg px-5" disabled={busy} onClick={() => check("in")}>
                    {busy && <span className="spinner-border spinner-border-sm me-2" />}
                    <i className="bi bi-box-arrow-in-right me-2" />เข้างาน
                  </button>
                  <div className="text-muted small mt-2">แตะปุ่มเพื่อบันทึกเวลาเข้างานวันนี้</div>
                </>
              )}
              {todayRec?.check_in && !todayRec?.check_out && (
                <>
                  <button className="btn btn-danger btn-lg px-5" disabled={busy} onClick={() => check("out")}>
                    {busy && <span className="spinner-border spinner-border-sm me-2" />}
                    <i className="bi bi-box-arrow-right me-2" />ออกงาน
                  </button>
                  <div className="text-muted small mt-2">
                    <i className="bi bi-box-arrow-in-right me-1 text-success" />เข้างานเมื่อ {hhmm(todayRec.check_in)}
                  </div>
                </>
              )}
              {todayRec?.check_out && (
                <div className="alert alert-success mb-0 py-2">
                  <i className="bi bi-check2-circle me-1" />ลงเวลาครบแล้ววันนี้<br />
                  <span className="small">{hhmm(todayRec.check_in)} – {hhmm(todayRec.check_out)} · รวม {workedToday ? workedToday.toFixed(1) : "—"} ชม.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ประวัติ */}
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header py-2 d-flex align-items-center">
              <span className="fw-semibold"><i className="bi bi-clock-history me-1 text-primary" />ประวัติลงเวลา</span>
              {rows.length > 0 && <span className="badge bg-body-tertiary text-body-secondary border ms-2">{rows.length} วัน</span>}
            </div>
            <div className="card-body p-0" style={{ maxHeight: "55vh", overflowY: "auto" }}>
              <table className="table table-sm table-hover mb-0 align-middle">
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="bg-body-tertiary">วันที่</th>
                    <th className="bg-body-tertiary text-center">เข้างาน</th>
                    <th className="bg-body-tertiary text-center">ออกงาน</th>
                    <th className="bg-body-tertiary text-end">ชั่วโมง</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const h = hoursOf(r);
                    const isToday = r.date === today;
                    return (
                      <tr key={r.att_ID} className={isToday ? "table-primary" : ""}>
                        <td className={isToday ? "fw-semibold" : ""}>
                          {fmtD(r.date)} <span className="text-muted small">({wd(r.date)})</span>
                        </td>
                        <td className="text-center">{hhmm(r.check_in)}</td>
                        <td className="text-center">
                          {!r.check_out && r.check_in && isToday
                            ? <span className="badge text-bg-success">กำลังทำงาน</span>
                            : hhmm(r.check_out)}
                        </td>
                        <td className="text-end">{h ? h.toFixed(1) : "—"}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr><td colSpan={4} className="text-center text-muted py-5 att-empty">
                      <i className="bi bi-calendar2-week d-block mb-2" />
                      ยังไม่มีประวัติลงเวลา
                      <div className="small">กดปุ่ม "เข้างาน" เพื่อเริ่มบันทึกวันแรกของคุณ</div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TeamAttendance({ auth }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});

  useEffect(() => {
    api(`/attendance?branch_ID=${auth.branch_ID}&date=${date}`).then(setRows).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x])))).catch(() => {});
  }, [auth.branch_ID, date]);

  const working = rows.filter((r) => r.check_in && !r.check_out).length;
  const done = rows.filter((r) => r.check_out).length;

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4 col-6"><InfoBox ico="bi-people" label="มาทำงาน" value={rows.length} color="primary" /></div>
        <div className="col-md-4 col-6"><InfoBox ico="bi-person-workspace" label="กำลังทำงาน" value={working} color="success" /></div>
        <div className="col-md-4 col-12"><InfoBox ico="bi-house-check" label="ออกแล้ว" value={done} color="secondary" /></div>
      </div>
      <div className="card shadow-sm">
        <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-semibold"><i className="bi bi-people me-1 text-primary" />ทีมวันที่ {fmtD(date)}</span>
          <input type="date" className="form-control form-control-sm ms-auto" style={{ width: 150 }} value={date} onChange={(e) => setDate(e.target.value)} />
          {rows.length > 0 && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => exportCsv(`ลงเวลา_${date}`, [
              { label: "พนักงาน", value: (r) => users[r.user_ID]?.full_name || r.user_ID },
              { label: "ตำแหน่ง", value: (r) => ROLE_TH[users[r.user_ID]?.role] || "" },
              { label: "เข้างาน", value: (r) => hhmm(r.check_in) },
              { label: "ออกงาน", value: (r) => hhmm(r.check_out) },
            ], rows)}><i className="bi bi-download me-1" />CSV</button>
          )}
        </div>
        <div className="card-body p-0">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead><tr><th className="bg-body-tertiary">พนักงาน</th><th className="bg-body-tertiary">ตำแหน่ง</th><th className="bg-body-tertiary text-center">เข้างาน</th><th className="bg-body-tertiary text-center">ออกงาน</th><th className="bg-body-tertiary text-end">ชั่วโมง</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const u = users[r.user_ID];
                const h = hoursOf(r);
                return (
                  <tr key={r.att_ID}>
                    <td className="fw-semibold">{u?.full_name || r.user_ID}</td>
                    <td><span className="badge bg-body-tertiary text-body-secondary border">{ROLE_TH[u?.role] || "-"}</span></td>
                    <td className="text-center">{hhmm(r.check_in)}</td>
                    <td className="text-center">{r.check_out ? hhmm(r.check_out) : <span className="badge text-bg-success">กำลังทำงาน</span>}</td>
                    <td className="text-end">{h ? h.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={5} className="text-center text-muted py-5 att-empty">
                  <i className="bi bi-people d-block mb-2" />
                  ยังไม่มีคนลงเวลาในวันนี้
                  <div className="small">เลือกวันที่อื่นได้จากช่องมุมขวาบน</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
