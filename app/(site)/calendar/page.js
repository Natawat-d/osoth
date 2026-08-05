"use client";
// /calendar — ปฏิทินคิวลูกค้า (public) · UI ตาม AdminLTE v4 pages/calendar:
// ซ้าย = การ์ดสถานะ/ติดต่อ/โปรโมชั่น · ขวา = ปฏิทินรายเดือน (month grid สไตล์ FullCalendar)
// คลิกวัน → การ์ดรายละเอียดคิววันนั้น (privacy — ไม่มีชื่อผู้จอง)
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useGetSetupStateQuery, useGetPublicStorefrontQuery,
  useGetPublicMonthQuery, useGetPublicCalendarQuery,
} from "@/store/apiSlice";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const M_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// 2026-10-03 → 3 ต.ค. 2569 (แสดงผลอย่างเดียว)
const thShort = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return Number.isFinite(y) ? `${d} ${M_ABBR[m - 1]} ${y + 543}` : s;
};
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

export default function CustomerCalendarPage() {
  const { data: setup } = useGetSetupStateQuery();
  const { data: branches } = useGetPublicStorefrontQuery();
  const branch = branches?.[0]; // สาขาเดียว

  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m = 0-11
  const [selected, setSelected] = useState(todayStr());

  const monthKey = `${ym.y}-${pad2(ym.m + 1)}`;
  const { data: monthData, isFetching: loadingMonth } = useGetPublicMonthQuery(
    { branch_ID: branch?.branch_ID, month: monthKey }, { skip: !branch });
  const { data: dayData, isFetching: loadingDay } = useGetPublicCalendarQuery(
    { branch_ID: branch?.branch_ID, date: selected }, { skip: !branch || !selected });

  const brand = setup?.company?.brand || { display_name: "Osoth", logo: "/brand/logo.jpg" };
  const dayMap = useMemo(() => Object.fromEntries((monthData?.days || []).map((d) => [d.date, d])), [monthData]);

  // ── สร้างตาราง 6 สัปดาห์ × 7 วัน (รวมวันเดือนก่อน/หน้าแบบ muted เหมือน FullCalendar) ──
  const weeks = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // ถอยไปวันอาทิตย์ของสัปดาห์แรก
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

  const move = (n) => setYm(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const goToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSelected(todayStr()); };

  // ระดับความหนาแน่นคิว → สีชิป (เขียว=ว่าง เหลือง=เริ่มแน่น แดง=แน่น)
  const load = (c) => (c >= 8 ? "danger" : c >= 4 ? "warning" : "success");

  const roomName = Object.fromEntries((dayData?.rooms || []).map((r) => [r.room_ID, r.name]));
  const roomDoctor = {};
  (dayData?.roster || []).forEach((r) => { if (r.room_ID) roomDoctor[r.room_ID] = r; });
  // จัด event ของวันเลือก group ตามห้อง เรียงเวลา
  const dayByRoom = useMemo(() => {
    const m = {};
    for (const ev of dayData?.events || []) {
      m[ev.room_ID] = m[ev.room_ID] || [];
      m[ev.room_ID].push(ev);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.time_start < b.time_start ? -1 : 1));
    return m;
  }, [dayData]);

  return (
    <div className="d-flex flex-column bg-body-tertiary" style={{ minHeight: "100vh" }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand navbar-dark" style={{ background: "#1560a3" }}>
        <div className="container-fluid px-3">
          <span className="navbar-brand d-flex align-items-center gap-2 fw-bold">
            <img src={`${bp}${brand.logo}`} alt="logo" width={32} height={32} style={{ borderRadius: 6 }} />
            {brand.display_name}
            <span className="fw-normal small opacity-75 d-none d-sm-inline">· ปฏิทินคิวสำหรับลูกค้า</span>
          </span>
          <div className="ms-auto d-flex gap-2">
            <Link href="/about_me" className="btn btn-outline-light btn-sm">
              <i className="bi bi-house me-1" /> หน้าแรก
            </Link>
            <Link href="/login" className="btn btn-light btn-sm fw-semibold">
              <i className="bi bi-box-arrow-in-right me-1" /> เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </nav>

      {/* Content header (สไตล์ AdminLTE) */}
      <div className="container-fluid px-3 pt-3 flex-grow-1">
        <div className="d-flex align-items-center mb-2">
          <h4 className="fw-bold mb-0 text-body">ปฏิทินคิว</h4>
          <nav className="ms-auto small text-body-secondary">หน้าแรก / <span className="text-body">ปฏิทิน</span></nav>
        </div>

        <div className="row g-3 pb-4">
          {/* ── คอลัมน์ซ้าย (ref: Draggable Events) — บนมือถือย้ายไปหลังปฏิทิน ── */}
          <div className="col-lg-3 order-2 order-lg-1">
            <div className="card shadow-sm mb-3">
              <div className="card-header fw-semibold py-2">สถานะคิว</div>
              <div className="card-body py-2">
                {[["success", "ว่างมาก (0–3 คิว)"], ["warning", "เริ่มแน่น (4–7 คิว)"], ["danger", "คิวแน่น (8+ คิว)"]].map(([c, l]) => (
                  <div className="d-flex align-items-center gap-2 py-1" key={c}>
                    <span className={`bg-${c} rounded`} style={{ width: 14, height: 14, display: "inline-block" }} />
                    <span className="small">{l}</span>
                  </div>
                ))}
                <div className="text-muted mt-2" style={{ fontSize: 11 }}>* แสดงเฉพาะช่วงว่าง/ไม่ว่าง ไม่เปิดเผยชื่อผู้จอง</div>
              </div>
            </div>

            <div className="card shadow-sm mb-3">
              <div className="card-header fw-semibold py-2"><i className="bi bi-telephone me-1 text-primary" />จองคิว ติดต่อเรา</div>
              <div className="card-body py-2">
                <div className="d-flex flex-wrap gap-2">
                  {branch?.phone && <a className="btn btn-primary btn-sm px-3" href={`tel:${branch.phone}`}><i className="bi bi-telephone-fill me-1" /> โทร {branch.phone}</a>}
                  {branch?.line_id && (
                    <a className="btn btn-success btn-sm px-3" target="_blank" rel="noreferrer"
                       href={`https://line.me/R/ti/p/~${encodeURIComponent(branch.line_id.replace(/^@?/, "@"))}`}>
                      <i className="bi bi-chat-dots-fill me-1" /> LINE {branch.line_id}
                    </a>
                  )}
                </div>
                {branch?.address && <div className="text-muted small mt-2"><i className="bi bi-geo-alt me-1" />{branch.address}</div>}
              </div>
            </div>

            {/* หมอที่อยู่ (วันเลือก) */}
            <div className="card shadow-sm mb-3">
              <div className="card-header fw-semibold py-2"><i className="bi bi-person-badge me-1 text-primary" />หมอวันที่เลือก</div>
              <ul className="list-group list-group-flush small">
                {(dayData?.roster || []).map((d, i) => (
                  <li className="list-group-item py-2 d-flex align-items-center gap-2" key={i}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                    <div>
                      <div className="fw-semibold">{d.name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{roomName[d.room_ID] || d.room_ID || "—"} · {d.time_start}–{d.time_end}</div>
                    </div>
                  </li>
                ))}
                {!dayData?.roster?.length && (
                  <li className="list-group-item text-muted py-3 text-center">
                    <i className="bi bi-calendar-x d-block mb-1" style={{ fontSize: 18 }} />
                    ไม่มีหมอลงตารางวันนี้
                  </li>
                )}
              </ul>
            </div>

            {/* โปรโมชั่น */}
            {(dayData?.promos || []).slice(0, 2).map((p, i) => (
              <div className="card shadow-sm mb-3" key={i}>
                {p.banner_image && <img src={p.banner_image} className="card-img-top" alt={p.name} style={{ height: 110, objectFit: "cover" }} />}
                <div className="card-body py-2">
                  <div className="fw-semibold small">{p.name}</div>
                  <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle mt-1">
                    <i className="bi bi-clock-history me-1" />ถึง {thShort(p.date_end)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── คอลัมน์ขวา: ปฏิทินรายเดือน (ref: FullCalendar card) — บนมือถือขึ้นก่อน ── */}
          <div className="col-lg-9 order-1 order-lg-2">
            <div className="card shadow-sm">
              <div className="card-header d-flex align-items-center flex-wrap gap-2 py-2">
                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => move(-1)} aria-label="เดือนก่อน"><i className="bi bi-chevron-left" /></button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => move(1)} aria-label="เดือนถัดไป"><i className="bi bi-chevron-right" /></button>
                </div>
                <button className="btn btn-outline-primary btn-sm" onClick={goToday}>วันนี้</button>
                <h5 className="fw-bold mb-0 mx-auto">
                  {MONTHS_TH[ym.m]} {ym.y + 543}
                  {loadingMonth && <span className="spinner-border spinner-border-sm text-primary ms-2" />}
                </h5>
                <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">
                  เดือนนี้ {(monthData?.days || []).reduce((s, d) => s + d.count, 0)} คิว
                </span>
              </div>

              {/* month grid */}
              <div className="card-body p-0">
                <div className="mcal">
                  <div className="mcal-head">
                    {DOW_TH.map((d, i) => <div key={d} className={i === 0 || i === 6 ? "text-danger" : ""}>{d}</div>)}
                  </div>
                  {weeks.map((row, w) => (
                    <div className="mcal-row" key={w}>
                      {row.map((cell) => {
                        const info = dayMap[cell.date];
                        const isToday = cell.date === todayStr();
                        const isSel = cell.date === selected;
                        return (
                          <button
                            key={cell.date}
                            className={`mcal-cell ${cell.inMonth ? "" : "out"} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
                            onClick={() => setSelected(cell.date)}
                          >
                            <span className={`mcal-day ${isToday ? "badge text-bg-primary rounded-circle" : ""}`}>{cell.day}</span>
                            {info && (
                              <>
                                {info.slots.slice(0, 3).map((s, i) => (
                                  <span key={i} className={`mcal-ev bg-${load(info.count)}`}>{s.time_start} จองแล้ว</span>
                                ))}
                                {info.count > 3 && <span className="mcal-more">+{info.count - 3} คิว</span>}
                                <span className={`mcal-count badge text-bg-${load(info.count)}`}>{info.count} คิว</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* รายละเอียดวันเลือก */}
            <div className="card shadow-sm mt-3">
              <div className="card-header d-flex align-items-center py-2">
                <span className="fw-semibold">
                  <i className="bi bi-calendar-event me-1 text-primary" />
                  คิววันที่ {(() => { const [y, m, d] = selected.split("-").map(Number); return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`; })()}
                </span>
                <span className="badge text-bg-primary ms-2">{dayData?.events?.length ?? 0} คิว</span>
                {loadingDay && <span className="spinner-border spinner-border-sm text-primary ms-2" />}
              </div>
              <div className="card-body">
                {(dayData?.rooms || []).length === 0 && (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-door-closed d-block mb-2" style={{ fontSize: 28 }} />
                    <div className="fw-semibold">ยังไม่มีข้อมูลห้องของวันนี้</div>
                    <small>เลือกวันอื่นในปฏิทิน หรือโทรสอบถามคิวได้เลย</small>
                  </div>
                )}
                <div className="row g-3">
                  {(dayData?.rooms || []).map((room) => {
                    const evs = dayByRoom[room.room_ID] || [];
                    const doc = roomDoctor[room.room_ID];
                    return (
                      <div className="col-md-4" key={room.room_ID}>
                        <div className="border rounded-3 h-100">
                          <div className="px-3 py-2 border-bottom bg-body-tertiary rounded-top-3 d-flex align-items-center">
                            <b className="small">{room.name}</b>
                            {doc && (
                              <span className="ms-auto small text-muted d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: doc.color, display: "inline-block" }} />
                                {doc.name}
                              </span>
                            )}
                          </div>
                          <div className="p-2 d-grid gap-1">
                            {evs.map((ev, i) => (
                              <span key={i} className="badge text-bg-danger-subtle text-danger border border-danger-subtle text-start fw-normal">
                                <i className="bi bi-lock-fill me-1" />{ev.time_start}–{ev.time_end} · จองแล้ว
                              </span>
                            ))}
                            {!evs.length && <span className="badge text-bg-success-subtle text-success border border-success-subtle fw-normal"><i className="bi bi-check2 me-1" />ว่างทั้งวัน</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-muted mt-3" style={{ fontSize: 12 }}>
                  สนใจจองช่วงที่ว่าง โทร {branch?.phone || "-"}{branch?.line_id ? ` หรือ LINE ${branch.line_id}` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center py-4 border-top bg-body">
        <small className="text-body-secondary">
          © {new Date().getFullYear()} {setup?.company?.name || brand.display_name}
          {branch?.phone ? ` · โทร ${branch.phone}` : ""}
        </small>
      </footer>
    </div>
  );
}
