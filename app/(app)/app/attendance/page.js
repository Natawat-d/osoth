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
const ROLE_TH = { super_admin: "เจ้าของ", admin: "แอดมิน", sale: "ฝ่ายขาย", doctor: "แพทย์", BT: "BT" };

export default function AttendancePage() {
  const auth = useSelector((s) => s.auth);
  const isManager = ["super_admin", "admin"].includes(auth.user?.role);
  const [tab, setTab] = useState("me");

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">ลงเวลาเข้างาน</h4>
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

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-3 col-6"><InfoBox ico={state[2]} label="สถานะวันนี้" value={state[0]} color={state[1]} /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-box-arrow-in-right" label="เวลาเข้า" value={hhmm(todayRec?.check_in)} color="primary" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-box-arrow-right" label="เวลาออก" value={hhmm(todayRec?.check_out)} color="info" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-hourglass-split" label="ชม.เดือนนี้" value={monthHours.toFixed(1)} sub={`วันนี้ ${workedToday ? workedToday.toFixed(1) + " ชม." : "—"}`} color="warning" /></div>
      </div>

      <div className="row g-3">
        {/* การ์ดลงเวลา */}
        <div className="col-lg-4">
          <div className="card shadow-sm text-center">
            <div className="card-body py-4">
              <div className="display-6 fw-bold font-monospace mb-1">{clock || "--:--:--"}</div>
              <div className="text-muted small mb-3">{fmtD(today)}</div>
              {!todayRec?.check_in && (
                <button className="btn btn-success btn-lg px-5" disabled={busy} onClick={() => check("in")}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />}
                  <i className="bi bi-box-arrow-in-right me-2" />เข้างาน
                </button>
              )}
              {todayRec?.check_in && !todayRec?.check_out && (
                <button className="btn btn-danger btn-lg px-5" disabled={busy} onClick={() => check("out")}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />}
                  <i className="bi bi-box-arrow-right me-2" />ออกงาน
                </button>
              )}
              {todayRec?.check_out && (
                <div className="alert alert-success mb-0 py-2">
                  <i className="bi bi-check2-circle me-1" />ลงเวลาครบแล้ววันนี้ ({hhmm(todayRec.check_in)} – {hhmm(todayRec.check_out)})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ประวัติ */}
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header py-2 fw-semibold"><i className="bi bi-clock-history me-1 text-primary" />ประวัติลงเวลา</div>
            <div className="card-body p-0" style={{ maxHeight: "55vh", overflowY: "auto" }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                  <tr><th>วันที่</th><th className="text-center">เข้างาน</th><th className="text-center">ออกงาน</th><th className="text-end">ชั่วโมง</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const h = hoursOf(r);
                    return (
                      <tr key={r.att_ID} className={r.date === today ? "table-primary" : ""}>
                        <td>{fmtD(r.date)}</td>
                        <td className="text-center">{hhmm(r.check_in)}</td>
                        <td className="text-center">{hhmm(r.check_out)}</td>
                        <td className="text-end">{h ? h.toFixed(1) : "—"}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={4} className="text-center text-muted py-4">— ยังไม่มีประวัติ —</td></tr>}
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
        <div className="col-md-3 col-6"><InfoBox ico="bi-people" label="มาทำงาน" value={rows.length} color="primary" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-person-workspace" label="กำลังทำงาน" value={working} color="success" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-house-check" label="ออกแล้ว" value={done} color="secondary" /></div>
        <div className="col-md-3 col-6">
          <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="card shadow-sm">
        <div className="card-header py-2 d-flex align-items-center">
          <span className="fw-semibold"><i className="bi bi-people me-1 text-primary" />ทีมวันที่ {fmtD(date)}</span>
          {rows.length > 0 && (
            <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => exportCsv(`ลงเวลา_${date}`, [
              { label: "พนักงาน", value: (r) => users[r.user_ID]?.full_name || r.user_ID },
              { label: "ตำแหน่ง", value: (r) => ROLE_TH[users[r.user_ID]?.role] || "" },
              { label: "เข้างาน", value: (r) => hhmm(r.check_in) },
              { label: "ออกงาน", value: (r) => hhmm(r.check_out) },
            ], rows)}><i className="bi bi-download me-1" />CSV</button>
          )}
        </div>
        <div className="card-body p-0">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead className="table-light"><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th className="text-center">เข้างาน</th><th className="text-center">ออกงาน</th><th className="text-end">ชั่วโมง</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const u = users[r.user_ID];
                const h = hoursOf(r);
                return (
                  <tr key={r.att_ID}>
                    <td className="fw-semibold">{u?.full_name || r.user_ID}</td>
                    <td><span className="badge text-bg-light border">{ROLE_TH[u?.role] || "-"}</span></td>
                    <td className="text-center">{hhmm(r.check_in)}</td>
                    <td className="text-center">{r.check_out ? hhmm(r.check_out) : <span className="badge text-bg-success">กำลังทำงาน</span>}</td>
                    <td className="text-end">{h ? h.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={5} className="text-center text-muted py-4">— วันนี้ยังไม่มีคนลงเวลา —</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
