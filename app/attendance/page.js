"use client";
// ลงเวลาเข้า/ออกงาน — พนักงานกดเข้า/ออก + ประวัติของตัวเอง · admin ดูรายวันทั้งสาขา
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { AsyncButton, fmtThaiDate, ROLE_LABEL } from "@/components/ui";
import { exportCsv } from "@/lib/exportCsv";

const hhmm = (d) => (d ? new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");

export default function AttendancePage() {
  const auth = useSelector((s) => s.auth);
  const isManager = ["super_admin", "admin"].includes(auth.user?.role);
  const [tab, setTab] = useState("me");
  return (
    <div>
      {isManager && (
        <div className="toolbar">
          <div className="seg">
            <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>ของฉัน</button>
            <button className={tab === "day" ? "on" : ""} onClick={() => setTab("day")}>รายวัน (ทั้งสาขา)</button>
          </div>
        </div>
      )}
      {tab === "me" ? <MyAttendance /> : <DailyAttendance auth={auth} />}
    </div>
  );
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MyAttendance() {
  const [rows, setRows] = useState([]);
  const today = todayLocal();
  const load = useCallback(() => { api("/attendance").then(setRows).catch(() => {}); }, []);
  useEffect(load, [load]);
  const todayRec = rows.find((r) => r.date === today);

  const check = async (action) => { await api("/attendance", { method: "POST", body: { action } }); load(); };

  return (
    <div>
      <div className="card">
        <h2><span className="h2-ico">⏰</span> ลงเวลาวันนี้ · {fmtThaiDate(today)}</h2>
        <div className="row" style={{ alignItems: "center" }}>
          <div className="stat" style={{ maxWidth: 180 }}>
            <div className="num">{hhmm(todayRec?.check_in)}</div><div className="lbl">เข้างาน</div>
          </div>
          <div className="stat" style={{ maxWidth: 180 }}>
            <div className="num">{hhmm(todayRec?.check_out)}</div><div className="lbl">ออกงาน</div>
          </div>
          <div className="grow" />
          {!todayRec?.check_in && <AsyncButton className="btn primary" ok="ลงเวลาเข้างานแล้ว" onClick={() => check("in")}>🟢 เข้างาน</AsyncButton>}
          {todayRec?.check_in && !todayRec?.check_out && <AsyncButton className="btn" ok="ลงเวลาออกงานแล้ว" onClick={() => check("out")}>🔴 ออกงาน</AsyncButton>}
          {todayRec?.check_out && <span className="badge green">ครบแล้ววันนี้</span>}
        </div>
      </div>
      <div className="card">
        <h2><span className="h2-ico">📋</span> ประวัติลงเวลา</h2>
        <table className="tbl">
          <thead><tr><th>วันที่</th><th>เข้างาน</th><th>ออกงาน</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="muted">ยังไม่มีประวัติ</td></tr>}
            {rows.map((r) => (
              <tr key={r.att_ID}><td>{fmtThaiDate(r.date)}</td><td>{hhmm(r.check_in)}</td><td>{hhmm(r.check_out)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyAttendance({ auth }) {
  const [date, setDate] = useState(todayLocal());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  useEffect(() => {
    api(`/attendance?branch_ID=${auth.branch_ID}&date=${date}`).then(setRows).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x])))).catch(() => {});
  }, [auth.branch_ID, date]);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><label>วันที่</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="date-hint">{fmtThaiDate(date)}</span></div>
        <div className="grow" />
        <span className="badge gray nodot">มาทำงาน {rows.length} คน</span>
        {rows.length > 0 && (
          <button className="btn small" onClick={() => exportCsv(`ลงเวลา_${date}`, [
            { label: "พนักงาน", value: (r) => users[r.user_ID]?.full_name || r.user_ID },
            { label: "ตำแหน่ง", value: (r) => ROLE_LABEL[users[r.user_ID]?.role] || "" },
            { label: "เข้างาน", value: (r) => hhmm(r.check_in) },
            { label: "ออกงาน", value: (r) => hhmm(r.check_out) },
          ], rows)}>⬇ ส่งออก CSV</button>
        )}
      </div>
      <table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>เข้างาน</th><th>ออกงาน</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="muted">วันนี้ยังไม่มีคนลงเวลา</td></tr>}
          {rows.map((r) => (
            <tr key={r.att_ID}>
              <td><b>{users[r.user_ID]?.full_name || r.user_ID}</b></td>
              <td><span className="badge gray nodot">{ROLE_LABEL[users[r.user_ID]?.role] || "-"}</span></td>
              <td>{hhmm(r.check_in)}</td><td>{hhmm(r.check_out)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
