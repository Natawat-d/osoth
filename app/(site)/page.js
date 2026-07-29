"use client";
// root "/" — จุดกระจายทาง (ไม่มี UI): first-run → /register · login แล้ว → /app · ไม่งั้น → /about_me
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const s = await api("/setup/state");
        if (s.needs_owner) return router.replace("/register");
      } catch {}
      try {
        await api("/auth/me");
        router.replace("/app");
      } catch {
        router.replace("/about_me");
      }
    })();
  }, [router]);
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="spinner-border text-primary" />
    </div>
  );
}
