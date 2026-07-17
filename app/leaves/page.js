"use client";
// ระบบลา: พนักงานยื่นลากิจ/ลาป่วย → admin อนุมัติ
// admin: ดูรออนุมัติ / ขาดงานรายวัน / KPI สรุปการลาต่อคน
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import ImageInput from "@/components/ImageInput";
import { todayStr } from "@/components/ui";

const TYPE_LABEL = { personal: "ลากิจ", sick: "ลาป่วย" };
const ST = {
  pending: { c: "gold", t: "รออนุมัติ" },
  approved: { c: "green", t: "อนุมัติแล้ว" },
  rejected: { c: "red", t: "ไม่อนุมัติ" },
};

function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.floor((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
}

export default function LeavesPage() {
  const auth = useSelector((s) => s.auth);
  const isManager = ["super_admin", "admin"].includes(auth.user?.role);
  const [tab, setTab] = useState("mine"); // mine | pending | absence | kpi

  return (
    <div>
      <div className="toolbar no-print">
        <div className="seg">
          <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>คำขอของฉัน</button>
          {isManager && <button className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>รออนุมัติ</button>}
          {isManager && <button className={tab === "absence" ? "on" : ""} onClick={() => setTab("absence")}>ขาดงานรายวัน</button>}
          {isManager && <button className={tab === "kpi" ? "on" : ""} onClick={() => setTab("kpi")}>KPI การลา</button>}
        </div>
      </div>

      {tab === "mine" && <MyLeaves auth={auth} />}
      {tab === "pending" && isManager && <PendingApprovals auth={auth} />}
      {tab === "absence" && isManager && <DailyAbsence auth={auth} />}
      {tab === "kpi" && isManager && <LeaveKPI auth={auth} />}
    </div>
  );
}

function MyLeaves({ auth }) {
  const [config, setConfig] = useState({ sick_cert_threshold_days: 2 });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "personal", date_from: todayStr(), date_to: todayStr(), reason: "", medical_cert: "" });

  const load = useCallback(() => { api("/leaves").then(setRows).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); api("/config").then(setConfig).catch(() => {}); }, [load]);

  const days = daysBetween(form.date_from, form.date_to);
  const threshold = config.sick_cert_threshold_days ?? 2;
  const certRequired = form.type === "sick" && days > threshold;

  const submit = async () => {
    setError("");
    try {
      await api("/leaves", { method: "POST", body: { ...form, branch_ID: auth.branch_ID } });
      setForm({ type: "personal", date_from: todayStr(), date_to: todayStr(), reason: "", medical_cert: "" });
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="card">
        <h2><span className="h2-ico">📝</span> ยื่นคำขอลา</h2>
        <div className="row">
          <div className="field">
            <label>ประเภท</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="personal">ลากิจ</option>
              <option value="sick">ลาป่วย</option>
            </select>
          </div>
          <div className="field">
            <label>ตั้งแต่วันที่</label>
            <input type="date" value={form.date_from} onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div className="field">
            <label>ถึงวันที่</label>
            <input type="date" value={form.date_to} onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div className="field" style={{ flex: "0 0 auto" }}>
            <label>จำนวนวัน</label>
            <div className="q-time">{days > 0 ? days : "—"}</div>
          </div>
        </div>
        <div className="field">
          <label>เหตุผล</label>
          <textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
        {form.type === "sick" && (
          <>
            <ImageInput
              label={`ใบรับรองแพทย์ ${certRequired ? "(จำเป็น — ลาป่วยเกิน " + threshold + " วัน)" : "(ถ้ามี)"}`}
              value={form.medical_cert}
              onChange={(v) => setForm((f) => ({ ...f, medical_cert: v }))}
            />
          </>
        )}
        <button className="btn primary" style={{ marginTop: 8 }}
          disabled={days < 1 || (certRequired && !form.medical_cert)}
          onClick={submit}>
          ส่งคำขอ
        </button>
        {certRequired && !form.medical_cert && (
          <span className="muted" style={{ marginLeft: 10 }}>ต้องแนบใบรับรองแพทย์ก่อนส่ง</span>
        )}
      </div>

      <div className="card">
        <h2><span className="h2-ico">📋</span> คำขอของฉัน</h2>
        <LeaveTable rows={rows} showUser={false} />
      </div>
    </div>
  );
}

function PendingApprovals({ auth }) {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api(`/leaves?branch_ID=${auth.branch_ID}&status=pending`).then(setRows).catch((e) => setError(e.message));
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x]))));
  }, [auth.branch_ID]);
  useEffect(load, [load]);

  const review = async (id, status) => {
    setError("");
    try { await api(`/leaves/${id}`, { method: "PUT", body: { status } }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="card">
      {error && <div className="err">{error}</div>}
      <h2><span className="h2-ico">✅</span> คำขอรออนุมัติ ({rows.length})</h2>
      {rows.length === 0 && <div className="empty-state"><span className="es-ico">🍵</span>ไม่มีคำขอรออนุมัติ</div>}
      {rows.map((r) => (
        <div key={r.leave_ID} className="q-item">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b>{users[r.user_ID]?.full_name || r.user_ID}</b>
            <span className={`badge ${r.type === "sick" ? "red" : "blue"} nodot`}>{TYPE_LABEL[r.type]}</span>
            <span className="muted">{r.date_from} → {r.date_to} · {r.days} วัน</span>
            {r.medical_cert && <a href={r.medical_cert} target="_blank" rel="noreferrer" className="badge gold">📎 ใบรับรองแพทย์</a>}
          </div>
          {r.reason && <div className="muted" style={{ margin: "6px 0" }}>เหตุผล: {r.reason}</div>}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small primary" onClick={() => review(r.leave_ID, "approved")}>อนุมัติ</button>
            <button className="btn small ghost" onClick={() => review(r.leave_ID, "rejected")}>ไม่อนุมัติ</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyAbsence({ auth }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});

  useEffect(() => {
    api(`/leaves?branch_ID=${auth.branch_ID}&status=approved&from=${date}&to=${date}`).then(setRows);
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x]))));
  }, [auth.branch_ID, date]);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}>
          <label>วันที่</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grow" />
        <span className="badge gray nodot">ขาดงาน {rows.length} คน</span>
      </div>
      {rows.length === 0 && <div className="empty-state"><span className="es-ico">🎐</span>วันนี้ไม่มีคนลา</div>}
      {rows.map((r) => (
        <div key={r.leave_ID} className="roster-item">
          <span className="roster-swatch" style={{ background: r.type === "sick" ? "var(--seal)" : "var(--info)" }} />
          <div style={{ flex: 1 }}>
            <div className="roster-name">{users[r.user_ID]?.full_name || r.user_ID}</div>
            <div className="roster-meta">{TYPE_LABEL[r.type]} · {r.date_from} → {r.date_to} ({r.days} วัน)</div>
          </div>
          {r.medical_cert && <a href={r.medical_cert} target="_blank" rel="noreferrer" className="badge gold">📎</a>}
        </div>
      ))}
    </div>
  );
}

function LeaveKPI({ auth }) {
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});

  useEffect(() => {
    api(`/leaves?branch_ID=${auth.branch_ID}&status=approved&from=${from}&to=${to}`).then(setRows);
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x]))));
  }, [auth.branch_ID, from, to]);

  const kpi = {};
  for (const r of rows) {
    const k = (kpi[r.user_ID] = kpi[r.user_ID] || { user_ID: r.user_ID, personal: 0, sick: 0, days: 0 });
    k[r.type] += 1;
    k.days += r.days;
  }
  const list = Object.values(kpi).sort((a, b) => b.days - a.days);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><label>จาก</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label>ถึง</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <h2><span className="h2-ico">📊</span> สรุปการลาต่อคน (KPI)</h2>
      <table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ลากิจ (ครั้ง)</th><th>ลาป่วย (ครั้ง)</th><th>รวมวันลา</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={4} className="muted">ไม่มีข้อมูล</td></tr>}
          {list.map((k) => (
            <tr key={k.user_ID}>
              <td>{users[k.user_ID]?.full_name || k.user_ID}</td>
              <td>{k.personal}</td>
              <td>{k.sick}</td>
              <td><b>{k.days}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaveTable({ rows, showUser }) {
  return (
    <table className="tbl">
      <thead>
        <tr>{showUser && <th>พนักงาน</th>}<th>ประเภท</th><th>ช่วงวันที่</th><th>วัน</th><th>เหตุผล</th><th>สถานะ</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={6} className="muted">ยังไม่มีคำขอ</td></tr>}
        {rows.map((r) => (
          <tr key={r.leave_ID}>
            <td><span className={`badge ${r.type === "sick" ? "red" : "blue"} nodot`}>{TYPE_LABEL[r.type]}</span></td>
            <td>{r.date_from} → {r.date_to}</td>
            <td>{r.days}</td>
            <td className="muted">{r.reason || "—"}{r.medical_cert && " 📎"}</td>
            <td><span className={`badge ${ST[r.status].c}`}>{ST[r.status].t}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
