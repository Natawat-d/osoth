"use client";
// กระดิ่งแจ้งเตือน (AdminLTE navbar) — RTK Query: รายการ + badge ยังไม่อ่าน
// socket "notify:new" → invalidate Notifications → กระดิ่งอัปเดตเองทั้งแอป
import { useState } from "react";
import { useGetNotificationsQuery, useReadNotificationsMutation } from "@/store/apiSlice";

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
      <button className="btn btn-link nav-link position-relative" onClick={toggle} aria-label="แจ้งเตือน">
        <i className="bi bi-bell fs-5" />
        {unread > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 10 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="position-fixed inset-0" style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 1049 }} onClick={() => setOpen(false)} />
          <div className="dropdown-menu dropdown-menu-end show shadow" style={{ position: "absolute", right: 0, top: "100%", width: 340, maxHeight: 420, overflowY: "auto", zIndex: 1050 }}>
            <div className="dropdown-header fw-bold">การแจ้งเตือน</div>
            {items.length === 0 && (
              <div className="dropdown-item-text text-center text-muted py-4">
                <i className="bi bi-bell-slash d-block mb-1 opacity-50" style={{ fontSize: 24 }} />
                <span className="small">ยังไม่มีการแจ้งเตือน</span>
              </div>
            )}
            {items.map((n) => (
              <div key={n.notif_ID} className={`dropdown-item-text border-top py-2 ${n.read ? "" : "bg-primary-subtle"}`}>
                <div className="fw-semibold small">
                  <i className={`bi me-1 ${n.type === "queue" ? "bi-clipboard2-pulse text-primary" : n.type === "stock" ? "bi-box-seam text-warning" : "bi-bell text-secondary"}`} />
                  {n.title}
                </div>
                {n.message && <div className="text-muted" style={{ fontSize: 12 }}>{n.message}</div>}
                <div className="text-muted" style={{ fontSize: 11 }}>{new Date(n.created_at).toLocaleString("th-TH")}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </li>
  );
}
