"use client";
// การแจ้งเตือน — หน้าเต็มสไตล์ AdminLTE mailbox/inbox (ข้อ 19)
// ซ้าย: โฟลเดอร์/ตัวกรอง · ขวา: รายการแจ้งเตือน (อ่าน/ยังไม่อ่าน) · realtime ผ่าน socket → รีเฟรชเอง
import { useMemo, useState } from "react";
import Link from "next/link";
import { useGetNotificationsQuery, useReadNotificationsMutation } from "@/store/apiSlice";
import InfoBox from "@/components/InfoBox";

const TYPE_META = {
  queue: { label: "คิว/เคส", ico: "bi-clipboard2-pulse", color: "warning" },
  stock: { label: "สต๊อก", ico: "bi-box-seam", color: "danger" },
  finance: { label: "การเงิน", ico: "bi-cash-coin", color: "success" },
  info: { label: "ทั่วไป", ico: "bi-info-circle", color: "primary" },
};

export default function NotificationsPage() {
  const { data: items = [], isFetching } = useGetNotificationsQuery(undefined, { pollingInterval: 60000 });
  const [readAll, { isLoading: marking }] = useReadNotificationsMutation();
  const [folder, setFolder] = useState("all"); // all | unread | queue | stock | info

  const unread = items.filter((n) => !n.read).length;
  const filtered = useMemo(() => items.filter((n) => {
    if (folder === "all") return true;
    if (folder === "unread") return !n.read;
    return n.type === folder;
  }), [items, folder]);

  const FOLDERS = [
    { key: "all", label: "ทั้งหมด", ico: "bi-inbox", count: items.length },
    { key: "unread", label: "ยังไม่อ่าน", ico: "bi-envelope", count: unread },
    { key: "queue", label: "คิว/เคส", ico: "bi-clipboard2-pulse", count: items.filter((n) => n.type === "queue").length },
    { key: "stock", label: "สต๊อก", ico: "bi-box-seam", count: items.filter((n) => n.type === "stock").length },
    { key: "info", label: "ทั่วไป", ico: "bi-info-circle", count: items.filter((n) => n.type === "info").length },
  ];

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-2 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">การแจ้งเตือน</h4>
          {isFetching && <span className="spinner-border spinner-border-sm text-primary" />}
          <button className="btn btn-outline-primary btn-sm ms-auto" disabled={marking || unread === 0} onClick={() => readAll()}>
            <i className="bi bi-check2-all me-1" /> อ่านทั้งหมดแล้ว
          </button>
        </div>
        <div className="row g-2 mb-3">
          <div className="col-md-3 col-6"><InfoBox ico="bi-inbox" label="ทั้งหมด" value={items.length} color="primary" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-envelope" label="ยังไม่อ่าน" value={unread} color="danger" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-clipboard2-pulse" label="คิว/เคส" value={FOLDERS[2].count} color="warning" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-box-seam" label="สต๊อก" value={FOLDERS[3].count} color="secondary" /></div>
        </div>

        <div className="row g-3">
          {/* โฟลเดอร์ (สไตล์ mailbox) */}
          <div className="col-lg-3">
            <div className="card shadow-sm">
              <div className="list-group list-group-flush">
                {FOLDERS.map((f) => (
                  <button key={f.key}
                          className={`list-group-item list-group-item-action d-flex align-items-center ${folder === f.key ? "active" : ""}`}
                          onClick={() => setFolder(f.key)}>
                    <i className={`bi ${f.ico} me-2`} />{f.label}
                    <span className={`badge ms-auto ${folder === f.key ? "text-bg-light" : "text-bg-secondary"}`}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* รายการ */}
          <div className="col-lg-9">
            <div className="card shadow-sm">
              <div className="list-group list-group-flush">
                {filtered.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.info;
                  return (
                    <div key={n.notif_ID} className={`list-group-item d-flex gap-3 align-items-start ${n.read ? "" : "bg-primary-subtle"}`}>
                      <span className={`d-inline-flex align-items-center justify-content-center rounded-2 text-bg-${meta.color} mt-1`}
                            style={{ width: 38, height: 38 }}>
                        <i className={`bi ${meta.ico}`} />
                      </span>
                      <div className="min-w-0 flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                          <b className="text-truncate">{n.title}</b>
                          {!n.read && <span className="badge text-bg-danger">ใหม่</span>}
                          <span className="text-muted small ms-auto text-nowrap">{new Date(n.created_at).toLocaleString("th-TH")}</span>
                        </div>
                        {n.message && <div className="text-muted small">{n.message}</div>}
                        {n.ref?.href && <Link href={n.ref.href} className="small">เปิดดู →</Link>}
                      </div>
                    </div>
                  );
                })}
                {!filtered.length && (
                  <div className="list-group-item text-center text-muted py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2" />— ไม่มีแจ้งเตือน{folder === "unread" ? "ที่ยังไม่อ่าน" : ""} —
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
