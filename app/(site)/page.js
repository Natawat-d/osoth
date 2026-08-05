"use client";
// root "/" — จุดกระจายทาง (ไม่มี UI): first-run → /register · login แล้ว → /app · ไม่งั้น → /about_me
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
    <div className="d-flex flex-column align-items-center justify-content-center gap-3 boot-bg position-relative overflow-hidden"
         style={{ minHeight: "100vh" }}>
      <div aria-hidden className="boot-orb boot-orb-1" />
      <div aria-hidden className="boot-orb boot-orb-2" />
      <div className="boot-logo position-relative">
        <img src={`${bp}/brand/logo.jpg`} alt="Osoth" width={72} height={72} />
      </div>
      <div className="d-flex align-items-center gap-2 position-relative">
        <div className="spinner-border spinner-border-sm text-primary" role="status" aria-label="กำลังโหลด" />
        <small className="text-body-secondary">กำลังเปิดระบบ…</small>
      </div>

      <style jsx>{`
        .boot-bg {
          background:
            radial-gradient(720px 380px at 80% -10%, rgba(21, 96, 163, 0.12), transparent 65%),
            radial-gradient(640px 360px at 10% 110%, rgba(42, 123, 196, 0.1), transparent 65%),
            var(--bs-tertiary-bg);
        }
        .boot-orb { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; }
        .boot-orb-1 {
          width: 340px; height: 340px; top: -120px; right: -60px;
          background: radial-gradient(circle, rgba(21, 96, 163, 0.16), transparent 70%);
        }
        .boot-orb-2 {
          width: 300px; height: 300px; bottom: -130px; left: -80px;
          background: radial-gradient(circle, rgba(42, 123, 196, 0.14), transparent 70%);
        }
        .boot-logo {
          width: 88px; height: 88px; border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #1560a3, #2a7bc4);
          box-shadow: 0 14px 34px rgba(21, 96, 163, 0.35);
          animation: bootPulse 2.2s ease-in-out infinite;
        }
        .boot-logo img { border-radius: 16px; object-fit: cover; }
        @keyframes bootPulse {
          0%, 100% { box-shadow: 0 14px 34px rgba(21, 96, 163, 0.35), 0 0 0 0 rgba(21, 96, 163, 0.25); }
          50% { box-shadow: 0 14px 34px rgba(21, 96, 163, 0.35), 0 0 0 16px rgba(21, 96, 163, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .boot-logo { animation: none; } }
      `}</style>
    </div>
  );
}
