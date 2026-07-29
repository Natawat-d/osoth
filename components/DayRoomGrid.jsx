"use client";
// ตารางรายวัน "แยกห้อง" โฉมใหม่ (Bootstrap สวยๆ) — แกน y เวลา · แกน x ห้อง (หัวห้อง+หมอเวร)
// event เป็นบล็อกสีตามสถานะ มุมโค้ง มีเวลา+ชื่อ · คลิกช่องว่าง = เลือกห้อง/เวลา · คลิกคิว = จัดการ
import { useMemo } from "react";

const START_HOUR = 9;
const END_HOUR = 20;
const SLOT_MIN = 30;
const ROW_H = 44;

export const STATUS_META = {
  booked: { label: "จองแล้ว", color: "#6c757d" },
  arrived: { label: "มาถึง", color: "#0dcaf0" },
  ready: { label: "พร้อมทำ", color: "#1560a3" },
  consulting: { label: "ปรึกษาหมอ", color: "#6f42c1" },
  bt_stage: { label: "BT ทำ", color: "#fd7e14" },
  doctor_stage: { label: "หมอทำ", color: "#dc3545" },
  done: { label: "เสร็จ", color: "#198754" },
};

const t2min = (t) => { const [h, m] = (t || "09:00").split(":").map(Number); return h * 60 + m; };

export default function DayRoomGrid({ rooms = [], events = [], roomDoctor = {}, privacy = false, selectedId = null, onEventClick, onSlotClick }) {
  const slots = useMemo(() => {
    const out = [];
    for (let h = START_HOUR; h < END_HOUR; h++)
      for (let m = 0; m < 60; m += SLOT_MIN) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    return out;
  }, []);
  const gridH = slots.length * ROW_H;
  const yOf = (t) => ((t2min(t) - START_HOUR * 60) / SLOT_MIN) * ROW_H;

  return (
    <div style={{ overflowX: "auto" }}>
      <div className="d-flex" style={{ minWidth: 90 + rooms.length * 150 }}>
        {/* คอลัมน์เวลา */}
        <div style={{ width: 62, flexShrink: 0 }}>
          <div className="text-center small text-muted fw-semibold border-bottom py-2" style={{ height: 56 }}>เวลา</div>
          <div className="position-relative" style={{ height: gridH }}>
            {slots.map((t, i) => (
              <div key={t} className="text-end pe-2 text-muted position-absolute w-100" style={{ top: i * ROW_H - 8, fontSize: 11 }}>
                {t.endsWith("00") ? t : ""}
              </div>
            ))}
          </div>
        </div>

        {/* คอลัมน์ห้อง */}
        {rooms.map((r) => {
          const doc = roomDoctor[r.room_ID];
          const evs = events.filter((e) => e.room_ID === r.room_ID);
          return (
            <div key={r.room_ID} className="border-start flex-grow-1" style={{ minWidth: 148 }}>
              {/* หัวห้อง + หมอเวร */}
              <div className="text-center border-bottom py-1 bg-body-tertiary" style={{ height: 56 }}>
                <div className="fw-bold small">{r.name}</div>
                {doc ? (
                  <span className="badge rounded-pill mt-1" style={{ background: doc.color || "#1560a3", fontSize: 10 }}>
                    <i className="bi bi-person-badge me-1" />{doc.name}
                  </span>
                ) : <span className="badge rounded-pill text-bg-light border mt-1" style={{ fontSize: 10 }}>— ไม่มีหมอ —</span>}
              </div>
              {/* ช่องเวลา */}
              <div className="position-relative" style={{ height: gridH }}>
                {slots.map((t, i) => (
                  <div key={t}
                       className="position-absolute w-100 border-bottom"
                       style={{ top: i * ROW_H, height: ROW_H, cursor: onSlotClick ? "pointer" : "default",
                                borderBottomStyle: t.endsWith("00") ? "solid" : "dashed",
                                borderColor: "var(--bs-border-color)", opacity: t.endsWith("00") ? 1 : 0.6 }}
                       onClick={() => onSlotClick?.(r.room_ID, t)}
                       title={`จอง ${r.name} · ${t}`} />
                ))}
                {/* events */}
                {evs.map((e) => {
                  const meta = STATUS_META[e.status] || { label: e.status, color: "#6c757d" };
                  const top = yOf(e.time_start);
                  const h = Math.max(ROW_H * 0.9, yOf(e.time_end) - top - 3);
                  const sel = selectedId && (e.reserve_ID === selectedId);
                  return (
                    <button key={e.reserve_ID}
                            className="position-absolute text-start text-white border-0 shadow-sm"
                            style={{
                              top: top + 2, left: 4, right: 4, height: h,
                              background: meta.color, borderRadius: 8, padding: "3px 8px",
                              outline: sel ? "3px solid rgba(21,96,163,.55)" : "none",
                              overflow: "hidden", zIndex: 1, transition: "filter .1s",
                            }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.filter = "brightness(1.08)")}
                            onMouseLeave={(ev) => (ev.currentTarget.style.filter = "")}
                            onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e); }}>
                      <div className="fw-semibold text-truncate" style={{ fontSize: 12 }}>
                        {privacy ? "จองแล้ว" : (e.contact?.nick_name || e.HN_number || e.reserve_ID)}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.9 }}>{e.time_start}–{e.time_end} · {meta.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!rooms.length && <div className="text-muted p-4">— ยังไม่มีห้อง (ตั้งค่าที่ Setup &gt; ระบบ/ห้อง) —</div>}
      </div>
    </div>
  );
}
