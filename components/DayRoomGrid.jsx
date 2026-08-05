"use client";
// ตารางรายวัน "แยกห้อง" โฉมใหม่ (Bootstrap สวยๆ) — แกน y เวลา · แกน x ห้อง (หัวห้อง+หมอเวร)
// event เป็นบล็อกสีตามสถานะ มุมโค้ง มีเวลา+ชื่อ · คลิกช่องว่าง = เลือกห้อง/เวลา · คลิกคิว = จัดการ
// prop date (YYYY-MM-DD, optional) — ถ้าเป็นวันนี้จะโชว์เส้นเวลาปัจจุบันสีแดง
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
  consult_no_sale: { label: "ปรึกษา-ไม่ซื้อ", color: "#607d8b" },
};

const t2min = (t) => { const [h, m] = (t || "09:00").split(":").map(Number); return h * 60 + m; };
const pad2 = (n) => String(n).padStart(2, "0");

export default function DayRoomGrid({ rooms = [], events = [], roomDoctor = {}, privacy = false, selectedId = null, date = null, onEventClick, onSlotClick }) {
  const slots = useMemo(() => {
    const out = [];
    for (let h = START_HOUR; h < END_HOUR; h++)
      for (let m = 0; m < 60; m += SLOT_MIN) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    return out;
  }, []);
  const gridH = slots.length * ROW_H;
  const yOf = (t) => ((t2min(t) - START_HOUR * 60) / SLOT_MIN) * ROW_H;

  // เส้นเวลาปัจจุบัน — โชว์เฉพาะเมื่อดูวันนี้และอยู่ในช่วงเวลาทำการ
  const now = new Date();
  const nowStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const isToday = date === `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60;
  const nowTop = 56 + ((nowMin - START_HOUR * 60) / SLOT_MIN) * ROW_H;

  return (
    <div style={{ overflowX: "auto" }}>
      <div className="d-flex position-relative" style={{ minWidth: 90 + rooms.length * 150 }}>
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
                ) : <span className="badge rounded-pill bg-body-secondary text-body-secondary border mt-1" style={{ fontSize: 10 }}>— ไม่มีหมอ —</span>}
              </div>
              {/* ช่องเวลา */}
              <div className="position-relative" style={{ height: gridH }}>
                {slots.map((t, i) => (
                  <div key={t}
                       className={`position-absolute w-100 border-bottom d-flex align-items-center justify-content-center ${onSlotClick ? "drg-slot" : ""}`}
                       style={{ top: i * ROW_H, height: ROW_H, cursor: onSlotClick ? "pointer" : "default",
                                borderBottomStyle: t.endsWith("00") ? "solid" : "dashed",
                                borderColor: "var(--bs-border-color)", opacity: t.endsWith("00") ? 1 : 0.6 }}
                       onClick={() => onSlotClick?.(r.room_ID, t)}
                       title={onSlotClick ? `จอง ${r.name} · ${t}` : undefined}>
                    {onSlotClick && <span className="drg-hint text-primary fw-semibold" style={{ fontSize: 11 }}><i className="bi bi-plus-circle me-1" />{t}</span>}
                  </div>
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
                              outlineOffset: sel ? 1 : 0,
                              overflow: "hidden", zIndex: 1, transition: "filter .1s",
                            }}
                            title={`${privacy ? "จองแล้ว" : (e.contact?.nick_name || e.HN_number || e.reserve_ID)} · ${e.time_start}–${e.time_end} · ${meta.label}`}
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

        {/* เส้นเวลาปัจจุบัน (เฉพาะวันนี้) */}
        {showNow && rooms.length > 0 && (
          <div className="position-absolute w-100 d-flex align-items-center" style={{ top: nowTop - 1, zIndex: 2, pointerEvents: "none" }}>
            <span className="badge text-bg-danger rounded-pill" style={{ fontSize: 9, padding: "2px 6px" }}>{nowStr}</span>
            <div className="flex-grow-1" style={{ height: 2, background: "var(--bs-danger)", opacity: 0.55 }} />
          </div>
        )}

        {/* ไม่มีคิวของวันนั้น (มีห้องแล้ว) */}
        {rooms.length > 0 && events.length === 0 && (
          <div className="position-absolute start-50 translate-middle-x text-center text-muted"
               style={{ top: 130, zIndex: 2, pointerEvents: "none" }}>
            <i className="bi bi-calendar2-x fs-3 d-block mb-1 opacity-50" />
            <span className="small">ยังไม่มีคิวในวันนี้{onSlotClick ? " — คลิกช่องว่างเพื่อเริ่มจอง" : ""}</span>
          </div>
        )}

        {!rooms.length && (
          <div className="text-center text-muted p-5 w-100">
            <i className="bi bi-door-closed fs-2 d-block mb-2 opacity-50" />
            ยังไม่มีห้องให้บริการ — ตั้งค่าที่ Setup › ระบบ/ห้อง
          </div>
        )}
      </div>
      <style jsx>{`
        .drg-slot .drg-hint { visibility: hidden; }
        .drg-slot:hover { background: var(--bs-primary-bg-subtle); }
        .drg-slot:hover .drg-hint { visibility: visible; }
      `}</style>
    </div>
  );
}
