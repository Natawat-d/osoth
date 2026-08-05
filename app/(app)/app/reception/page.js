"use client";
// ปฏิทิน (รับลูกค้า) — V3 Bootstrap แท้: เช็คอินมาถึง / สร้าง HN / เปิดเคส → ส่งต่อ OPD
// กริดปฏิทินเดิมห่อ .lgc · แผงขวาเป็น Bootstrap
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import Link from "next/link";
import MonthCalendar from "@/components/MonthCalendar";
import DayRoomGrid, { STATUS_META } from "@/components/DayRoomGrid";
import InfoBox from "@/components/InfoBox";
import CustomerRegistrationForm from "@/components/CustomerRegistrationForm";
import { api } from "@/lib/client";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const STATUS_TH = {
  booked: ["จองแล้ว", "secondary"], arrived: ["มาถึง", "info"], ready: ["พร้อมทำ", "primary"],
  consulting: ["ปรึกษาหมอ", "primary"], consult_no_sale: ["ปรึกษา-ไม่ซื้อ", "secondary"],
  bt_stage: ["BT ทำ", "warning"], doctor_stage: ["หมอทำ", "danger"], done: ["เสร็จ", "success"],
};
const SBadge = ({ s }) => { const [l, c] = STATUS_TH[s] || [s, "light"]; return <span className={`badge text-bg-${c}`}>{l}</span>; };
const FLOW = ["booked", "arrived", "ready", "bt_stage", "doctor_stage", "done"];

export default function ReceptionPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [opds, setOpds] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(null);
  const [monthEvents, setMonthEvents] = useState({});
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

  const loadEvents = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then((r) =>
      setEvents(r.filter((e) => !["cancelled", "no_show"].includes(e.status)))).catch(() => {});
    api(`/opd?branch_ID=${branch_ID}&date=${date}`).then(setOpds).catch(() => setOpds([]));
    api(`/schedules?branch_ID=${branch_ID}&date=${date}`).then(setRoster).catch(() => setRoster([]));
  }, [branch_ID, date]);
  useEffect(() => {
    if (!branch_ID) return;
    api(`/rooms?branch_ID=${branch_ID}`).then((r) => setRooms(r.filter((x) => x.active).sort((a, b) => a.order - b.order))).catch(() => {});
    api(`/users?role=doctor`).then(setDoctors).catch(() => {});
  }, [branch_ID]);
  useEffect(loadEvents, [loadEvents]);
  useEffect(() => {
    if (selected) {
      const fresh = events.find((e) => e.reserve_ID === selected.reserve_ID);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roomDoctor = {};
  roster.forEach((s) => {
    const d = docById[s.doctor_ID];
    if (d && s.room_ID) roomDoctor[s.room_ID] = { name: d.nick_name || d.full_name, color: d.color };
  });
  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;

  const counts = useMemo(() => ({
    waiting: events.filter((e) => e.status === "booked").length,
    arrived: events.filter((e) => e.status === "arrived").length,
    opened: events.filter((e) => e.opd_ID).length,
  }), [events]);

  // legend: สถานะหลักโชว์เสมอ · สถานะพิเศษโชว์เมื่อมีคิวสถานะนั้นจริงในวัน
  const legendItems = useMemo(() => {
    const used = new Set(events.map((e) => e.status));
    return Object.entries(STATUS_META).filter(([k]) => !["consulting", "consult_no_sale"].includes(k) || used.has(k));
  }, [events]);

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-2 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">ปฏิทิน (รับลูกค้า)</h4>
          <input type="date" className="form-control form-control-sm ms-auto" style={{ width: 150 }}
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row g-2 mb-3">
          <div className="col-md-4 col-4"><InfoBox ico="bi-hourglass-split" label="รอรับ" value={counts.waiting} color="secondary" /></div>
          <div className="col-md-4 col-4"><InfoBox ico="bi-person-check" label="มาถึงแล้ว" value={counts.arrived} color="info" /></div>
          <div className="col-md-4 col-4"><InfoBox ico="bi-clipboard2-pulse" label="เปิดเคสแล้ว" value={counts.opened} color="success" /></div>
        </div>

        <div className="row g-3">
          <div className="col-lg-8">
            <MonthCalendar value={date} onSelect={setDate} onMonthChange={loadMonth} events={monthEvents} compact
              headerExtra={<span className="badge bg-body-tertiary text-body border">คิววันที่เลือก {events.length}</span>} />

            <div className="card shadow-sm mt-3">
              <div className="card-header py-2 d-flex align-items-center rcp-head">
                <span className="fw-semibold"><i className="bi bi-columns-gap me-1 text-primary" />ตารางห้อง · {date.split("-").reverse().join("/")}</span>
                <span className="text-muted small ms-2">คลิกคิวเพื่อรับเข้า/เปิดเคส</span>
              </div>
              <div className="card-body p-2">
                <DayRoomGrid rooms={rooms} events={events} roomDoctor={roomDoctor} selectedId={selected?.reserve_ID} date={date}
                             onEventClick={setSelected} />
              </div>
              <div className="card-footer py-2 d-flex gap-2 flex-wrap justify-content-center bg-body">
                {legendItems.map(([k, v]) => (
                  <span key={k} className="d-inline-flex align-items-center gap-1 small text-muted rcp-lg">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} />{v.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="sticky-lg-top" style={{ top: "4.75rem", zIndex: 1 }}>
              {selected
                ? <ReceptionPanel r={selected} opd={opds.find((o) => o.opd_ID === selected.opd_ID)}
                                  roomName={roomName} toast={toast} onDone={loadEvents} onClear={() => setSelected(null)} />
                : (
                  <div className="card shadow-sm">
                    <div className="card-body text-center py-5">
                      <span className="rcp-empty-ico"><i className="bi bi-bell" /></span>
                      <div className="fw-semibold mt-3">ยังไม่ได้เลือกคิว</div>
                      <div className="text-muted small mt-1">คลิกคิวลูกค้าในตารางห้อง<br />เพื่อรับเข้า / เปิดเคส</div>
                      {counts.waiting > 0 && <span className="badge bg-body-tertiary text-body border mt-3">วันนี้รอรับอีก {counts.waiting} คิว</span>}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .rcp-head {
          background: linear-gradient(135deg, rgba(21, 96, 163, 0.1), rgba(42, 123, 196, 0.015) 70%);
          border-bottom: 1px solid rgba(21, 96, 163, 0.14);
        }
        .rcp-head-strong {
          background: linear-gradient(135deg, #1560a3, #2a7bc4);
          color: #fff;
          border-bottom: 0;
        }
        .rcp-head-strong .rcp-head-sub { color: rgba(255, 255, 255, 0.8); }
        .rcp-panel {
          border: 1px solid rgba(21, 96, 163, 0.3);
          box-shadow: 0 10px 28px rgba(21, 96, 163, 0.16) !important;
          overflow: hidden;
          animation: rcpSlideIn 0.22s ease;
        }
        @keyframes rcpSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        .rcp-step-cur {
          background: linear-gradient(135deg, #1560a3, #2a7bc4);
          color: #fff;
          box-shadow: 0 3px 8px rgba(21, 96, 163, 0.35);
        }
        .rcp-empty-ico {
          width: 76px; height: 76px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 2rem; color: #1560a3;
          background: linear-gradient(135deg, rgba(21, 96, 163, 0.13), rgba(42, 123, 196, 0.03));
          box-shadow: inset 0 0 0 1px rgba(21, 96, 163, 0.16);
        }
        .rcp-lg {
          padding: 2px 9px;
          border-radius: 99px;
          background: var(--bs-tertiary-bg);
          border: 1px solid var(--bs-border-color);
          transition: transform 0.15s ease;
        }
        .rcp-lg:hover { transform: translateY(-1px); }
      `}</style>
    </div>
  );
}

function ReceptionPanel({ r, opd, roomName, toast, onDone, onClear }) {
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast.success(msg); onDone(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const setStatus = (status, msg) => run(() => api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { status } }), msg);
  const openCase = () => {
    if (!r.HN_number) return setShowNew(true); // ลูกค้าใหม่ → กรอกเอกสารประวัติผู้ใช้บริการก่อน
    // ลูกค้าเดิม (มี HN) → ใช้ข้อมูลประวัติชุดเดิม แม้มาคนละคอร์ส
    run(() => api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: r.HN_number } }), "เปิดเคสแล้ว — ส่งต่อ OPD");
  };
  const createCustomerAndOpen = (body) => run(async () => {
    const c = await api("/customers", { method: "POST", body: { ...body, branch_ID: r.branch_ID } });
    await api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { HN_number: c.HN_number } });
    await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: c.HN_number } });
    setShowNew(false);
  }, "สร้าง HN + บันทึกประวัติ + เปิดเคสแล้ว");

  const canReceive = ["booked", "arrived", "ready"].includes(r.status);
  const opened = !!r.opd_ID;
  const closed = opd?.status === "closed";
  const stepIdx = FLOW.indexOf(r.status);

  return (
    <div className="card shadow-sm rcp-panel">
      <div className="card-header py-2 d-flex align-items-center gap-2 rcp-head-strong">
        <i className="bi bi-person-circle" />
        <b>{r.contact?.nick_name || r.HN_number || "ลูกค้าใหม่"}</b>
        <span className="rcp-head-sub small">{roomName(r.room_ID)} · {r.time_start}–{r.time_end}{r.is_walk_in ? " · Walk-in" : ""}</span>
        <span className="ms-auto"><SBadge s={r.status} /></span>
        <button className="btn-close btn-close-white" aria-label="ปิด" onClick={onClear} />
      </div>
      <div className="card-body py-3">
        {/* step flow — ผ่านแล้ว = ฟ้าอ่อน+เช็ค · ขั้นปัจจุบัน = น้ำเงินเข้ม · ที่เหลือ = จาง */}
        <div className="d-flex flex-wrap gap-1 mb-3">
          {FLOW.map((s, i) => {
            const [l] = STATUS_TH[s] || [s];
            const cls = i < stepIdx
              ? "bg-primary-subtle text-primary-emphasis border border-primary-subtle"
              : i === stepIdx
                ? "rcp-step-cur"
                : "bg-body-tertiary text-body-secondary border";
            return (
              <span key={s} className={`badge rounded-pill ${cls}`}>
                {i < stepIdx && <i className="bi bi-check2 me-1" />}{l}
              </span>
            );
          })}
        </div>

        <div className="small mb-2">
          <span className="text-muted me-1">รหัสผู้ป่วย:</span>
          {r.HN_number ? <span className="badge text-bg-primary">{r.HN_number}</span> : <span className="badge text-bg-secondary">ยังไม่มี HN</span>}
          {r.contact?.phone && <span className="ms-2 text-muted">โทร {r.contact.phone}</span>}
        </div>
        {r.HN_number && (
          <div className="small mb-2">
            <Link href={`/app/history-form?hn=${encodeURIComponent(r.HN_number)}`} target="_blank" className="text-decoration-none">
              <i className="bi bi-file-earmark-person me-1" />ประวัติผู้ใช้บริการ / ข้อมูลสุขภาพ (ดู · พิมพ์ PDF)
            </Link>
            <div className="text-muted" style={{ fontSize: 11 }}>ลูกค้าเดิม — ใช้ข้อมูลชุดเดิม ไม่ต้องกรอกใหม่แม้คนละคอร์ส</div>
          </div>
        )}
        {r.customer_course_ID && <div className="text-muted small mb-2"><i className="bi bi-ticket-perforated me-1" />มีคอร์สผูกกับการจอง · ชำระที่ OPD</div>}

        {opened ? (
          <div className={`alert ${closed ? "alert-success" : "alert-info"} py-2`}>
            <b>{closed && <i className="bi bi-check2-circle me-1" />}{closed ? "เคสปิดแล้ว" : "เปิดเคสแล้ว"} · {r.opd_ID}</b>
            <Link href="/app/opd" className="btn btn-primary btn-sm d-block ms-auto px-4 mt-2">→ ไปที่ห้องทำเคส (OPD)</Link>
          </div>
        ) : (
          <>
            <div className="d-flex gap-2 flex-wrap mb-2">
              {r.status === "booked" && (
                <button className="btn btn-info btn-sm text-white" disabled={busy} onClick={() => setStatus("arrived", "บันทึกลูกค้ามาถึงแล้ว")}>
                  <i className="bi bi-person-check me-1" /> ลูกค้ามาถึง
                </button>
              )}
              {["booked", "arrived"].includes(r.status) && (
                <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setStatus("no_show", "บันทึกไม่มาตามนัด")}>ไม่มาตามนัด</button>
              )}
            </div>
            {canReceive && (
              <button className="btn btn-primary d-block ms-auto px-4" disabled={busy} onClick={openCase}>
                {busy && <span className="spinner-border spinner-border-sm me-1" />}
                {r.HN_number ? "เปิดเคส →" : "ลูกค้าใหม่ — กรอกประวัติ + สร้าง HN →"}
              </button>
            )}
            {showNew && (
              <CustomerRegistrationForm
                initial={{ nick_name: r.contact?.nick_name || "", phone: r.contact?.phone || "" }}
                busy={busy} onSubmit={createCustomerAndOpen} onCancel={() => setShowNew(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
