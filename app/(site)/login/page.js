"use client";
// หน้าเข้าสู่ระบบ (/login) — การ์ดลอยกลางจอบนพื้นหลัง gradient แบรนด์ · ตัด google/social auth
// auth ผ่าน Redux: useLoginUserMutation (RTK Query) → dispatch login เข้า authSlice
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { login } from "@/store/authSlice";
import { useGetSetupStateQuery, useLoginUserMutation } from "@/store/apiSlice";

export default function LoginPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: setup } = useGetSetupStateQuery();
  const [loginUser, { isLoading }] = useLoginUserMutation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // ถ้ายังไม่มี owner → เด้งไปหน้าสมัคร owner
  useEffect(() => {
    if (setup?.needs_owner) router.replace("/register");
  }, [setup, router]);

  const brand = setup?.company?.brand || { display_name: "Osoth", logo: "/brand/logo.jpg" };

  async function submit(e) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    try {
      const data = await loginUser({ username, password }).unwrap();
      dispatch(login(data));
      router.push("/app");
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  }

  return (
    <div className="osoth-auth-bg auth-lux position-relative overflow-hidden">
      {/* เลเยอร์ตกแต่งพื้นหลัง — CSS ล้วน */}
      <div aria-hidden className="auth-grid position-absolute top-0 start-0 w-100 h-100" />
      <div aria-hidden className="auth-orb auth-orb-1" />
      <div aria-hidden className="auth-orb auth-orb-2" />
      <div aria-hidden className="auth-ring" />

      <div className="card border-0 auth-card position-relative" style={{ width: 410, maxWidth: "100%" }}>
        <div className="card-body p-4 p-sm-5">
          <div className="text-center mb-4">
            <div className="osoth-logo-box mx-auto mb-3 auth-logo">
              <img src={`${bp}${brand.logo}`} alt="logo" />
            </div>
            <h4 className="fw-bold mb-1 auth-brand-name">{brand.display_name}</h4>
            <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-semibold">
              <i className="bi bi-person-badge me-1" />สำหรับพนักงาน
            </span>
            <div className="text-body-secondary small mt-2 auth-sub">Healthcare Operator System</div>
          </div>

          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label auth-label">ชื่อผู้ใช้</label>
              <div className="input-group auth-group">
                <span className="input-group-text"><i className="bi bi-person" /></span>
                <input className="form-control" value={username} autoFocus autoComplete="username"
                       placeholder="username" onChange={(e) => setUsername(e.target.value)} />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label auth-label">รหัสผ่าน</label>
              <div className="input-group auth-group">
                <span className="input-group-text"><i className="bi bi-lock" /></span>
                <input type="password" className="form-control" value={password} autoComplete="current-password"
                       placeholder="••••••" onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary d-block ms-auto px-4 fw-semibold auth-submit"
                    disabled={isLoading || !username || !password}>
              {isLoading ? "กำลังเข้าสู่ระบบ…" : <><i className="bi bi-box-arrow-in-right me-1" /> เข้าสู่ระบบ</>}
            </button>
          </form>

          <hr className="my-4 opacity-25" />
          <div className="d-flex justify-content-center gap-3 small">
            <Link href="/about_me" className="text-decoration-none auth-link">
              <i className="bi bi-house me-1" />หน้าแรก
            </Link>
            <span className="text-body-tertiary">·</span>
            <Link href="/calendar" className="text-decoration-none auth-link">
              <i className="bi bi-calendar-check me-1" />ลูกค้าดูคิว / จอง
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* เสริมชั้นบนพื้นหลัง gradient กลาง (.osoth-auth-bg) — ตกแต่งเฉพาะหน้านี้ */
        .auth-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 54px 54px;
          mask-image: radial-gradient(75% 85% at 50% 45%, #000 25%, transparent 100%);
          -webkit-mask-image: radial-gradient(75% 85% at 50% 45%, #000 25%, transparent 100%);
          pointer-events: none;
        }
        .auth-orb { position: absolute; border-radius: 50%; filter: blur(64px); pointer-events: none; }
        .auth-orb-1 {
          width: 460px; height: 460px; top: -160px; right: -100px;
          background: radial-gradient(circle, rgba(110, 188, 252, 0.42), transparent 70%);
          animation: authFloat 14s ease-in-out infinite;
        }
        .auth-orb-2 {
          width: 380px; height: 380px; bottom: -170px; left: -110px;
          background: radial-gradient(circle, rgba(6, 30, 54, 0.7), transparent 70%);
          animation: authFloat 18s ease-in-out infinite reverse;
        }
        @keyframes authFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(12px, -16px); }
        }
        .auth-ring {
          position: absolute; width: 620px; height: 620px; border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .auth-card {
          border-radius: 1.35rem;
          box-shadow: 0 10px 30px rgba(3, 18, 33, 0.35), 0 30px 70px rgba(3, 18, 33, 0.35);
          animation: authIn 0.4s ease both;
        }
        @keyframes authIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-logo {
          width: 84px; height: 84px; border-radius: 20px;
          box-shadow: 0 0 0 4px rgba(21, 96, 163, 0.14), 0 12px 28px rgba(21, 96, 163, 0.3);
        }
        .auth-brand-name { letter-spacing: -0.01em; }
        .auth-sub { letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.68rem; }
        .auth-label { font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em; }
        .auth-group .input-group-text { background: transparent; }
        .auth-group .form-control, .auth-group .input-group-text { border-radius: 0.65rem; }
        .auth-submit {
          background: linear-gradient(135deg, #1560a3, #2a7bc4);
          border: 0; border-radius: 0.7rem;
          box-shadow: 0 6px 16px rgba(21, 96, 163, 0.35);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
        }
        .auth-submit:hover:not(:disabled) {
          transform: translateY(-1px); filter: brightness(1.05);
          box-shadow: 0 9px 22px rgba(21, 96, 163, 0.45);
        }
        .auth-submit:active:not(:disabled) { transform: scale(0.97); }
        /* :global — <Link> ไม่ได้รับ jsx hash class */
        :global(.auth-link) { transition: opacity 0.15s ease; }
        :global(.auth-link:hover) { opacity: 0.8; }
        @media (prefers-reduced-motion: reduce) {
          .auth-orb-1, .auth-orb-2 { animation: none; }
          .auth-card { animation: none; }
        }
      `}</style>
    </div>
  );
}
