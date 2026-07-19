"use client";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useT } from "@/i18n/messages";
import { pushToast } from "@/store/uiSlice";

const STATUS_CLASS = {
  booked: "gray",
  arrived: "blue",
  ready: "gold",
  consulting: "purple",
  in_progress: "red",
  done: "green",
  consult_no_sale: "gray",
  cancelled: "gray",
  no_show: "orange",
  // opd case
  open: "gray",
  consulting_opd: "purple",
  measuring: "blue",
  bt_stage: "gold",
  doctor_stage: "red",
  closed: "green",
};

// ไอคอนกำกับสถานะ (ไม่พึ่งสีอย่างเดียว — WCAG 1.4.1 / F-09)
const STATUS_ICON = {
  booked: "○", arrived: "◑", ready: "◐", consulting: "◍", in_progress: "◉", done: "✓",
  consult_no_sale: "⊘", cancelled: "✕", no_show: "!", open: "○", measuring: "◑",
  bt_stage: "◐", doctor_stage: "◉", closed: "✓",
};

export function StatusBadge({ status }) {
  const t = useT();
  const cls = STATUS_CLASS[status] || "gray";
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-ico" aria-hidden>{STATUS_ICON[status] || "•"}</span>
      {t(`st_${status}`)}
    </span>
  );
}

// แถวชิปอธิบายสถานะ เหนือปฏิทิน (F-09) — บอกความหมายของสี + ไอคอน
export function StatusLegend({ statuses = ["booked", "arrived", "ready", "bt_stage", "doctor_stage", "done"] }) {
  return (
    <div className="legend-row" aria-label="คำอธิบายสถานะ">
      {statuses.map((s) => <StatusBadge key={s} status={s} />)}
    </div>
  );
}

// ---------- Toast + ปุ่ม async (F-01/F-04/F-11) ----------
export function useToast() {
  const dispatch = useDispatch();
  return {
    success: (message) => dispatch(pushToast({ type: "success", message })),
    error: (message) => dispatch(pushToast({ type: "error", message })),
    info: (message) => dispatch(pushToast({ type: "info", message })),
  };
}

// ปุ่มที่กันกดซ้ำ: onClick คืน Promise → ปิดปุ่ม + spinner ระหว่างทำงาน
// ok = ข้อความ toast เมื่อสำเร็จ (optional) — error โยน toast อัตโนมัติ
export function AsyncButton({ onClick, children, className = "btn", ok, disabled, ...rest }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={className} disabled={busy || disabled} onClick={run} {...rest}>
      {busy && <span className="spinner" aria-hidden />}
      {busy ? "กำลังทำงาน..." : children}
    </button>
  );
}

// ---------- Stepper ----------
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

// ---------- date/time helpers ----------
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// แสดงวันที่แบบไทย DD/MM/พ.ศ. (F-07) จาก "YYYY-MM-DD"
export function fmtThaiDate(s) {
  if (!s) return "-";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${+y + 543}`;
}

// เพิ่มนาทีให้เวลา "HH:mm" → "HH:mm" (24 ชม.) สำหรับ auto end-time (F-02)
export function addMinutes(hhmm, mins) {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  let total = h * 60 + m + (mins || 0);
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function money(n) {
  return (n ?? 0).toLocaleString("th-TH");
}

// ---------- label maps (F-08) ----------
export const ROLE_LABEL = {
  super_admin: "ผู้ดูแลระบบ",
  admin: "แอดมิน",
  acception: "แผนกต้อนรับ",
  sale: "ฝ่ายขาย",
  doctor: "แพทย์",
  BT: "บิวตี้เทอราปิสต์",
};
// ช่องทางชำระเงิน — เพิ่มช่องทางใหม่ในอนาคตที่นี่ที่เดียว (พร้อมพอย/e-wallet ฯลฯ)
export const PAY_METHODS = [
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอน/QR" },
  { value: "card", label: "บัตร" },
];
export const METHOD_LABEL = Object.fromEntries(PAY_METHODS.map((m) => [m.value, m.label]));
export const PAYTYPE_LABEL = {
  course_purchase: "ซื้อคอร์ส", installment: "ผ่อนงวด", add_on: "Add-on", deposit: "มัดจำ",
};
export const label = (map, key) => map[key] || key;
