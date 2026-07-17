"use client";
// หน้าปฏิทิน (หน้าร้าน/ลูกค้า):
//   - ปฏิทินโหมด privacy: ลูกค้าคนอื่นไม่เห็นว่าใครจอง (แสดงแค่ "จองแล้ว")
//   - โชว์หมอที่อยู่เวรวันนั้น (ใต้ชื่อห้อง + panel ขวา)
//   - โปรโมชั่นปัจจุบัน
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import CalendarGrid from "@/components/CalendarGrid";
import PromoCarousel from "@/components/PromoCarousel";
import { todayStr, money } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

export default function CustomerCalendarPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [roster, setRoster] = useState([]); // หมอที่อยู่เวรวันนั้น (resolved)
  const [promos, setPromos] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    if (!branch_ID) return;
    api(`/rooms?branch_ID=${branch_ID}`).then((r) =>
      setRooms(r.filter((x) => x.active).sort((a, b) => a.order - b.order))
    );
    api(`/users?role=doctor`).then(setDoctors);
    api(`/promotions`).then((p) =>
      setPromos(
        p.filter(
          (x) => x.active && x.date_start <= todayStr() && x.date_end >= todayStr()
        )
      )
    );
    api(`/courses`).then((c) => setCourses(c.filter((x) => x.active)));
  }, [branch_ID]);

  // สไลด์ carousel = โปรโมชั่นปัจจุบัน (ทุกอัน) + คอร์สที่ตั้งรูปไว้
  const carouselItems = [
    ...promos.map((p) => ({
      kind: "โปรโมชั่น",
      image: p.banner_image,
      title: p.name,
      subtitle:
        p.type === "discount"
          ? `ลด ${p.discount_value}${p.discount_type === "percent" ? "%" : " บาท"} · ถึง ${p.date_end}`
          : `คอร์สโปรพิเศษ · ถึง ${p.date_end}`,
    })),
    ...courses
      .filter((c) => c.image)
      .map((c) => ({
        kind: "คอร์ส",
        image: c.image,
        title: c.name,
        subtitle: `${money(c.price)}฿ · ${c.quantity_used} ครั้ง`,
      })),
  ];

  useEffect(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then((r) =>
      setEvents(r.filter((e) => !["cancelled", "no_show"].includes(e.status)))
    );
    api(`/schedules?branch_ID=${branch_ID}&date=${date}`).then(setRoster).catch(() => setRoster([]));
  }, [branch_ID, date]);

  // map: doctor_ID → ข้อมูลหมอ, และ room_ID → หมอที่อยู่เวรห้องนั้น
  const docById = Object.fromEntries(doctors.map((d) => [d.user_ID, d]));
  const roomDoctor = {};
  const rosterView = roster
    .map((s) => {
      const d = docById[s.doctor_ID];
      if (!d) return null;
      const view = { ...s, name: d.nick_name || d.full_name, color: d.color };
      if (s.room_ID) roomDoctor[s.room_ID] = { name: view.name, color: d.color };
      return view;
    })
    .filter(Boolean);

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <div className="toolbar">
          <div className="field" style={{ margin: 0 }}>
            <label>{t("date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grow" />
          <span className="badge gray nodot">คิววันนี้ {events.length} รายการ</span>
        </div>
        <CalendarGrid
          rooms={rooms}
          events={events}
          doctors={doctors}
          roomDoctor={roomDoctor}
          privacy
        />
      </div>

      <div className="cal-side">
        <PromoCarousel items={carouselItems} />

        <div className="card">
          <h2><span className="h2-ico">👨‍⚕️</span> หมอที่อยู่วันนี้</h2>
          {rosterView.length === 0 && (
            <div className="muted">— ยังไม่มีหมอลงตารางวันนี้ —</div>
          )}
          {rosterView.map((d, i) => (
            <div className="roster-item" key={i}>
              <span className="roster-swatch" style={{ background: d.color }} />
              <div style={{ flex: 1 }}>
                <div className="roster-name">{d.name}</div>
                <div className="roster-meta">
                  {d.room_ID || "—"} · {d.time_start}–{d.time_end}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
