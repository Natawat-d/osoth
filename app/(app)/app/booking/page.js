"use client";
// ปฏิทิน (จองคิว) — V3 Bootstrap แท้: จอง + ขายคอร์สตอนจอง (sale/admin/owner)
// กริดปฏิทินเดิม (CalendarGrid) ห่อ .lgc · การ์ดจัดการคิว: เลื่อนนัด/ยกเลิก/เช็คอินมาถึง
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import MonthCalendar from "@/components/MonthCalendar";
import DayRoomGrid, { STATUS_META } from "@/components/DayRoomGrid";
import ImageInput from "@/components/ImageInput";
import InfoBox from "@/components/InfoBox";
import { api } from "@/lib/client";

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const addMinutes = (hhmm, mins) => {
  const [h, m] = (hhmm || "10:00").split(":").map(Number);
  const t = h * 60 + m + (mins || 60);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const STATUS_TH = {
  booked: ["จองแล้ว", "secondary"], arrived: ["มาถึง", "info"], ready: ["พร้อมทำ", "primary"],
  bt_stage: ["BT ทำ", "warning"], doctor_stage: ["หมอทำ", "danger"], done: ["เสร็จ", "success"],
  cancelled: ["ยกเลิก", "dark"], no_show: ["ไม่มา", "dark"],
};
const SBadge = ({ s }) => { const [l, c] = STATUS_TH[s] || [s, "light"]; return <span className={`badge text-bg-${c}`}>{l}</span>; };

export default function BookingPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
    info: (m) => dispatch(pushToast({ type: "info", message: m })),
  };
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [resched, setResched] = useState(null);
  const [monthEvents, setMonthEvents] = useState({}); // "YYYY-MM-DD" → ชิปคิว (สีตามสถานะ)
  const loadMonth = useCallback((ym) => {
    api(`/reserves?branch_ID=${branch_ID}&from=${ym}-01&to=${ym}-31`).then((rs) => {
      // ปฏิทินย่อ: เก็บแค่จำนวนคิวต่อวัน (รายละเอียดดูในตารางห้องหลังกดวัน)
      const m = {};
      for (const r of rs.filter((x) => !["cancelled", "no_show"].includes(x.status)))
        (m[r.date] = m[r.date] || []).push({});
      setMonthEvents(m);
    }).catch(() => {});
  }, [branch_ID]);
  useEffect(() => { if (branch_ID) loadMonth(date.slice(0, 7)); }, [branch_ID, date, loadMonth]);

  const [query, setQuery] = useState("");
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [custCourses, setCustCourses] = useState([]);
  const [form, setForm] = useState({
    customer_course_ID: "", sell_course_ID: "", room_ID: "", doctor_ID: "",
    time_start: "10:00", time_end: "11:00", nick_name: "", phone: "", is_walk_in: false, payment_slip: "",
  });

  const loadEvents = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then((r) =>
      setEvents(r.filter((e) => !["cancelled", "no_show"].includes(e.status)))).catch(() => {});
    api(`/schedules?branch_ID=${branch_ID}&date=${date}`).then(setRoster).catch(() => setRoster([]));
  }, [branch_ID, date]);
  useEffect(() => {
    if (!branch_ID) return;
    api(`/rooms?branch_ID=${branch_ID}`).then((r) => setRooms(r.filter((x) => x.active).sort((a, b) => a.order - b.order))).catch(() => {});
    api(`/users?role=doctor`).then(setDoctors).catch(() => {});
    api(`/courses`).then((c) => setCourses(c.filter((x) => x.active))).catch(() => {});
  }, [branch_ID]);
  useEffect(loadEvents, [loadEvents]);

  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roomDoctor = {};
  roster.forEach((s) => {
    const d = docById[s.doctor_ID];
    if (d && s.room_ID) roomDoctor[s.room_ID] = { name: d.nick_name || d.full_name, color: d.color };
  });
  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;

  const durationFor = () => {
    const cc = custCourses.find((c) => c.customer_course_ID === form.customer_course_ID);
    if (cc?.course_snapshot?.duration_minutes) return cc.course_snapshot.duration_minutes;
    const sc = courses.find((c) => c.course_ID === form.sell_course_ID);
    return sc?.duration_minutes || 60;
  };
  const setStart = (start) => setForm((f) => ({ ...f, time_start: start, time_end: addMinutes(start, durationFor()) }));

  const search = async () => {
    const found = await api(`/customers?q=${encodeURIComponent(query)}`);
    setFoundCustomers(found); setPickedCustomer(null); setCustCourses([]);
    if (found.length === 0) toast.info("ไม่พบลูกค้าตามคำค้น");
  };
  const pickCustomer = async (c) => {
    setPickedCustomer(c);
    setForm((f) => ({ ...f, nick_name: c.nick_name, phone: c.phone }));
    setCustCourses(await api(`/customer-courses?HN=${c.HN_number}&status=active`));
  };

  const book = async () => {
    try {
      let ccId = form.customer_course_ID || null;
      if (form.sell_course_ID) { // ขายคอร์สตอนจอง (ยังไม่จ่าย — จ่ายเต็มที่ OPD)
        const res = await api("/customer-courses", {
          method: "POST",
          body: { branch_ID, HN_number: pickedCustomer?.HN_number || null, reserve_contact: { nick_name: form.nick_name, phone: form.phone }, course_ID: form.sell_course_ID, first_payment: null },
        });
        ccId = res.customer_course.customer_course_ID;
      }
      await api("/reserves", {
        method: "POST",
        body: {
          branch_ID, HN_number: pickedCustomer?.HN_number || null,
          contact: { nick_name: form.nick_name, phone: form.phone },
          customer_course_ID: ccId, date, time_start: form.time_start, time_end: form.time_end,
          room_ID: form.room_ID, doctor_ID: form.doctor_ID || null, is_walk_in: form.is_walk_in,
          payment_slip: form.payment_slip || "",
        },
      });
      toast.success("จองคิวสำเร็จ");
      setForm((f) => ({ ...f, nick_name: "", phone: "", customer_course_ID: "", sell_course_ID: "", payment_slip: "" }));
      setPickedCustomer(null);
      loadEvents();
    } catch (e) { toast.error(e.message); }
  };

  const changeStatus = async (rs, status, msg) => {
    try {
      await api(`/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status } });
      toast.success(msg); setSelected(null); loadEvents();
    } catch (e) { toast.error(e.message); }
  };
  const doReschedule = async () => {
    try {
      await api(`/reserves/${selected.reserve_ID}`, { method: "PUT", body: { reschedule: { ...resched } } });
      toast.success("เลื่อนนัดแล้ว"); setResched(null); setSelected(null); loadEvents();
    } catch (e) { toast.error(e.message); }
  };

  const counts = useMemo(() => ({
    total: events.length,
    waiting: events.filter((e) => e.status === "booked").length,
    arrived: events.filter((e) => e.status === "arrived").length,
    done: events.filter((e) => e.status === "done").length,
  }), [events]);

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-2 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">ปฏิทิน (จองคิว)</h4>
          <span className="text-muted small">คลิกช่องว่าง = เลือกห้อง/เวลา · คลิกคิว = จัดการ</span>
          <input type="date" className="form-control form-control-sm ms-auto" style={{ width: 150 }}
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row g-2 mb-3">
          <div className="col-md-3 col-6"><InfoBox ico="bi-calendar2-week" label="คิววันนี้" value={counts.total} color="primary" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-hourglass-split" label="รอรับ" value={counts.waiting} color="secondary" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-person-check" label="มาถึงแล้ว" value={counts.arrived} color="info" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-check2-circle" label="เสร็จ" value={counts.done} color="success" /></div>
        </div>

        <div className="row g-3">
          {/* ซ้าย: กริดปฏิทินเดิม (ห่อ .lgc) + การ์ดจัดการคิว */}
          <div className="col-lg-8">
            {/* ปฏิทินเดือน (ref AdminLTE) → คลิกวัน → ตารางแยกห้องด้านล่าง */}
            <MonthCalendar value={date} onSelect={setDate} onMonthChange={loadMonth} events={monthEvents} compact
              headerExtra={<span className="badge text-bg-light border">คิววันที่เลือก {events.length}</span>} />

            <div className="card shadow-sm mt-3">
              <div className="card-header py-2 d-flex align-items-center flex-wrap gap-2">
                <span className="fw-semibold"><i className="bi bi-columns-gap me-1 text-primary" />ตารางห้อง · {date.split("-").reverse().join("/")}</span>
                <span className="text-muted small">คลิกช่องว่าง = เลือกห้อง/เวลา · คลิกคิว = จัดการ</span>
                <span className="ms-auto d-flex gap-2 flex-wrap">
                  {Object.entries(STATUS_META).filter(([k]) => k !== "consulting").map(([k, v]) => (
                    <span key={k} className="d-inline-flex align-items-center gap-1 small text-muted">
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: v.color, display: "inline-block" }} />{v.label}
                    </span>
                  ))}
                </span>
              </div>
              <div className="card-body p-2">
                <DayRoomGrid rooms={rooms} events={events} roomDoctor={roomDoctor} selectedId={selected?.reserve_ID}
                             onEventClick={setSelected}
                             onSlotClick={(room_ID, time) => { setForm((f) => ({ ...f, room_ID })); setStart(time); }} />
              </div>
            </div>

            {selected && (
              <div className="card shadow-sm mt-3">
                <div className="card-header py-2 d-flex align-items-center gap-2">
                  <b>{selected.contact?.nick_name || selected.HN_number || selected.reserve_ID}</b>
                  <span className="text-muted small">{roomName(selected.room_ID)} · {selected.time_start}–{selected.time_end}</span>
                  <span className="ms-auto"><SBadge s={selected.status} /></span>
                  <button className="btn-close" onClick={() => { setSelected(null); setResched(null); }} />
                </div>
                <div className="card-body py-3">
                  {selected.payment_slip && (
                    <a href={selected.payment_slip} target="_blank" rel="noreferrer" className="d-inline-block mb-2">
                      <img src={selected.payment_slip} alt="สลิป" className="rounded border" style={{ maxWidth: 140, maxHeight: 180 }} />
                    </a>
                  )}
                  <div className="d-flex gap-2 flex-wrap">
                    {selected.status === "booked" && (
                      <button className="btn btn-info btn-sm text-white" onClick={() => changeStatus(selected, "arrived", "บันทึกลูกค้ามาถึงแล้ว")}>
                        <i className="bi bi-person-check me-1" /> ลูกค้ามาถึง
                      </button>
                    )}
                    {["booked", "arrived"].includes(selected.status) && (
                      <>
                        <button className="btn btn-outline-primary btn-sm"
                                onClick={() => setResched({ date: selected.date, time_start: selected.time_start, time_end: selected.time_end, room_ID: selected.room_ID })}>
                          <i className="bi bi-clock-history me-1" /> เลื่อนนัด
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => changeStatus(selected, "no_show", "บันทึกไม่มาตามนัด")}>ไม่มาตามนัด</button>
                      </>
                    )}
                    {!["done", "cancelled", "no_show"].includes(selected.status) && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => changeStatus(selected, "cancelled", "ยกเลิกการจองแล้ว")}>✕ ยกเลิกการจอง</button>
                    )}
                    <a className="btn btn-primary btn-sm ms-auto" href="/app/reception">รับลูกค้า/เปิดเคส →</a>
                  </div>

                  {resched && (
                    <div className="border rounded-3 p-3 mt-3 bg-light">
                      <b className="small">เลื่อนนัด — เลือกวัน/เวลา/ห้องใหม่</b>
                      <div className="row g-2 mt-1 align-items-end">
                        <div className="col-md-3"><label className="form-label small mb-1">วันใหม่</label>
                          <input type="date" className="form-control form-control-sm" value={resched.date} onChange={(e) => setResched((r) => ({ ...r, date: e.target.value }))} /></div>
                        <div className="col-md-2"><label className="form-label small mb-1">เริ่ม</label>
                          <input type="time" className="form-control form-control-sm" value={resched.time_start} onChange={(e) => setResched((r) => ({ ...r, time_start: e.target.value, time_end: addMinutes(e.target.value, 60) }))} /></div>
                        <div className="col-md-2"><label className="form-label small mb-1">จบ</label>
                          <input type="time" className="form-control form-control-sm" value={resched.time_end} onChange={(e) => setResched((r) => ({ ...r, time_end: e.target.value }))} /></div>
                        <div className="col-md-3"><label className="form-label small mb-1">ห้อง</label>
                          <select className="form-select form-select-sm" value={resched.room_ID} onChange={(e) => setResched((r) => ({ ...r, room_ID: e.target.value }))}>
                            {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                          </select></div>
                        <div className="col-md-2"><button className="btn btn-primary btn-sm d-block ms-auto px-4" onClick={doReschedule}>ยืนยัน</button></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ขวา: ค้นลูกค้า + จอง */}
          <div className="col-lg-4">
            <div className="card shadow-sm mb-3">
              <div className="card-header py-2 fw-semibold"><i className="bi bi-search me-1 text-primary" />ค้นหาลูกค้า</div>
              <div className="card-body py-3">
                <div className="input-group input-group-sm mb-2">
                  <input className="form-control" value={query} placeholder="HN / ชื่อ / เบอร์โทร"
                         onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
                  <button className="btn btn-primary" onClick={search}>ค้นหา</button>
                </div>
                {foundCustomers.map((c) => (
                  <button key={c.HN_number}
                          className={`btn btn-sm d-block ms-auto px-4 text-start mb-1 ${pickedCustomer?.HN_number === c.HN_number ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => pickCustomer(c)}>
                    <b>{c.HN_number}</b> · {c.full_name} <span className="opacity-75">({c.nick_name})</span>
                  </button>
                ))}
                {pickedCustomer && custCourses.length > 0 && (
                  <div className="mt-2 small">
                    <div className="text-muted mb-1">คอร์สค้างของ {pickedCustomer.nick_name}:</div>
                    {custCourses.map((cc) => (
                      <div key={cc.customer_course_ID} className="form-check">
                        <input type="radio" className="form-check-input" name="cc" id={cc.customer_course_ID}
                               checked={form.customer_course_ID === cc.customer_course_ID}
                               onChange={() => setForm((f) => ({ ...f, customer_course_ID: cc.customer_course_ID, sell_course_ID: "", time_end: addMinutes(f.time_start, cc.course_snapshot?.duration_minutes || 60) }))} />
                        <label className="form-check-label" htmlFor={cc.customer_course_ID}>
                          {cc.course_snapshot?.name} · เหลือ {cc.uses_remaining}/{cc.uses_total}
                          {cc.balance_due > 0 && <span className="badge text-bg-warning ms-1">ค้าง {money(cc.balance_due)}฿</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-header py-2 fw-semibold"><i className="bi bi-calendar-plus me-1 text-primary" />จองคิว + เลือกคอร์ส</div>
              <div className="card-body py-3">
                {!pickedCustomer && (
                  <div className="row g-2 mb-2">
                    <div className="col-6"><label className="form-label small mb-1">ชื่อเล่น (ลูกค้าใหม่)</label>
                      <input className="form-control form-control-sm" value={form.nick_name} onChange={(e) => setForm((f) => ({ ...f, nick_name: e.target.value }))} /></div>
                    <div className="col-6"><label className="form-label small mb-1">เบอร์โทร</label>
                      <input className="form-control form-control-sm" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                  </div>
                )}
                <label className="form-label small mb-1">คอร์ส (ผูกกับการจอง — ขายตอนจองได้)</label>
                <select className="form-select form-select-sm mb-2"
                        value={form.customer_course_ID ? `cc:${form.customer_course_ID}` : form.sell_course_ID ? `sell:${form.sell_course_ID}` : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith("cc:")) {
                            const id = v.slice(3);
                            const cc = custCourses.find((c) => c.customer_course_ID === id);
                            setForm((f) => ({ ...f, customer_course_ID: id, sell_course_ID: "", time_end: addMinutes(f.time_start, cc?.course_snapshot?.duration_minutes || 60) }));
                          } else if (v.startsWith("sell:")) {
                            const id = v.slice(5);
                            const c = courses.find((x) => x.course_ID === id);
                            setForm((f) => ({ ...f, sell_course_ID: id, customer_course_ID: "", time_end: addMinutes(f.time_start, c?.duration_minutes || 60) }));
                          } else setForm((f) => ({ ...f, customer_course_ID: "", sell_course_ID: "" }));
                        }}>
                  <option value="">— ไม่ผูก (เลือกตอน OPD ได้) —</option>
                  {custCourses.length > 0 && <optgroup label="คอร์สเดิมของลูกค้า">
                    {custCourses.map((cc) => <option key={cc.customer_course_ID} value={`cc:${cc.customer_course_ID}`}>{cc.course_snapshot?.name} · เหลือ {cc.uses_remaining}/{cc.uses_total}</option>)}
                  </optgroup>}
                  <optgroup label="ขายคอร์สใหม่ (จ่ายเต็มที่ OPD)">
                    {courses.map((c) => <option key={c.course_ID} value={`sell:${c.course_ID}`}>{c.name} · {money(c.price)}฿ · {c.quantity_used} ครั้ง</option>)}
                  </optgroup>
                </select>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small mb-1">ห้อง *</label>
                    <select className="form-select form-select-sm" value={form.room_ID} onChange={(e) => setForm((f) => ({ ...f, room_ID: e.target.value }))}>
                      <option value="">—</option>
                      {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                    </select></div>
                  <div className="col-6"><label className="form-label small mb-1">หมอ</label>
                    <select className="form-select form-select-sm" value={form.doctor_ID} onChange={(e) => setForm((f) => ({ ...f, doctor_ID: e.target.value }))}>
                      <option value="">— ไม่ระบุ —</option>
                      {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
                    </select></div>
                  <div className="col-6"><label className="form-label small mb-1">เริ่ม</label>
                    <input type="time" className="form-control form-control-sm" value={form.time_start} onChange={(e) => setStart(e.target.value)} /></div>
                  <div className="col-6"><label className="form-label small mb-1">จบ (อัตโนมัติ)</label>
                    <input type="time" className="form-control form-control-sm" value={form.time_end} onChange={(e) => setForm((f) => ({ ...f, time_end: e.target.value }))} /></div>
                </div>
                <div className="form-check mb-2">
                  <input type="checkbox" className="form-check-input" id="walkin" checked={form.is_walk_in} onChange={(e) => setForm((f) => ({ ...f, is_walk_in: e.target.checked }))} />
                  <label className="form-check-label small" htmlFor="walkin">Walk-in (ไม่ได้จองล่วงหน้า)</label>
                </div>
                <div className="lgc mb-2">
                  <ImageInput label="แนบสลิปจ่ายเงินจอง (ถ้ามี)" value={form.payment_slip} onChange={(v) => setForm((f) => ({ ...f, payment_slip: v }))} />
                </div>
                <div className="text-muted mb-2" style={{ fontSize: 11 }}>จองไม่ต้องจ่าย · จ่ายค่าคอร์สเต็มจำนวนก่อนทำหัตถการที่ OPD</div>
                <button className="btn btn-primary d-block ms-auto px-4" disabled={!form.room_ID} onClick={book}>
                  <i className="bi bi-calendar-check me-1" /> จองคิว
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
