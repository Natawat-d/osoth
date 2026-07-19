"use client";

// ปฏิทินรายวัน: แกน y = เวลา (แถวละ 30 นาที), แกน x = ห้อง (เฉพาะ active)
// props:
//   privacy    = true → ไม่โชว์ชื่อคนจอง (หน้าลูกค้า) แสดงแค่ "จองแล้ว"
//   roomDoctor = { room_ID: { name, color } } หมอที่อยู่เวรห้องนั้นวันนั้น (โชว์ใต้ชื่อห้อง)
const START_HOUR = 9;
const END_HOUR = 20;
const SLOT_MIN = 30;
const ROW_H = 46;

const STATUS_COLORS = {
  booked: "#7c8794",
  arrived: "#34618f",
  ready: "#a5842f",
  bt_stage: "#b8791f",
  doctor_stage: "#b23a33",
  done: "#2f7d5b",
};

export default function CalendarGrid({
  rooms,
  events,
  doctors = [],
  roomDoctor = {},
  privacy = false,
  onEventClick,
  onSlotClick,
}) {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++)
    for (let m = 0; m < 60; m += SLOT_MIN) slots.push({ h, m });

  const doctorColor = Object.fromEntries(doctors.map((d) => [d.user_ID, d.color]));
  const timeToY = (t) => {
    const [h, m] = t.split(":").map(Number);
    return ((h - START_HOUR) * 60 + m) / SLOT_MIN;
  };

  return (
    <div className="cal-scroll">
      <div
        className="cal-grid"
        style={{ gridTemplateColumns: `62px repeat(${rooms.length}, minmax(128px, 1fr))` }}
      >
        <div className="cal-cell cal-head time-head">เวลา</div>
        {rooms.map((r) => (
          <div key={r.room_ID} className="cal-cell cal-head">
            {r.name}
            <span className="head-sub">
              {roomDoctor[r.room_ID] ? `👨‍⚕️ ${roomDoctor[r.room_ID].name}` : "— ไม่มีหมอ —"}
            </span>
          </div>
        ))}
        {slots.map(({ h, m }) => (
          <Row
            key={`${h}:${m}`}
            h={h}
            m={m}
            rooms={rooms}
            events={events}
            doctorColor={doctorColor}
            timeToY={timeToY}
            privacy={privacy}
            onEventClick={onEventClick}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ h, m, rooms, events, doctorColor, timeToY, privacy, onEventClick, onSlotClick }) {
  const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return (
    <>
      <div className="cal-cell cal-time">{m === 0 ? label : ""}</div>
      {rooms.map((r) => {
        const evs = events.filter(
          (e) => e.room_ID === r.room_ID && e.time_start === label
        );
        return (
          <div
            key={r.room_ID}
            className="cal-cell"
            onClick={() => onSlotClick?.(r.room_ID, label)}
            style={{ cursor: onSlotClick ? "pointer" : "default" }}
          >
            {evs.map((e) => {
              const rows = Math.max(1, timeToY(e.time_end) - timeToY(e.time_start));
              const color =
                doctorColor[e.doctor_ID] || STATUS_COLORS[e.status] || "#7c8794";
              const title = privacy
                ? "จองแล้ว"
                : e.contact?.nick_name || e.HN_number || e.reserve_ID;
              return (
                <div
                  key={e.reserve_ID}
                  className="cal-ev"
                  style={{ top: 3, height: rows * ROW_H - 6, background: color }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick?.(e);
                  }}
                  title={`${e.time_start}-${e.time_end}`}
                >
                  <div className="ev-title">{title}</div>
                  <div className="ev-time">{e.time_start}–{e.time_end}</div>
                  {!privacy && e.is_walk_in && <span className="ev-tag">Walk-in</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
