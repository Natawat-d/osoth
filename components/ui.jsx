"use client";
import { useT } from "@/i18n/messages";

const STATUS_CLASS = {
  booked: "gray",
  arrived: "blue",
  ready: "gold",
  in_progress: "red",
  done: "green",
  cancelled: "gray",
  no_show: "orange",
  // opd case
  open: "gray",
  measuring: "blue",
  bt_stage: "gold",
  doctor_stage: "red",
  closed: "green",
};

export function StatusBadge({ status }) {
  const t = useT();
  const cls = STATUS_CLASS[status] || "gray";
  return <span className={`badge ${cls}`}>{t(`st_${status}`)}</span>;
}

// Stepper แสดงลำดับสถานะการทำงาน (คิว / เคสหัตถการ)
// steps: [{ key, label }], current = key ปัจจุบัน, skipped = Set/array ของ key ที่ถูกข้าม
// current = key ปัจจุบัน, หรือ "__complete__" เมื่อเสร็จทุกขั้น (ทุกจุดเป็น done)
export function Stepper({ steps, current, skipped = [] }) {
  const skip = new Set(skipped);
  const idx =
    current === "__complete__" ? steps.length : steps.findIndex((s) => s.key === current);
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const isSkipped = skip.has(s.key) && i < idx;
        const state =
          i < idx ? (isSkipped ? "skipped" : "done") : i === idx ? "current" : "pending";
        return (
          <div key={s.key} className={`step ${state}`}>
            <div className="dot">
              {state === "done" ? "✓" : state === "skipped" ? "–" : i + 1}
            </div>
            <div className="step-label">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function money(n) {
  return (n ?? 0).toLocaleString("th-TH");
}
