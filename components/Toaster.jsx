"use client";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { dismissToast } from "@/store/uiSlice";

export default function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  const dispatch = useDispatch();
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} t={t} onClose={() => dispatch(dismissToast(t.id))} />
      ))}
    </div>
  );
}

function Toast({ t, onClose }) {
  useEffect(() => {
    const ms = t.type === "error" ? 5000 : 3000;
    const id = setTimeout(onClose, ms);
    return () => clearTimeout(id);
  }, [onClose, t.type]);
  const ico = { success: "✓", error: "✕", info: "•" }[t.type] || "•";
  return (
    <div className={`toast ${t.type}`} role="status" onClick={onClose}>
      <span className="toast-ico">{ico}</span>
      <span className="toast-msg">{t.message}</span>
    </div>
  );
}
