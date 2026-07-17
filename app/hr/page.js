"use client";
// HR: พนักงานทุก role + ตารางหมอประจำห้อง (รายสัปดาห์ทำซ้ำ + override รายวัน)
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import CrudPage from "@/components/CrudPage";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, todayStr } from "@/components/ui";

const DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export default function HrPage() {
  const [branches, setBranches] = useState([]);
  useEffect(() => { api("/branches").then(setBranches); }, []);
  const branchOptions = branches.map((b) => ({ value: b.branch_ID, label: b.name }));

  return (
    <div>
      <ThroughputReport />
      <CrudPage
        title="พนักงาน (แก้ 'สาขา' = ย้ายสาขา · ประวัติเงินเดิมยังอยู่)"
        endpoint="/users?active=all"
        idField="user_ID"
        transform={(s) => ({ ...s, commission_rate: +s.commission_rate || 0 })}
        fields={[
          { key: "full_name", label: "ชื่อ-สกุล" },
          { key: "nick_name", label: "ชื่อเล่น" },
          {
            key: "role", label: "role", type: "select",
            options: [
              { value: "super_admin", label: "super_admin" },
              { value: "admin", label: "admin" },
              { value: "acception", label: "acception" },
              { value: "sale", label: "sale" },
              { value: "BT", label: "BT" },
              { value: "doctor", label: "หมอ" },
            ],
          },
          { key: "branch_ID", label: "สาขา", type: "select", options: () => branchOptions },
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

function ThroughputReport() {
  const auth = useSelector((s) => s.auth);
  const isSuper = auth.user?.role === "super_admin";
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [branch, setBranch] = useState(isSuper ? "all" : auth.branch_ID);
  const [branches, setBranches] = useState([]);
  const [data, setData] = useState(null);

  useEffect(() => { api("/branches").then(setBranches).catch(() => {}); }, []);
  useEffect(() => {
    const b = isSuper ? branch : auth.branch_ID;
    api(`/hr/throughput?branch_ID=${b}&from=${from}&to=${to}`).then(setData).catch(() => setData(null));
  }, [isSuper, branch, auth.branch_ID, from, to]);

  return (
    <div className="card">
      <h2><span className="h2-ico">📊</span> อัตราการเข้าทำเคส — ใครทำอะไรบ้าง</h2>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><label>จาก</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label>ถึง</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {isSuper && (
          <div className="field" style={{ margin: 0 }}>
            <label>สาขา</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="all">รวมทุกสาขา</option>
              {branches.map((b) => <option key={b.branch_ID} value={b.branch_ID}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div className="grow" />
        {data && <span className="badge gray nodot">รวม {data.total_cases} เคส</span>}
      </div>
      <table className="tbl">
        <thead><tr><th>พนักงาน</th><th>role</th><th>จำนวนเคส</th><th>หัตถการที่ทำ</th><th>รายได้รวม</th></tr></thead>
        <tbody>
          {(!data || data.rows.length === 0) && <tr><td colSpan={5} className="muted">ไม่มีข้อมูลในช่วงนี้</td></tr>}
          {data?.rows.map((r) => (
            <tr key={r.user_ID}>
              <td><b>{r.name}</b></td>
              <td><span className="badge gray nodot">{r.role}</span></td>
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

function ScheduleEditor({ branches }) {
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
    setError("");
    try {
      await api("/schedules", {
        method: "PUT",
        body: { branch_ID, doctor_ID, weekly, overrides },
      });
      alert("บันทึกตารางแล้ว ✓");
    } catch (e) { setError(e.message); }
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
            <button className="btn primary" onClick={save}>{t("save")}</button>
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
