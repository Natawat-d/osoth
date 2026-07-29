"use client";
// HR: พนักงานทุก role + ตารางหมอประจำห้อง (รายสัปดาห์ทำซ้ำ + override รายวัน)
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import CrudPage from "@/components/CrudPage";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, todayStr, AsyncButton, ROLE_LABEL, fmtThaiDate } from "@/components/ui";
import { useBranches } from "@/components/useBranches";
import { exportCsv } from "@/lib/exportCsv";

const DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export default function HrPage() {
  const [branches, setBranches] = useState([]);
  useEffect(() => { api("/branches").then(setBranches); }, []);
  const branchOptions = branches.map((b) => ({ value: b.branch_ID, label: b.name }));
  const branchName = (id) => branches.find((b) => b.branch_ID === id)?.name || id || "-";

  return (
    <div>
      <ThroughputReport />
      <LoginManager />
      <CrudPage
        title="พนักงาน"
        endpoint="/users?active=all"
        idField="user_ID"
        transform={(s) => ({ ...s, commission_rate: +s.commission_rate || 0 })}
        fields={[
          { key: "full_name", label: "ชื่อ-สกุล" },
          { key: "nick_name", label: "ชื่อเล่น" },
          {
            key: "role", label: "ตำแหน่ง", type: "select",
            options: [
              { value: "super_admin", label: "ผู้ดูแลระบบ (super_admin)" },
              { value: "admin", label: "แอดมิน (admin)" },
              { value: "acception", label: "แผนกต้อนรับ (reception)" },
              { value: "sale", label: "ฝ่ายขาย (sale)" },
              { value: "BT", label: "บิวตี้เทอราปิสต์ (BT)" },
              { value: "doctor", label: "แพทย์ (doctor)" },
            ],
            render: (v) => ROLE_LABEL[v] || v,
          },
          { key: "email", label: "email", show: false },
          { key: "phone", label: "โทร", show: false },
          { key: "commission_rate", label: "คอม % (sale)", type: "number" },
          { key: "color", label: "สีปฏิทิน (หมอ)", show: false },
        ]}
      />
      <ScheduleEditor branches={branches} />
    </div>
  );
}

// เจ้าของระบบจัดการบัญชี login ของพนักงาน (ตั้ง username/รหัสเริ่มต้น · รีเซ็ต · เปิด/ปิด)
function LoginManager() {
  const auth = useSelector((s) => s.auth);
  const { branchName } = useBranches();
  const [users, setUsers] = useState([]);
  const [edit, setEdit] = useState(null); // { user, username, password }
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api("/users?active=all").then(setUsers).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (auth.user?.role !== "super_admin") return null;

  const openSet = (u) => { setMsg(""); setEdit({ user: u, username: u.username || "", password: "" }); };

  const saveLogin = async () => {
    setMsg("");
    try {
      await api(`/users/${edit.user.user_ID}/login`, {
        method: "POST",
        body: { username: edit.username.trim(), password: edit.password },
      });
      setEdit(null); load();
      setMsg(`ตั้ง login ให้ ${edit.user.full_name} แล้ว (พนักงานต้องเปลี่ยนรหัสครั้งแรก)`);
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const resetPw = async (u) => {
    const pw = prompt(`รีเซ็ตรหัสผ่านของ ${u.full_name}\nตั้งรหัสชั่วคราวใหม่ (พนักงานต้องเปลี่ยนเองครั้งแรก):`, "1234");
    if (pw == null) return;
    try { await api(`/users/${u.user_ID}/reset-password`, { method: "POST", body: { password: pw } }); load(); setMsg(`รีเซ็ตรหัส ${u.full_name} แล้ว`); }
    catch (e) { setMsg("❌ " + e.message); }
  };

  const toggle = async (u) => {
    try {
      if (u.login_active) await api(`/users/${u.user_ID}/login`, { method: "DELETE" });
      else await api(`/users/${u.user_ID}`, { method: "PUT", body: { login_active: true } });
      load();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  return (
    <div className="card">
      <h2><span className="h2-ico">🔐</span> บัญชีเข้าระบบพนักงาน (เจ้าของจัดการ)</h2>
      {msg && <div className="hint-box" style={{ marginBottom: 10 }}>{msg}</div>}
      <table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>username</th><th>สถานะ</th><th style={{ textAlign: "right" }}>จัดการ</th></tr></thead>
        <tbody>
          {users.filter((u) => u.active).map((u) => (
            <tr key={u.user_ID}>
              <td><b>{u.full_name}</b> <span className="muted">{u.nick_name}</span></td>
              <td><span className="badge gray nodot">{ROLE_LABEL[u.role] || u.role}</span></td>
              <td>{u.username ? <code>{u.username}</code> : <span className="muted">— ยังไม่ตั้ง —</span>}</td>
              <td>
                {!u.username ? <span className="badge gray nodot">ไม่มี login</span>
                  : !u.login_active ? <span className="badge red">ปิดใช้งาน</span>
                  : u.must_change_password ? <span className="badge gold nodot">ต้องเปลี่ยนรหัส</span>
                  : <span className="badge green">ใช้งานได้</span>}
              </td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <button className="btn small" onClick={() => openSet(u)}>{u.username ? "แก้ login" : "ตั้ง login"}</button>
                {u.username && <button className="btn small" onClick={() => resetPw(u)}>รีเซ็ตรหัส</button>}
                {u.username && <button className="btn small ghost" onClick={() => toggle(u)}>{u.login_active ? "ปิด" : "เปิด"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <div className="login-edit">
          <h2 style={{ marginTop: 4 }}>ตั้ง login — {edit.user.full_name}</h2>
          <div className="row">
            <div className="field"><label>username</label>
              <input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} placeholder="เช่น somchai" autoComplete="off" /></div>
            <div className="field"><label>รหัสผ่านเริ่มต้น</label>
              <input type="text" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="เช่น 1234" autoComplete="off" /></div>
          </div>
          <div className="muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>* พนักงานจะถูกบังคับเปลี่ยนรหัสเองเมื่อเข้าครั้งแรก</div>
          <div className="row">
            <button className="btn primary" onClick={saveLogin} disabled={edit.username.trim().length < 3 || edit.password.length < 4}>บันทึก login</button>
            <button className="btn ghost" onClick={() => setEdit(null)}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ThroughputReport() {
  const auth = useSelector((s) => s.auth);
  const isSuper = auth.user?.role === "super_admin";
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);

  // V2 สาขาเดียว — ยิงตามสาขาของ user (BR-001) เสมอ
  useEffect(() => {
    api(`/hr/throughput?branch_ID=${auth.branch_ID}&from=${from}&to=${to}`).then(setData).catch(() => setData(null));
  }, [auth.branch_ID, from, to]);

  return (
    <div className="card">
      <h2><span className="h2-ico">📊</span> อัตราการเข้าทำเคส — ใครทำอะไรบ้าง</h2>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><label>จาก</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label>ถึง</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="grow" />
        {data && <span className="badge gray nodot">รวม {data.total_cases} เคส</span>}
        {data && data.rows.length > 0 && (
          <button className="btn small" onClick={() => exportCsv(`อัตราทำเคส_${from}_${to}`, [
            { label: "พนักงาน", key: "name" }, { label: "ตำแหน่ง", value: (r) => ROLE_LABEL[r.role] || r.role },
            { label: "จำนวนเคส", key: "cases" },
            { label: "หัตถการ", value: (r) => r.procedures.map((p) => `${p.name} x${p.count}`).join("; ") },
            { label: "รายได้รวม", key: "total" },
          ], data.rows)}>⬇ ส่งออก CSV</button>
        )}
      </div>
      <table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>จำนวนเคส</th><th>หัตถการที่ทำ</th><th>รายได้รวม</th></tr></thead>
        <tbody>
          {(!data || data.rows.length === 0) && <tr><td colSpan={5} className="muted">ไม่มีข้อมูลในช่วงนี้</td></tr>}
          {data?.rows.map((r) => (
            <tr key={r.user_ID}>
              <td><b>{r.name}</b></td>
              <td><span className="badge gray nodot">{ROLE_LABEL[r.role] || r.role}</span></td>
              <td><b>{r.cases}</b></td>
              <td className="muted">
                {r.procedures.length
                  ? r.procedures.map((p) => `${p.name} ×${p.count}`).join(", ")
                  : (r.commissions ? `คอมมิชชั่น ${r.commissions} รายการ` : "—")}
              </td>
              <td>{money(r.total)}฿</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScheduleEditor({ branches = [] }) {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [doctor_ID, setDoctorID] = useState("");
  const [weekly, setWeekly] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/users?role=doctor").then(setDoctors);
    if (branch_ID)
      api(`/rooms?branch_ID=${branch_ID}`).then((r) => setRooms(r.filter((x) => x.active)));
  }, [branch_ID]);

  const loadSchedule = useCallback(async (docId) => {
    setDoctorID(docId);
    if (!docId) return;
    const list = await api(`/schedules?branch_ID=${branch_ID}&doctor_ID=${docId}`);
    setWeekly(list[0]?.weekly || []);
    setOverrides(list[0]?.overrides || []);
  }, [branch_ID]);

  const save = async () => {
    await api("/schedules", { method: "PUT", body: { branch_ID, doctor_ID, weekly, overrides } });
  };

  return (
    <div className="card">
      <h2>ตารางหมอประจำห้อง (รายสัปดาห์ ทำซ้ำ + override รายวัน)</h2>
      {error && <div className="err">{error}</div>}
      <div className="field" style={{ maxWidth: 300 }}>
        <label>เลือกหมอ</label>
        <select value={doctor_ID} onChange={(e) => loadSchedule(e.target.value)}>
          <option value="">—</option>
          {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
        </select>
      </div>
      {doctor_ID && (
        <>
          <h2 style={{ marginTop: 10 }}>ตารางประจำสัปดาห์</h2>
          {weekly.map((w, i) => (
            <div className="row" key={i} style={{ marginBottom: 6 }}>
              <div className="field">
                <label>วัน</label>
                <select value={w.day_of_week} onChange={(e) => upd(setWeekly, i, "day_of_week", +e.target.value)}>
                  {DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t("room")}</label>
                <select value={w.room_ID} onChange={(e) => upd(setWeekly, i, "room_ID", e.target.value)}>
                  <option value="">—</option>
                  {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                </select>
              </div>
              <div className="field"><label>เริ่ม</label>
                <input type="time" value={w.time_start} onChange={(e) => upd(setWeekly, i, "time_start", e.target.value)} /></div>
              <div className="field"><label>จบ</label>
                <input type="time" value={w.time_end} onChange={(e) => upd(setWeekly, i, "time_end", e.target.value)} /></div>
              <button className="btn small" onClick={() => setWeekly((s) => s.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => setWeekly((s) => [...s, { day_of_week: 1, room_ID: "", time_start: "10:00", time_end: "18:00" }])}>
            + วันทำงาน
          </button>

          <h2 style={{ marginTop: 14 }}>Override รายวัน (ลา / สลับห้อง)</h2>
          {overrides.map((o, i) => (
            <div className="row" key={i} style={{ marginBottom: 6 }}>
              <div className="field"><label>{t("date")}</label>
                <input type="date" value={o.date} onChange={(e) => upd(setOverrides, i, "date", e.target.value)} /></div>
              <div className="field">
                <label>ชนิด</label>
                <select value={o.type} onChange={(e) => upd(setOverrides, i, "type", e.target.value)}>
                  <option value="leave">ลา (ไม่อยู่ทั้งวัน)</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </div>
              {o.type === "custom" && (
                <>
                  <div className="field">
                    <label>{t("room")}</label>
                    <select value={o.room_ID || ""} onChange={(e) => upd(setOverrides, i, "room_ID", e.target.value)}>
                      <option value="">—</option>
                      {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>เริ่ม</label>
                    <input type="time" value={o.time_start || ""} onChange={(e) => upd(setOverrides, i, "time_start", e.target.value)} /></div>
                  <div className="field"><label>จบ</label>
                    <input type="time" value={o.time_end || ""} onChange={(e) => upd(setOverrides, i, "time_end", e.target.value)} /></div>
                </>
              )}
              <button className="btn small" onClick={() => setOverrides((s) => s.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => setOverrides((s) => [...s, { date: "", type: "leave" }])}>
            + override
          </button>
          <div style={{ marginTop: 12 }}>
            <AsyncButton className="btn primary" ok="บันทึกตารางแล้ว" onClick={save}>{t("save")}</AsyncButton>
          </div>
        </>
      )}
    </div>
  );
}

function upd(setter, i, field, value) {
  setter((s) => {
    const arr = [...s];
    arr[i] = { ...arr[i], [field]: value };
    return arr;
  });
}
