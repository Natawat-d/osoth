"use client";
// Toaster ฝั่ง V2 (Bootstrap) — อ่าน ui.toasts จาก store เดียวกับ legacy Toaster
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { dismissToast } from "@/store/uiSlice";

export default function BsToaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dispatch(dismissToast(toasts[0].id)), 4500);
    return () => clearTimeout(t);
  }, [toasts, dispatch]);

  if (!toasts.length) return null;
  const color = { success: "text-bg-success", error: "text-bg-danger", info: "text-bg-dark" };
  return (
    <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 2000 }}>
      {toasts.map((t) => (
        <div key={t.id} className={`toast show ${color[t.type] || "text-bg-dark"} border-0 mb-2`} role="alert">
          <div className="d-flex">
            <div className="toast-body">{t.message}</div>
            <button className="btn-close btn-close-white me-2 m-auto" onClick={() => dispatch(dismissToast(t.id))} />
          </div>
        </div>
      ))}
    </div>
  );
}
