"use client";
// ตารางหมอ V3.1 (Bootstrap) — ลงเวรเป็น "ช่วงวันที่": วันไหนถึงวันไหน เวลาอะไร ห้องอะไร
// หมอ 1 คนหลายช่วงได้ · มี override รายวัน (ลา/สลับห้อง) ชนะช่วง
import { useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import MonthCalendar from "@/components/MonthCalendar";

const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function ScheduleRanges() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [monthSel, setMonthSel] = useState(todayStr());
  const [doctor_ID, setDoctorID] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ date_start: todayStr(), date_end: todayStr(), time_start: "10:00", time_end: "18:00", room_ID: "", note: "" });
  const [ovDraft, setOvDraft] = useState({ date: todayStr(), type: "leave", room_ID: "", time_start: "10:00", time_end: "18:00" });

  const loadAll = useCallback(() => {
    if (branch_ID) api(`/schedules?branch_ID=${branch_ID}`).then(setAllSchedules).catch(() => {});
  }, [branch_ID]);
  useEffect(() => {
    api("/users?role=doctor").then(setDoctors).catch(() => {});
    if (branch_ID) api(`/rooms?branch_ID=${branch_ID}`).then((r) => setRooms(r.filter((x) => x.active))).catch(() => {});
    loadAll();
  }, [branch_ID, loadAll]);

  // month view: เวรหมอทุกคน → ชิปต่อวัน (สีตามหมอ)
  const docMap = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const monthEvents = {};
  for (const s of allSchedules) {
    const doc = docMap[s.doctor_ID];
    if (!doc) continue;
    for (const a of s.assignments || []) {
      const start = new Date(`${a.date_start}T00:00:00`);
      const end = new Date(`${a.date_end}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const leave = (s.overrides || []).some((o) => o.date === key && o.type === "leave");
        if (leave) continue;
        (monthEvents[key] = monthEvents[key] || []).push({
          label: `${doc.nick_name || doc.full_name} ${a.time_start}`,
          color: doc.color || "#1560a3",
        });
      }
    }
  }

  const load = useCallback(async (docId) => {
    setDoctorID(docId);
    if (!docId) { setAssignments([]); setOverrides([]); return; }
    const list = await api(`/schedules?branch_ID=${branch_ID}&doctor_ID=${docId}`);
    setAssignments(list[0]?.assignments || []);
    setOverrides(list[0]?.overrides || []);
  }, [branch_ID]);

  const save = async (nextA = assignments, nextO = overrides) => {
    setBusy(true);
    try {
      await api("/schedules", { method: "PUT", body: { branch_ID, doctor_ID, assignments: nextA, overrides: nextO } });
      setAssignments(nextA); setOverrides(nextO);
      loadAll();
      toast.success("บันทึกตารางเวรแล้ว");
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const addRange = () => {
    if (!draft.room_ID) return toast.error("เลือกห้องก่อน");
    if (draft.date_start > draft.date_end) return toast.error("วันเริ่มต้องไม่เกินวันจบ");
    if (draft.time_start >= draft.time_end) return toast.error("เวลาเริ่มต้องน้อยกว่าเวลาจบ");
    save([...assignments, { ...draft }]);
  };
  const removeRange = (i) => save(assignments.filter((_, j) => j !== i));
  const addOverride = () => {
    if (ovDraft.type === "custom" && !ovDraft.room_ID) return toast.error("เลือกห้องของวันนั้น");
    const o = ovDraft.type === "leave"
      ? { date: ovDraft.date, type: "leave", room_ID: null, time_start: null, time_end: null }
      : { ...ovDraft };
    save(assignments, [...overrides.filter((x) => x.date !== o.date), o]);
  };
  const removeOverride = (i) => save(assignments, overrides.filter((_, j) => j !== i));

  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;
  const doctor = doctors.find((d) => d.user_ID === doctor_ID);
  const days = (a) => Math.round((new Date(a.date_end) - new Date(a.date_start)) / 86400000) + 1;

  return (
    <>
    {/* ปฏิทินเวรหมอทั้งเดือน (สีตามหมอ · ลาแล้วไม่โชว์) */}
    <div className="mb-3">
      <MonthCalendar value={monthSel} onSelect={setMonthSel} events={monthEvents} maxChips={4}
        headerExtra={<span className="d-flex gap-2 flex-wrap">{doctors.map((d) => (
          <span key={d.user_ID} className="d-inline-flex align-items-center gap-1 small text-muted">
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, display: "inline-block" }} />{d.nick_name || d.full_name}
          </span>))}</span>} />
    </div>
    <div className="row g-3">
      {/* ซ้าย: เลือกหมอ */}
      <div className="col-lg-3">
        <div className="card shadow-sm">
          <div className="card-header py-2 fw-semibold"><i className="bi bi-person-badge me-1 text-primary" />เลือกหมอ</div>
          <div className="list-group list-group-flush">
            {doctors.map((d) => (
              <button key={d.user_ID}
                      className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${doctor_ID === d.user_ID ? "active" : ""}`}
                      onClick={() => load(d.user_ID)}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                {d.full_name}
              </button>
            ))}
            {!doctors.length && <div className="list-group-item text-muted small">— ยังไม่มีหมอ — เพิ่มที่แท็บพนักงาน</div>}
          </div>
        </div>
      </div>

      {/* ขวา: ช่วงเวร + ยกเว้นรายวัน */}
      <div className="col-lg-9">
        {!doctor_ID ? (
          <div className="card shadow-sm">
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-person-badge fs-2 d-block mb-2 opacity-50" />
              <div className="fw-semibold">เลือกหมอจากรายชื่อด้านซ้าย</div>
              <div className="small">เพื่อดู/ลงช่วงเวร และตั้งวันลา-สลับห้องรายวัน</div>
            </div>
          </div>
        ) : (
          <>
            <div className="card shadow-sm mb-3">
              <div className="card-header py-2 d-flex align-items-center">
                <span className="fw-semibold"><i className="bi bi-calendar-range me-1 text-primary" />ช่วงเวรของ {doctor?.full_name}</span>
                <span className="badge bg-body-tertiary text-body-secondary border ms-2">{assignments.length} ช่วง</span>
              </div>
              <div className="card-body py-3">
                {/* ฟอร์มเพิ่มช่วง: วันไหน–ถึงวันไหน เวลา ห้อง */}
                <div className="row g-2 align-items-end border rounded-3 p-2 bg-body-tertiary mb-3">
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">ตั้งแต่วันที่</label>
                    <input type="date" className="form-control form-control-sm" value={draft.date_start}
                           onChange={(e) => setDraft((s) => ({ ...s, date_start: e.target.value, date_end: s.date_end < e.target.value ? e.target.value : s.date_end }))} />
                  </div>
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">ถึงวันที่</label>
                    <input type="date" className="form-control form-control-sm" value={draft.date_end} min={draft.date_start}
                           onChange={(e) => setDraft((s) => ({ ...s, date_end: e.target.value }))} />
                  </div>
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">เวลาเริ่ม</label>
                    <input type="time" className="form-control form-control-sm" value={draft.time_start} onChange={(e) => setDraft((s) => ({ ...s, time_start: e.target.value }))} />
                  </div>
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">ถึงเวลา</label>
                    <input type="time" className="form-control form-control-sm" value={draft.time_end} onChange={(e) => setDraft((s) => ({ ...s, time_end: e.target.value }))} />
                  </div>
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">ห้อง</label>
                    <select className="form-select form-select-sm" value={draft.room_ID} onChange={(e) => setDraft((s) => ({ ...s, room_ID: e.target.value }))}>
                      <option value="">—</option>
                      {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2 col-6 text-end">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={addRange}>
                      <i className="bi bi-plus-lg me-1" />เพิ่มช่วงเวร
                    </button>
                  </div>
                </div>

                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>ช่วงวันที่</th><th className="text-center">จำนวนวัน</th><th>เวลา</th><th>ห้อง</th><th /></tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, i) => (
                      <tr key={i} className={a.date_end < todayStr() ? "opacity-50" : ""}>
                        <td><b>{fmtD(a.date_start)}</b> → <b>{fmtD(a.date_end)}</b>{a.date_end < todayStr() && <span className="badge text-bg-secondary ms-2">ผ่านแล้ว</span>}</td>
                        <td className="text-center">{days(a)} วัน</td>
                        <td>{a.time_start}–{a.time_end}</td>
                        <td><span className="badge bg-body-tertiary text-body-secondary border">{roomName(a.room_ID)}</span></td>
                        <td className="text-end">
                          <button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => removeRange(i)} title="ลบช่วงนี้">
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!assignments.length && <tr><td colSpan={5} className="text-center text-muted py-4">— ยังไม่ได้ลงเวร — เพิ่มช่วงจากฟอร์มด้านบน</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ยกเว้นรายวัน */}
            <div className="card shadow-sm">
              <div className="card-header py-2 fw-semibold"><i className="bi bi-calendar-x me-1 text-warning" />ยกเว้นรายวัน (ลา / สลับห้อง-เวลาเฉพาะวัน)</div>
              <div className="card-body py-3">
                <div className="row g-2 align-items-end border rounded-3 p-2 bg-body-tertiary mb-3">
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">วันที่</label>
                    <input type="date" className="form-control form-control-sm" value={ovDraft.date} onChange={(e) => setOvDraft((s) => ({ ...s, date: e.target.value }))} />
                  </div>
                  <div className="col-md-2 col-6">
                    <label className="form-label small mb-1">ประเภท</label>
                    <select className="form-select form-select-sm" value={ovDraft.type} onChange={(e) => setOvDraft((s) => ({ ...s, type: e.target.value }))}>
                      <option value="leave">ลา (ไม่อยู่)</option>
                      <option value="custom">สลับห้อง/เวลา</option>
                    </select>
                  </div>
                  {ovDraft.type === "custom" && (
                    <>
                      <div className="col-md-2 col-6">
                        <label className="form-label small mb-1">เวลาเริ่ม</label>
                        <input type="time" className="form-control form-control-sm" value={ovDraft.time_start} onChange={(e) => setOvDraft((s) => ({ ...s, time_start: e.target.value }))} />
                      </div>
                      <div className="col-md-2 col-6">
                        <label className="form-label small mb-1">ถึงเวลา</label>
                        <input type="time" className="form-control form-control-sm" value={ovDraft.time_end} onChange={(e) => setOvDraft((s) => ({ ...s, time_end: e.target.value }))} />
                      </div>
                      <div className="col-md-2 col-6">
                        <label className="form-label small mb-1">ห้อง</label>
                        <select className="form-select form-select-sm" value={ovDraft.room_ID || ""} onChange={(e) => setOvDraft((s) => ({ ...s, room_ID: e.target.value }))}>
                          <option value="">—</option>
                          {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="col text-end">
                    <button className="btn btn-outline-primary btn-sm" disabled={busy} onClick={addOverride}>
                      <i className="bi bi-plus-lg me-1" />เพิ่ม
                    </button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {overrides.map((o, i) => (
                    <span key={i} className={`badge d-inline-flex align-items-center gap-1 ${o.type === "leave" ? "text-bg-warning" : "text-bg-info"}`}>
                      {fmtD(o.date)} · {o.type === "leave" ? "ลา" : `${roomName(o.room_ID)} ${o.time_start}–${o.time_end}`}
                      <button className="border-0 bg-transparent p-0 ms-1" style={{ lineHeight: 1, color: "inherit", cursor: "pointer" }}
                              title="ลบรายการนี้" onClick={() => removeOverride(i)}><i className="bi bi-x-lg" style={{ fontSize: 10 }} /></button>
                    </span>
                  ))}
                  {!overrides.length && <span className="text-muted small">— ไม่มี —</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
