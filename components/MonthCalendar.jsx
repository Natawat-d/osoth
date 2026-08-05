"use client";
// ปฏิทินรายเดือน (ref AdminLTE pages/calendar) — ใช้ซ้ำ: จองคิว/รับลูกค้า/ตารางหมอ
// props:
//   value          วันที่เลือก "YYYY-MM-DD"
//   onSelect(date) คลิกวัน
//   onMonthChange("YYYY-MM")  เดือนเปลี่ยน (โหลด event ใหม่)
//   events         { "YYYY-MM-DD": [{ label, color }] } — ชิปในช่องวัน (สีตามสถานะ/หมอ)
//   maxChips       จำนวนชิปสูงสุดต่อวัน (default 3)
//   compact        true = ปฏิทินย่อ: ไม่โชว์รายละเอียดใคร แสดงแค่จำนวนคิว (กดวันแล้วไปดูตารางห้องเอา)
import { useMemo, useState } from "react";

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

export default function MonthCalendar({ value, onSelect, onMonthChange, events = {}, maxChips = 3, compact = false, headerExtra = null }) {
  const init = value ? new Date(`${value}T00:00:00`) : new Date();
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });

  const weeks = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const out = [];
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        row.push({
          date: `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`,
          day: cur.getDate(),
          inMonth: cur.getMonth() === ym.m,
        });
      }
      out.push(row);
    }
    return out;
  }, [ym]);

  const move = (n) => {
    const d = new Date(ym.y, ym.m + n, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() };
    setYm(next);
    onMonthChange?.(`${next.y}-${pad2(next.m + 1)}`);
  };
  const goToday = () => {
    const d = new Date();
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    onMonthChange?.(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    onSelect?.(todayStr());
  };

  return (
    <div className="card shadow-sm mcal-premium">
      <div className="card-header d-flex align-items-center flex-wrap gap-2 py-2 mcal-phead">
        <div className="btn-group">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => move(-1)} aria-label="เดือนก่อน"><i className="bi bi-chevron-left" /></button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => move(1)} aria-label="เดือนถัดไป"><i className="bi bi-chevron-right" /></button>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={goToday}>วันนี้</button>
        <h6 className="fw-bold mb-0 mx-auto mcal-ptitle"><i className="bi bi-calendar3 me-2 opacity-75" />{MONTHS_TH[ym.m]} {ym.y + 543}</h6>
        {headerExtra}
      </div>
      <div className="card-body p-0">
        <div className={`mcal ${compact ? "mcal-compact" : ""}`}>
          <div className="mcal-head">
            {DOW_TH.map((d, i) => <div key={d} className={i === 0 || i === 6 ? "text-danger" : ""}>{d}</div>)}
          </div>
          {weeks.map((row, w) => (
            <div className="mcal-row" key={w}>
              {row.map((cell) => {
                const chips = events[cell.date] || [];
                const isToday = cell.date === todayStr();
                const isSel = cell.date === value;
                return (
                  <button key={cell.date}
                          className={`mcal-cell ${cell.inMonth ? "" : "out"} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
                          title={chips.length ? `${chips.length} คิว` : undefined}
                          aria-pressed={isSel}
                          onClick={() => onSelect?.(cell.date)}>
                    <span className={`mcal-day ${isToday ? "badge text-bg-primary rounded-circle" : ""}`}>{cell.day}</span>
                    {!compact && chips.slice(0, maxChips).map((c, i) => (
                      <span key={i} className="mcal-ev" style={{ background: c.color || "#1560a3" }}>{c.label}</span>
                    ))}
                    {!compact && chips.length > maxChips && <span className="mcal-more">+{chips.length - maxChips} เพิ่มเติม</span>}
                    {chips.length > 0 && <span className="mcal-count badge text-bg-primary">{chips.length}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .mcal-phead { background: linear-gradient(135deg, rgba(21, 96, 163, 0.09), rgba(42, 123, 196, 0.015) 65%); }
        .mcal-ptitle { letter-spacing: 0.2px; }
        .mcal-ptitle i { color: #1560a3; }
        .mcal-premium :global(.mcal-cell) {
          transition: background 0.15s ease, box-shadow 0.15s ease;
        }
        .mcal-premium :global(.mcal-cell:hover) {
          background: color-mix(in srgb, #1560a3 9%, var(--bs-card-bg, var(--bs-body-bg)));
          box-shadow: inset 0 0 0 1px rgba(21, 96, 163, 0.22);
        }
        .mcal-premium :global(.mcal-cell.today) {
          background: linear-gradient(135deg, rgba(21, 96, 163, 0.16), rgba(42, 123, 196, 0.03) 75%),
            var(--bs-card-bg, var(--bs-body-bg));
        }
        .mcal-premium :global(.mcal-cell.sel) {
          outline: none;
          border-radius: 10px;
          box-shadow: inset 0 0 0 2px #1560a3, inset 0 0 16px rgba(21, 96, 163, 0.1), 0 4px 14px rgba(21, 96, 163, 0.22);
          z-index: 1;
        }
        .mcal-premium :global(.mcal-day.badge) {
          background: linear-gradient(135deg, #1560a3, #2a7bc4) !important;
          box-shadow: 0 2px 6px rgba(21, 96, 163, 0.35);
        }
        .mcal-premium :global(.mcal-count) {
          background: linear-gradient(135deg, #1560a3, #2a7bc4) !important;
          border-radius: 99px;
          box-shadow: 0 1px 4px rgba(21, 96, 163, 0.3);
          font-variant-numeric: tabular-nums;
        }
        .mcal-premium :global(.mcal-head > div) { letter-spacing: 0.4px; font-size: 12px; }
      `}</style>
    </div>
  );
}
