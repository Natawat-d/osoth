"use client";
// ปฏิทิน (sale): ซ้าย = ปฏิทินคิว, ขวา = ค้นลูกค้า / ขาย course / จองคิว
// filter หา HN → เห็น course ค้าง เหลือกี่ครั้ง → กดจอง → กันจองซ้อนที่ API
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import CalendarGrid from "@/components/CalendarGrid";
import { StatusBadge, Stepper, todayStr, money } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

const FLOW_STEPS = [
  { key: "booked", label: "จองแล้ว" },
  { key: "arrived", label: "มาถึง" },
  { key: "ready", label: "พร้อมทำ" },
  { key: "in_progress", label: "กำลังทำ" },
  { key: "done", label: "เสร็จ" },
];
const NEXT = {
  booked: ["arrived", "cancelled", "no_show"],
  arrived: ["ready", "cancelled"],
  ready: ["in_progress"],
  in_progress: [],
  done: [], cancelled: [], no_show: [],
};

export default function SaleCalendarPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState("");
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [custCourses, setCustCourses] = useState([]);

  const [form, setForm] = useState({
    customer_course_ID: "", room_ID: "", doctor_ID: "",
    time_start: "10:00", time_end: "11:00", nick_name: "", phone: "", is_walk_in: false,
  });
  const [sellForm, setSellForm] = useState({ course_ID: "", amount: "", method: "cash" });

  const loadEvents = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then((r) =>
      setEvents(r.filter((e) => !["cancelled", "no_show"].includes(e.status)))
    );
    api(`/schedules?branch_ID=${branch_ID}&date=${date}`).then(setRoster).catch(() => setRoster([]));
  }, [branch_ID, date]);

  useEffect(() => {
    if (!branch_ID) return;
    api(`/rooms?branch_ID=${branch_ID}`).then((r) =>
      setRooms(r.filter((x) => x.active).sort((a, b) => a.order - b.order))
    );
    api(`/users?role=doctor`).then(setDoctors);
    api(`/courses`).then((c) => setCourses(c.filter((x) => x.active)));
  }, [branch_ID]);
  useEffect(loadEvents, [loadEvents]);

  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roomDoctor = {};
  roster.forEach((s) => {
    const d = docById[s.doctor_ID];
    if (d && s.room_ID) roomDoctor[s.room_ID] = { name: d.nick_name || d.full_name, color: d.color };
  });

  const search = async () => {
    setError("");
    const found = await api(`/customers?q=${encodeURIComponent(query)}`);
    setFoundCustomers(found);
    setPickedCustomer(null);
    setCustCourses([]);
  };

  const pickCustomer = async (c) => {
    setPickedCustomer(c);
    setForm((f) => ({ ...f, nick_name: c.nick_name, phone: c.phone }));
    setCustCourses(await api(`/customer-courses?HN=${c.HN_number}&status=active`));
  };

  const sellCourse = async () => {
    setError("");
    try {
      const body = {
        branch_ID,
        HN_number: pickedCustomer?.HN_number || null,
        reserve_contact: pickedCustomer
          ? { nick_name: pickedCustomer.nick_name, phone: pickedCustomer.phone }
          : { nick_name: form.nick_name, phone: form.phone },
        course_ID: sellForm.course_ID,
        first_payment: sellForm.amount
          ? { amount: Number(sellForm.amount), method: sellForm.method }
          : null,
      };
      const res = await api("/customer-courses", { method: "POST", body });
      if (pickedCustomer) pickCustomer(pickedCustomer);
      setForm((f) => ({ ...f, customer_course_ID: res.customer_course.customer_course_ID }));
      alert(`ขาย course สำเร็จ: ${res.customer_course.customer_course_ID}`);
    } catch (e) { setError(e.message); }
  };

  const book = async () => {
    setError("");
    try {
      await api("/reserves", {
        method: "POST",
        body: {
          branch_ID,
          HN_number: pickedCustomer?.HN_number || null,
          contact: { nick_name: form.nick_name, phone: form.phone },
          customer_course_ID: form.customer_course_ID || null,
          date, time_start: form.time_start, time_end: form.time_end,
          room_ID: form.room_ID, doctor_ID: form.doctor_ID || null,
          is_walk_in: form.is_walk_in,
        },
      });
      loadEvents();
    } catch (e) { setError(e.message); }
  };

  const changeStatus = async (rs, status) => {
    setError("");
    try {
      await api(`/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status } });
      setSelected(null);
      loadEvents();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <div className="toolbar">
          <div className="field" style={{ margin: 0 }}>
            <label>{t("date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grow" />
          <span className="muted">คลิกช่องว่างเพื่อเลือกห้อง/เวลา · คลิกคิวเพื่อจัดการ</span>
        </div>
        {error && <div className="err">{error}</div>}
        <CalendarGrid
          rooms={rooms}
          events={events}
          doctors={doctors}
          roomDoctor={roomDoctor}
          onEventClick={setSelected}
          onSlotClick={(room_ID, time) => setForm((f) => ({ ...f, room_ID, time_start: time }))}
        />

        {selected && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2>
              <span className="h2-ico">🎫</span>
              {selected.contact?.nick_name || selected.HN_number || selected.reserve_ID}
              <span className="muted" style={{ fontWeight: 400 }}>
                {" "}· {selected.room_ID} · {selected.time_start}–{selected.time_end}
              </span>
              <span style={{ marginLeft: "auto" }}><StatusBadge status={selected.status} /></span>
            </h2>
            {["cancelled", "no_show"].includes(selected.status) ? (
              <div className="muted">คิวนี้{selected.status === "cancelled" ? "ถูกยกเลิก" : "ไม่มาตามนัด"}</div>
            ) : (
              <div style={{ maxWidth: 620, margin: "6px 0 16px" }}>
                <Stepper steps={FLOW_STEPS} current={selected.status} />
              </div>
            )}
            <div className="row" style={{ alignItems: "center" }}>
              {NEXT[selected.status]?.map((st) => (
                <button
                  key={st}
                  className={`btn small ${["cancelled", "no_show"].includes(st) ? "ghost" : "primary"}`}
                  onClick={() => changeStatus(selected, st)}
                >
                  {["cancelled", "no_show"].includes(st) ? "" : "→ "}{t(`st_${st}`)}
                </button>
              ))}
              <button className="btn small ghost" onClick={() => setSelected(null)}>ปิด</button>
            </div>
          </div>
        )}
      </div>

      <div className="cal-side">
        <div className="card">
          <h2><span className="h2-ico">🔎</span> ค้นหาลูกค้า</h2>
          <div className="row" style={{ marginBottom: 4 }}>
            <input
              style={{ flex: 1 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="HN / ชื่อ / เบอร์โทร"
            />
            <button className="btn" onClick={search}>{t("search")}</button>
          </div>
          {foundCustomers.map((c) => (
            <button
              key={c.HN_number}
              className={`user-pick ${pickedCustomer?.HN_number === c.HN_number ? "" : ""}`}
              onClick={() => pickCustomer(c)}
            >
              <span className="badge gold nodot">{c.HN_number}</span>
              <span>{c.full_name} <span className="muted">({c.nick_name})</span></span>
            </button>
          ))}
          {pickedCustomer && (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 4 }}>
                course ค้างของ {pickedCustomer.nick_name}:
              </div>
              {custCourses.length === 0 && <div className="muted">— ไม่มี —</div>}
              {custCourses.map((cc) => (
                <label
                  key={cc.customer_course_ID}
                  className="q-item"
                  style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginBottom: 6 }}
                >
                  <input
                    type="radio" name="cc"
                    checked={form.customer_course_ID === cc.customer_course_ID}
                    onChange={() => setForm((f) => ({ ...f, customer_course_ID: cc.customer_course_ID }))}
                  />
                  <span style={{ flex: 1 }}>
                    <b>{cc.course_snapshot?.name}</b>
                    <div className="muted">
                      เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง
                    </div>
                  </span>
                  {cc.balance_due > 0 && (
                    <span className="badge orange">ค้าง {money(cc.balance_due)}฿</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="h2-ico">🎴</span> {t("sell_course")}</h2>
          <div className="field">
            <label>คอร์ส</label>
            <select
              value={sellForm.course_ID}
              onChange={(e) => setSellForm((f) => ({ ...f, course_ID: e.target.value }))}
            >
              <option value="">— เลือก —</option>
              {courses.map((c) => (
                <option key={c.course_ID} value={c.course_ID}>
                  {c.name} · {money(c.price)}฿ · {c.quantity_used} ครั้ง
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <div className="field">
              <label>จ่ายงวดแรก (บาท)</label>
              <input
                type="number" value={sellForm.amount}
                onChange={(e) => setSellForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0 = ยังไม่จ่าย"
              />
            </div>
            <div className="field">
              <label>ช่องทาง</label>
              <select value={sellForm.method} onChange={(e) => setSellForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอน</option>
                <option value="card">บัตร</option>
              </select>
            </div>
          </div>
          <button className="btn gold" style={{ marginTop: 4, width: "100%", justifyContent: "center" }}
            disabled={!sellForm.course_ID} onClick={sellCourse}>
            {t("sell_course")}
          </button>
        </div>

        <div className="card">
          <h2><span className="h2-ico">🐉</span> {t("book_btn")}</h2>
          {!pickedCustomer && (
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="field">
                <label>ชื่อเล่น (ลูกค้าใหม่)</label>
                <input value={form.nick_name} onChange={(e) => setForm((f) => ({ ...f, nick_name: e.target.value }))} />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>{t("room")}</label>
              <select value={form.room_ID} onChange={(e) => setForm((f) => ({ ...f, room_ID: e.target.value }))}>
                <option value="">—</option>
                {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t("doctor")}</label>
              <select value={form.doctor_ID} onChange={(e) => setForm((f) => ({ ...f, doctor_ID: e.target.value }))}>
                <option value="">— ไม่ระบุ —</option>
                {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>เริ่ม</label>
              <input type="time" value={form.time_start} onChange={(e) => setForm((f) => ({ ...f, time_start: e.target.value }))} />
            </div>
            <div className="field">
              <label>จบ</label>
              <input type="time" value={form.time_end} onChange={(e) => setForm((f) => ({ ...f, time_end: e.target.value }))} />
            </div>
          </div>
          <label style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 12, fontSize: 13, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={form.is_walk_in}
              onChange={(e) => setForm((f) => ({ ...f, is_walk_in: e.target.checked }))} />
            {t("walk_in")} (ลูกค้าไม่ได้จองล่วงหน้า)
          </label>
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
            disabled={!form.room_ID} onClick={book}>
            {t("book_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
