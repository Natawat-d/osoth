"use client";
// hook เชื่อม socket service (V2) — ต่อด้วย JWT จาก localStorage
// event เข้า → invalidate RTK Query tags ที่เกี่ยว (ทุก component ที่ subscribe รีเฟรชเอง ไม่ต้อง prop-drill)
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import { apiSlice } from "@/store/apiSlice";
import { pushToast } from "@/store/uiSlice";

// event → RTK tags ที่ต้อง refetch
const EVENT_TAGS = {
  "reserve:changed": ["Reserves", "Dashboard"],
  "opd:stage": ["Opds", "Reserves", "Dashboard"],
  "stock:changed": ["Stock", "Dashboard"],
  "data:changed": ["Dashboard"],
  "notify:new": ["Notifications"],
};

export function socketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window === "undefined") return "";
  // dev: socket แยกพอร์ต 3002 · prod (หลัง nginx): origin เดียวกัน path /socket.io
  return window.location.port === "3001" || window.location.port === "3000"
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : window.location.origin;
}

export default function useRealtime() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("osoth_token") : null;
    if (!token) return;

    // path มี basePath นำหน้าเมื่อ deploy ใต้ subpath (nginx /osoth/socket.io → socket service)
    const s = io(socketUrl(), {
      path: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/socket.io`,
      auth: { token },
      reconnectionAttempts: 10,
      timeout: 4000,
    });
    sockRef.current = s;

    for (const [event, tags] of Object.entries(EVENT_TAGS)) {
      s.on(event, (payload) => {
        dispatch(apiSlice.util.invalidateTags(tags));
        if (event === "notify:new" && payload?.title) {
          dispatch(pushToast({ type: "info", message: `🔔 ${payload.title}${payload.message ? " — " + payload.message : ""}` }));
        }
      });
    }
    return () => { s.disconnect(); sockRef.current = null; };
  }, [user, dispatch]);

  return sockRef;
}
