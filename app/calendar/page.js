"use client";
// ปฏิทิน (จองคิว) — sale/admin: ซ้าย = ปฏิทินคิว, ขวา = ค้นลูกค้า + จองคิว(เลือกคอร์ส)
// จัดการได้แค่ "การจอง" (เลื่อนนัด/ยกเลิก) — การรับลูกค้า+เปิดเคสอยู่ที่ /reception
import { useEffect, useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import CalendarGrid from "@/components/CalendarGrid";
import ImageInput from "@/components/ImageInput";
import {
  StatusBadge, StatusLegend, Stepper, AsyncButton, useToast,
  todayStr, money, fmtThaiDate, addMinutes,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

const FLOW_STEPS = [
  { key: "booked", label: "จองแล้ว" }, { key: "arrived", label: "มาถึง" },
  { key: "ready", label: "พร้อมทำ" }, { key: "bt_stage", label: "BT ทำ" },
  { key: "doctor_stage", label: "หมอทำ" }, { key: "done", label: "เสร็จ" },
];

export default function SaleCalendarPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [resched, setResched] = useState(null); // ฟอร์มเลื่อนนัด
  const selRef = useRef(null);

  const [query, setQuery] = useState("");
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [custCourses, setCustCourses] = useState([]);

  const [form, setForm] = useState({
    customer_course_ID: "", sell_course_ID: "", room_ID: "", doctor_ID: "",
    time_start: "10:00", time_end: "11:00", nick_name: "", phone: "", is_walk_in: false,
    payment_slip: "",
  });

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

  // F-06: เลื่อนการ์ดจัดการคิวขึ้นมาให้เห็นเมื่อคลิกคิว
  useEffect(() => {
    if (selected && selRef.current) selRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected]);

  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roomDoctor = {};
  roster.forEach((s) => {
    const d = docById[s.doctor_ID];
    if (d && s.room_ID) roomDoctor[s.room_ID] = { name: d.nick_name || d.full_name, color: d.color };
  });
  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;

  // F-02: ตั้งเวลาจบ = เริ่ม + ระยะเวลาคอร์ส อัตโนมัติ
  const durationFor = () => {
    const cc = custCourses.find((c) => c.customer_course_ID === form.customer_course_ID);
    if (cc?.course_snapshot?.duration_minutes) return cc.course_snapshot.duration_minutes;
    const sc = courses.find((c) => c.course_ID === form.sell_course_ID);
    if (sc?.duration_minutes) return sc.duration_minutes;
    return 60;
  };
  const setStart = (start) => setForm((f) => ({ ...f, time_start: start, time_end: addMinutes(start, durationFor()) }));

  const search = async () => {
    const found = await api(`/customers?q=${encodeURIComponent(query)}`);
    setFoundCustomers(found);
    setPickedCustomer(null);
    setCustCourses([]);
    if (found.length === 0) toast.info("ไม่พบลูกค้าตามคำค้น");
  };

  const pickCustomer = async (c) => {
    setPickedCustomer(c);
    setForm((f) => ({ ...f, nick_name: c.nick_name, phone: c.phone }));
    setCustCourses(await api(`/customer-courses?HN=${c.HN_number}&status=active`));
  };

  const book = async () => {
    let ccId = form.customer_course_ID || null;
    // ขายคอร์สใหม่ตอนจอง → ผูกกับ reserve แต่ "ยังไม่จ่าย"
    // (ไม่มีมัดจำ — จ่ายค่าคอร์สเต็มจำนวนก่อนทำหัตถการที่ OPD)
    if (form.sell_course_ID) {
      const res = await api("/customer-courses", {
        method: "POST",
        body: {
          branch_ID, HN_number: pickedCustomer?.HN_number || null,
          reserve_contact: { nick_name: form.nick_name, phone: form.phone },
          course_ID: form.sell_course_ID,
          first_payment: null,
        },
      });
      ccId = res.customer_course.customer_course_ID;
    }
    await api("/reserves", {
      method: "POST",
      body: {
        branch_ID, HN_number: pickedCustomer?.HN_number || null,
        contact: { nick_name: form.nick_name, phone: form.phone },
        customer_course_ID: ccId,
        date, time_start: form.time_start, time_end: form.time_end,
        room_ID: form.room_ID, doctor_ID: form.doctor_ID || null,
        is_walk_in: form.is_walk_in,
        payment_slip: form.payment_slip || "", // สลิปจ่ายเงินจอง (แนบตอนจอง)
        // ไม่มีมัดจำ — จ่ายค่าคอร์สเต็มจำนวนก่อนทำหัตถการที่ OPD
      },
    });
    setForm((f) => ({ ...f, nick_name: "", phone: "", customer_course_ID: "", sell_course_ID: "", payment_slip: "" }));
    setPickedCustomer(null);
    loadEvents();
  };

  const changeStatus = async (rs, status) => {
    await api(`/reserves/${rs.reserve_ID}`, { method: "PUT", body: { status } });
    setSelected(null);
    loadEvents();
  };

  const doReschedule = async () => {
    await api(`/reserves/${selected.reserve_ID}`, {
      method: "PUT",
      body: { reschedule: { date: resched.date, time_start: resched.time_start, time_end: resched.time_end, room_ID: resched.room_ID } },
    });
    setResched(null); setSelected(null); loadEvents();
  };

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <div className="toolbar">
          <div className="field" style={{ margin: 0 }}>
            <label>{t("date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <span className="date-hint">{fmtThaiDate(date)}</span>
          </div>
          <div className="grow" />
          <span className="muted">คลิกช่องว่างเพื่อเลือกห้อง/เวลา · คลิกคิวเพื่อจัดการ</span>
        </div>
        <StatusLegend />
        <CalendarGrid
          rooms={rooms} events={events} doctors={doctors} roomDoctor={roomDoctor}
          onEventClick={setSelected}
          onSlotClick={(room_ID, time) => { setForm((f) => ({ ...f, room_ID })); setStart(time); }}
        />

        {selected && (
          <div className="card" ref={selRef} style={{ marginTop: 16 }}>
            <h2>
              <span className="h2-ico">🎫</span>
              {selected.contact?.nick_name || selected.HN_number || selected.reserve_ID}
              <span className="muted" style={{ fontWeight: 400 }}>
                {" "}· {roomName(selected.room_ID)} · {selected.time_start}–{selected.time_end} น.
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
            {selected.payment_slip && (
              <div style={{ marginBottom: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>🧾 สลิปจ่ายเงินจอง</div>
                <a href={selected.payment_slip} target="_blank" rel="noreferrer">
                  <img src={selected.payment_slip} alt="สลิป" style={{ maxWidth: 180, maxHeight: 220, borderRadius: 6, border: "1px solid var(--line)", cursor: "zoom-in" }} />
                </a>
              </div>
            )}
            {/* หน้าจองคิว = จัดการ "การจอง" เท่านั้น (เลื่อนนัด/ยกเลิก) — การรับลูกค้า+เปิดเคสไปที่ปฏิทิน(รับลูกค้า) */}
            <div className="row" style={{ alignItems: "center" }}>
              {["booked", "arrived"].includes(selected.status) && (
                <button className="btn small primary" onClick={() => setResched({ date: selected.date, time_start: selected.time_start, time_end: selected.time_end, room_ID: selected.room_ID })}>
                  🕑 {t("reschedule")}
                </button>
              )}
              {!["done", "cancelled", "no_show"].includes(selected.status) && (
                <AsyncButton className="btn small ghost" ok="ยกเลิกการจองแล้ว" onClick={() => changeStatus(selected, "cancelled")}>
                  ✕ ยกเลิกการจอง
                </AsyncButton>
              )}
              <button className="btn small ghost" onClick={() => { setSelected(null); setResched(null); }}>ปิด</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              รับลูกค้า / เปิดเคส → ไปที่ <b>ปฏิทิน (รับลูกค้า)</b>
            </div>

            {resched && (
              <div className="hint-box" style={{ marginTop: 12 }}>
                <b style={{ fontFamily: "var(--font-display)" }}>เลื่อนนัด — เลือกวัน/เวลา/ห้องใหม่</b>
                <div className="row" style={{ marginTop: 8 }}>
                  <div className="field"><label>วันใหม่</label>
                    <input type="date" value={resched.date} onChange={(e) => setResched((r) => ({ ...r, date: e.target.value }))} /></div>
                  <div className="field"><label>เริ่ม</label>
                    <input type="time" value={resched.time_start} onChange={(e) => setResched((r) => ({ ...r, time_start: e.target.value, time_end: addMinutes(e.target.value, 60) }))} /></div>
                  <div className="field"><label>จบ</label>
                    <input type="time" value={resched.time_end} onChange={(e) => setResched((r) => ({ ...r, time_end: e.target.value }))} /></div>
                  <div className="field"><label>{t("room")}</label>
                    <select value={resched.room_ID} onChange={(e) => setResched((r) => ({ ...r, room_ID: e.target.value }))}>
                      {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
                    </select></div>
                  <AsyncButton className="btn primary" ok="เลื่อนนัดแล้ว" onClick={doReschedule}>ยืนยันเลื่อนนัด</AsyncButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cal-side">
        <div className="card">
          <h2><span className="h2-ico">🔎</span> ค้นหาลูกค้า</h2>
          <div className="row" style={{ marginBottom: 4 }}>
            <input
              style={{ flex: 1 }} value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="HN / ชื่อ / เบอร์โทร"
            />
            <button className="btn" onClick={search}>{t("search")}</button>
          </div>
          {foundCustomers.map((c) => (
            <button key={c.HN_number} className="user-pick" onClick={() => pickCustomer(c)}>
              <span className="badge gold nodot">{c.HN_number}</span>
              <span>{c.full_name} <span className="muted">({c.nick_name})</span></span>
            </button>
          ))}
          {pickedCustomer && (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 4 }}>คอร์สค้างของ {pickedCustomer.nick_name}:</div>
              {custCourses.length === 0 && <div className="muted">— ไม่มี —</div>}
              {custCourses.map((cc) => (
                <label key={cc.customer_course_ID} className="q-item"
                  style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginBottom: 6 }}>
                  <input type="radio" name="cc"
                    checked={form.customer_course_ID === cc.customer_course_ID}
                    onChange={() => setForm((f) => ({ ...f, customer_course_ID: cc.customer_course_ID, time_end: addMinutes(f.time_start, cc.course_snapshot?.duration_minutes || 60) }))} />
                  <span style={{ flex: 1 }}>
                    <b>{cc.course_snapshot?.name}</b>
                    <div className="muted">เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง</div>
                  </span>
                  {cc.balance_due > 0 && <span className="badge orange">ค้าง {money(cc.balance_due)}฿</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="h2-ico">🐉</span> {t("book_btn")} + เลือกคอร์ส</h2>
          {!pickedCustomer && (
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="field"><label>ชื่อเล่น (ลูกค้าใหม่)</label>
                <input value={form.nick_name} onChange={(e) => setForm((f) => ({ ...f, nick_name: e.target.value }))} /></div>
              <div className="field"><label>เบอร์โทร</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
          )}
          <div className="field">
            <label>คอร์ส (ผูกกับการจอง)</label>
            <select
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
                } else {
                  setForm((f) => ({ ...f, customer_course_ID: "", sell_course_ID: "" }));
                }
              }}
            >
              <option value="">— ไม่ผูก (เลือกตอน OPD ได้) —</option>
              {custCourses.length > 0 && <optgroup label="คอร์สเดิมของลูกค้า">
                {custCourses.map((cc) => (
                  <option key={cc.customer_course_ID} value={`cc:${cc.customer_course_ID}`}>
                    {cc.course_snapshot?.name} · เหลือ {cc.uses_remaining}/{cc.uses_total}
                  </option>
                ))}
              </optgroup>}
              <optgroup label="ขายคอร์สใหม่ (จ่ายค่าคอร์สที่ OPD)">
                {courses.map((c) => (
                  <option key={c.course_ID} value={`sell:${c.course_ID}`}>{c.name} · {money(c.price)}฿ · {c.quantity_used} ครั้ง</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field"><label>{t("room")}</label>
              <select value={form.room_ID} onChange={(e) => setForm((f) => ({ ...f, room_ID: e.target.value }))}>
                <option value="">—</option>
                {rooms.map((r) => <option key={r.room_ID} value={r.room_ID}>{r.name}</option>)}
              </select></div>
            <div className="field"><label>{t("doctor")}</label>
              <select value={form.doctor_ID} onChange={(e) => setForm((f) => ({ ...f, doctor_ID: e.target.value }))}>
                <option value="">— ไม่ระบุ —</option>
                {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
              </select></div>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="field"><label>เริ่ม</label>
              <input type="time" value={form.time_start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="field"><label>จบ (อัตโนมัติ)</label>
              <input type="time" value={form.time_end} onChange={(e) => setForm((f) => ({ ...f, time_end: e.target.value }))} /></div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            จองไม่ต้องจ่าย · จ่ายค่าคอร์สเต็มจำนวนก่อนทำหัตถการที่ OPD (แยกช่องทางได้)
          </div>
          <label style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 12, fontSize: 13, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={form.is_walk_in}
              onChange={(e) => setForm((f) => ({ ...f, is_walk_in: e.target.checked }))} />
            {t("walk_in")} (ลูกค้าไม่ได้จองล่วงหน้า)
          </label>
          <ImageInput
            label="แนบสลิปจ่ายเงินจอง (ถ้ามี)"
            value={form.payment_slip}
            onChange={(v) => setForm((f) => ({ ...f, payment_slip: v }))}
          />
          <AsyncButton className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
            disabled={!form.room_ID} ok="จองคิวสำเร็จ" onClick={book}>
            {t("book_btn")}
          </AsyncButton>
        </div>
      </div>
    </div>
  );
}
