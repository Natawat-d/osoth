"use client";
// ปฏิทิน (รับลูกค้า) — acception/admin: ซ้าย = ปฏิทินคิว, ขวา = รับลูกค้า + เปิดเคส
// แยกจากหน้าจองคิว: หน้านี้ทำหน้าที่ "ต้อนรับ" — มาถึง / สร้าง HN / เปิดเคส → ส่งต่อห้อง (OPD)
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import Link from "next/link";
import CalendarGrid from "@/components/CalendarGrid";
import {
  StatusBadge, StatusLegend, Stepper, AsyncButton, useToast, todayStr, fmtThaiDate,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

const FLOW_STEPS = [
  { key: "booked", label: "จองแล้ว" }, { key: "arrived", label: "มาถึง" },
  { key: "ready", label: "พร้อมทำ" }, { key: "bt_stage", label: "BT ทำ" },
  { key: "doctor_stage", label: "หมอทำ" }, { key: "done", label: "เสร็จ" },
];

export default function ReceptionPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [opds, setOpds] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(null);

  const loadEvents = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then((r) =>
      setEvents(r.filter((e) => !["cancelled", "no_show"].includes(e.status)))
    );
    api(`/opd?branch_ID=${branch_ID}&date=${date}`).then(setOpds).catch(() => setOpds([]));
    api(`/schedules?branch_ID=${branch_ID}&date=${date}`).then(setRoster).catch(() => setRoster([]));
  }, [branch_ID, date]);

  useEffect(() => {
    if (!branch_ID) return;
    api(`/rooms?branch_ID=${branch_ID}`).then((r) => setRooms(r.filter((x) => x.active).sort((a, b) => a.order - b.order)));
    api(`/users?role=doctor`).then(setDoctors);
  }, [branch_ID]);
  useEffect(loadEvents, [loadEvents]);

  // ซิงก์ reserve ที่เลือกกับข้อมูลล่าสุด (เช่นหลังเปิดเคส/มาถึง)
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

  const counts = {
    total: events.length,
    arrived: events.filter((e) => e.status === "arrived").length,
    opened: events.filter((e) => e.opd_ID).length,
    waiting: events.filter((e) => e.status === "booked").length,
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
          <span className="muted">คลิกคิวลูกค้าเพื่อรับเข้า / เปิดเคส</span>
        </div>
        <StatusLegend />
        <CalendarGrid
          rooms={rooms} events={events} doctors={doctors} roomDoctor={roomDoctor}
          onEventClick={setSelected}
          onSlotClick={() => {}}
        />
      </div>

      <div className="cal-side">
        {selected
          ? <ReceptionPanel r={selected} opd={opds.find((o) => o.opd_ID === selected.opd_ID)}
              roomName={roomName} onDone={loadEvents} onClear={() => setSelected(null)} />
          : <ReceptionHint counts={counts} />}
      </div>
    </div>
  );
}

function ReceptionHint({ counts }) {
  const Stat = ({ n, label, tone }) => (
    <div className="recep-stat">
      <div className={`recep-stat-n ${tone}`}>{n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
  return (
    <div className="card">
      <h2><span className="h2-ico">🛎️</span> รับลูกค้าวันนี้</h2>
      <div className="recep-stats">
        <Stat n={counts.waiting} label="รอรับ" tone="amber" />
        <Stat n={counts.arrived} label="มาถึงแล้ว" tone="blue" />
        <Stat n={counts.opened} label="เปิดเคสแล้ว" tone="jade" />
      </div>
      <div className="empty-state" style={{ marginTop: 14 }}>
        <span className="es-ico">👈</span>
        เลือกคิวลูกค้าจากปฏิทินด้านซ้าย<br />เพื่อรับเข้า / เปิดเคส
      </div>
    </div>
  );
}

function ReceptionPanel({ r, opd, roomName, onDone, onClear }) {
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({
    full_name: "", sure_name: "", nick_name: r.contact?.nick_name || "", phone: r.contact?.phone || "", drug_allergies: "",
  });

  const setStatus = async (status) => {
    await api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { status } });
    onDone();
  };
  const openCase = async () => {
    if (!r.HN_number) { setShowNew(true); return; }
    await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: r.HN_number } });
    toast.success("เปิดเคสแล้ว — ส่งต่อห้อง (OPD)");
    onDone();
  };
  const createCustomerAndOpen = async () => {
    const body = {
      ...newCust, branch_ID: r.branch_ID,
      drug_allergies: newCust.drug_allergies ? newCust.drug_allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    const c = await api("/customers", { method: "POST", body });
    await api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { HN_number: c.HN_number } });
    await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: c.HN_number } });
    setShowNew(false);
    toast.success(`สร้าง HN ${c.HN_number} + เปิดเคสแล้ว`);
    onDone();
  };

  const canReceive = ["booked", "arrived", "ready"].includes(r.status);
  const opened = !!r.opd_ID;
  const closed = opd?.status === "closed";

  return (
    <div className="card recep-panel">
      <h2 style={{ alignItems: "flex-start" }}>
        <span className="h2-ico">🎫</span>
        <span style={{ flex: 1 }}>
          {r.contact?.nick_name || r.HN_number || "ลูกค้าใหม่"}
          <div className="muted" style={{ fontWeight: 400, fontSize: 13, marginTop: 2 }}>
            {roomName(r.room_ID)} · {r.time_start}–{r.time_end} น.{r.is_walk_in ? " · Walk-in" : ""}
          </div>
        </span>
        <StatusBadge status={r.status} />
      </h2>

      <div style={{ margin: "4px 0 14px" }}>
        <Stepper steps={FLOW_STEPS} current={r.status} />
      </div>

      <div className="recep-info">
        <div><span className="muted">รหัสผู้ป่วย</span> {r.HN_number
          ? <span className="badge gold nodot">{r.HN_number}</span>
          : <span className="badge gray nodot">ยังไม่มี HN</span>}</div>
        {r.contact?.phone && <div><span className="muted">โทร</span> {r.contact.phone}</div>}
        {r.customer_course_ID && <div className="muted">🎴 มีคอร์สผูกกับการจอง · ชำระค่าคอร์สที่ห้อง (OPD)</div>}
      </div>

      {opened ? (
        <div className="hint-box" style={{ marginTop: 12, borderColor: closed ? "var(--jade)" : "var(--gold)" }}>
          <b style={{ fontFamily: "var(--font-display)" }}>
            {closed ? "✓ เคสปิดแล้ว" : "เปิดเคสแล้ว"} · {r.opd_ID}
          </b>
          <div className="muted" style={{ margin: "4px 0 10px" }}>
            {closed ? "ลูกค้ารายนี้ทำเคสเสร็จแล้ว" : "ส่งต่อให้หน้าห้องทำหัตถการ + ชำระเงิน"}
          </div>
          <Link href="/opd" className="btn primary" style={{ justifyContent: "center", width: "100%" }}>
            → ไปที่ห้องทำเคส (OPD)
          </Link>
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            {r.status === "booked" && (
              <AsyncButton className="btn small" ok="บันทึกว่าลูกค้ามาถึงแล้ว" onClick={() => setStatus("arrived")}>
                ✓ ลูกค้ามาถึง
              </AsyncButton>
            )}
            {["booked", "arrived"].includes(r.status) && (
              <AsyncButton className="btn small ghost" ok="บันทึกไม่มาตามนัดแล้ว" onClick={() => setStatus("no_show")}>
                ไม่มาตามนัด
              </AsyncButton>
            )}
          </div>

          {canReceive && !showNew && (
            <AsyncButton className="btn primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              onClick={openCase}>
              {r.HN_number ? "เปิดเคส →" : "สร้าง HN + เปิดเคส →"}
            </AsyncButton>
          )}

          {showNew && (
            <div className="hint-box" style={{ marginTop: 12 }}>
              <b style={{ fontFamily: "var(--font-display)" }}>ลูกค้าใหม่ — สร้าง HN</b>
              {[["full_name", "ชื่อ"], ["sure_name", "นามสกุล"], ["nick_name", "ชื่อเล่น"], ["phone", "เบอร์โทร"], ["drug_allergies", "แพ้ยา (คั่นด้วย ,)"]].map(([k, lb]) => (
                <div className="field" key={k} style={{ marginTop: 8 }}>
                  <label>{lb}{k === "full_name" && <span style={{ color: "var(--seal)" }}> *</span>}</label>
                  <input value={newCust[k]} onChange={(e) => setNewCust((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="row" style={{ marginTop: 10 }}>
                <AsyncButton className="btn primary" disabled={!newCust.full_name} ok="" onClick={createCustomerAndOpen}>
                  สร้าง HN + เปิดเคส
                </AsyncButton>
                <button className="btn ghost" onClick={() => setShowNew(false)}>ยกเลิก</button>
              </div>
            </div>
          )}
        </>
      )}

      <button className="btn small ghost" style={{ marginTop: 12 }} onClick={onClear}>ปิด</button>
    </div>
  );
}
