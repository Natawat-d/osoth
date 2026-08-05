"use client";
// กระดิ่งแจ้งเตือน (AdminLTE navbar) — RTK Query: รายการ + badge ยังไม่อ่าน
// socket "notify:new" → invalidate Notifications → กระดิ่งอัปเดตเองทั้งแอป
import { useState } from "react";
import { useGetNotificationsQuery, useReadNotificationsMutation } from "@/store/apiSlice";

const TYPE_META = {
  queue: { ico: "bi-clipboard2-pulse", fg: "var(--bs-primary)", bg: "rgba(21, 96, 163, 0.12)" },
  stock: { ico: "bi-box-seam", fg: "#c07f00", bg: "rgba(255, 193, 7, 0.16)" },
};
const TYPE_DEFAULT = { ico: "bi-bell", fg: "var(--bs-secondary-color)", bg: "var(--bs-secondary-bg)" };

export default function NotifyBell() {
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useGetNotificationsQuery(undefined, { pollingInterval: 60000 });
  const [readAll] = useReadNotificationsMutation();
  const unread = items.filter((n) => !n.read).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) readAll(); // เปิดดู = อ่านแล้ว
  }

  return (
    <li className="nav-item position-relative">
      <button className="btn btn-link nav-link position-relative nbell-btn" onClick={toggle} aria-label="แจ้งเตือน">
        <i className="bi bi-bell fs-5" />
        {unread > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger nbell-badge" style={{ fontSize: 10 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="position-fixed inset-0" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1049 }} onClick={() => setOpen(false)} />
          <div className="dropdown-menu dropdown-menu-end show nbell-menu"
            style={{ position: "absolute", right: 0, top: "100%", width: 350, maxHeight: 430, overflowY: "auto", zIndex: 1050 }}>
            <div className="dropdown-header d-flex align-items-center py-2">
              <span className="fw-bold nbell-title">การแจ้งเตือน</span>
              {items.length > 0 && <span className="badge rounded-pill ms-auto nbell-count">{items.length} รายการ</span>}
            </div>
            <div className="nbell-rule" aria-hidden="true" />
            {items.length === 0 && (
              <div className="dropdown-item-text text-center text-muted py-4">
                <span className="nbell-empty-orb d-inline-flex align-items-center justify-content-center rounded-circle mb-2">
                  <i className="bi bi-bell-slash" />
                </span>
                <div className="small fw-semibold">ยังไม่มีการแจ้งเตือน</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>เรื่องใหม่จะเด้งมาที่นี่ทันที</div>
              </div>
            )}
            {items.map((n, idx) => {
              const meta = TYPE_META[n.type] || TYPE_DEFAULT;
              return (
                <div key={n.notif_ID} className={`dropdown-item-text nbell-item py-2 ${n.read ? "" : "nbell-unread"}`}
                  style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}>
                  <div className="d-flex gap-2">
                    <span className="nbell-ico d-inline-flex flex-shrink-0 align-items-center justify-content-center rounded-circle"
                      style={{ color: meta.fg, background: meta.bg }}>
                      <i className={`bi ${meta.ico}`} />
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold small text-truncate">{n.title}</div>
                      {n.message && <div className="text-muted" style={{ fontSize: 12 }}>{n.message}</div>}
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        <i className="bi bi-clock me-1" />{new Date(n.created_at).toLocaleString("th-TH")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <style jsx>{`
        .nbell-btn { border-radius: 50%; transition: background 0.18s ease, transform 0.15s ease; }
        .nbell-btn:hover { background: var(--bs-secondary-bg); }
        .nbell-btn:active { transform: scale(0.92); }
        .nbell-btn:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px; box-shadow: none; }
        .nbell-badge { box-shadow: 0 0 0 2px var(--bs-body-bg); animation: nbPulse 2.2s ease-out infinite; }
        @keyframes nbPulse {
          0% { box-shadow: 0 0 0 2px var(--bs-body-bg), 0 0 0 0 rgba(220, 53, 69, 0.45); }
          70% { box-shadow: 0 0 0 2px var(--bs-body-bg), 0 0 0 7px rgba(220, 53, 69, 0); }
          100% { box-shadow: 0 0 0 2px var(--bs-body-bg), 0 0 0 0 rgba(220, 53, 69, 0); }
        }
        .nbell-menu { border: 1px solid var(--bs-border-color-translucent); border-radius: 0.9rem; padding-top: 0.35rem;
          box-shadow: 0 18px 42px -14px rgba(16, 24, 40, 0.28), 0 4px 12px rgba(16, 24, 40, 0.08);
          animation: nbIn 0.2s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
        @keyframes nbIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
        .nbell-title { letter-spacing: 0.01em; color: var(--bs-body-color); }
        .nbell-count { background: rgba(21, 96, 163, 0.12); color: var(--bs-primary); font-weight: 600; }
        .nbell-rule { height: 2px; margin: 0 1rem 0.25rem;
          background: linear-gradient(90deg, #1560a3, #2a7bc4, transparent); border-radius: 2px; opacity: 0.85; }
        .nbell-item { border-top: 1px solid var(--bs-border-color-translucent);
          animation: nbItem 0.28s ease both; transition: background 0.15s ease; }
        .nbell-item:hover { background: var(--bs-secondary-bg); }
        @keyframes nbItem { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .nbell-unread { background: var(--bs-primary-bg-subtle); box-shadow: inset 3px 0 0 var(--bs-primary); }
        .nbell-ico { width: 34px; height: 34px; font-size: 15px; }
        .nbell-empty-orb { width: 50px; height: 50px; font-size: 22px;
          background: var(--bs-secondary-bg); color: var(--bs-secondary-color); }
        @media (prefers-reduced-motion: reduce) {
          .nbell-badge, .nbell-menu, .nbell-item { animation: none; }
        }
      `}</style>
    </li>
  );
}
