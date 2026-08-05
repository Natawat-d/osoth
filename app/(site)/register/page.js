"use client";
// สมัครเจ้าของระบบคนแรก (/register) — first-run เท่านั้น
// ผ่าน Redux: useRegisterOwnerMutation → invalidate SetupState (ทุกหน้ารู้ทันทีว่ามี owner แล้ว)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { login } from "@/store/authSlice";
import { useGetSetupStateQuery, useRegisterOwnerMutation } from "@/store/apiSlice";

export default function RegisterOwnerPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: setup, isLoading: checking } = useGetSetupStateQuery();
  const [registerOwner, { isLoading: busy }] = useRegisterOwnerMutation();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false); // สมัครสำเร็จแล้ว — กัน effect ล่างเด้ง /login แข่งกับ push /app
  const [f, setF] = useState({
    company_name: "", address: "", tax_id: "", company_phone: "",
    full_name: "", nick_name: "", username: "", password: "", password2: "", phone: "",
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // มี owner แล้ว → ไป login (ยกเว้นเพิ่งสมัครสำเร็จเอง — ให้ไป /app)
  useEffect(() => {
    if (!done && setup && !setup.needs_owner) router.replace("/login");
  }, [done, setup, router]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (f.password.length < 4) return setError("รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร");
    if (f.password !== f.password2) return setError("รหัสผ่านยืนยันไม่ตรงกัน");
    try {
      const data = await registerOwner({
        company: { name: f.company_name, address: f.address, tax_id: f.tax_id, phone: f.company_phone },
        owner: { full_name: f.full_name, nick_name: f.nick_name, username: f.username, password: f.password, phone: f.phone },
      }).unwrap();
      setDone(true);
      dispatch(login(data));
      router.push("/app");
    } catch (err) {
      setError(err.message || "สมัครไม่สำเร็จ");
    }
  }

  if (checking) return <div className="osoth-auth-bg"><div className="spinner-border text-light" /></div>;

  return (
    <div className="osoth-auth-bg auth-lux position-relative overflow-hidden">
      {/* เลเยอร์ตกแต่งพื้นหลัง — CSS ล้วน */}
      <div aria-hidden className="auth-grid position-absolute top-0 start-0 w-100 h-100" />
      <div aria-hidden className="auth-orb auth-orb-1" />
      <div aria-hidden className="auth-orb auth-orb-2" />

      <div className="card border-0 my-4 auth-card position-relative" style={{ width: 660, maxWidth: "100%" }}>
        <div className="card-body p-4 p-sm-5">
          <div className="text-center mb-4">
            <div className="osoth-logo-box mx-auto mb-3 auth-logo"><img src={`${bp}/brand/logo.jpg`} alt="logo" /></div>
            <h4 className="fw-bold mb-1">ตั้งค่าระบบครั้งแรก</h4>
            <small className="text-body-secondary">สมัครบัญชีเจ้าของระบบ (Owner) และข้อมูลบริษัท</small>
          </div>

          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <h6 className="fw-bold text-primary mt-2 d-flex align-items-center gap-2 auth-sec">
              <span className="auth-sec-tile"><i className="bi bi-building" /></span> ข้อมูลบริษัท
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-12">
                <label className="form-label auth-label">ชื่อบริษัท / คลินิก *</label>
                <input className="form-control" value={f.company_name} onChange={set("company_name")} required />
              </div>
              <div className="col-md-8">
                <label className="form-label auth-label">ที่อยู่</label>
                <input className="form-control" value={f.address} onChange={set("address")} />
              </div>
              <div className="col-md-4">
                <label className="form-label auth-label">เลขผู้เสียภาษี</label>
                <input className="form-control" value={f.tax_id} onChange={set("tax_id")} />
              </div>
              <div className="col-md-4">
                <label className="form-label auth-label">เบอร์บริษัท</label>
                <input className="form-control" value={f.company_phone} onChange={set("company_phone")} />
              </div>
            </div>

            <h6 className="fw-bold text-primary mt-2 d-flex align-items-center gap-2 auth-sec">
              <span className="auth-sec-tile"><i className="bi bi-person-badge" /></span> บัญชีเจ้าของ (Owner)
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-md-8">
                <label className="form-label auth-label">ชื่อ-นามสกุล *</label>
                <input className="form-control" value={f.full_name} onChange={set("full_name")} required />
              </div>
              <div className="col-md-4">
                <label className="form-label auth-label">ชื่อเล่น</label>
                <input className="form-control" value={f.nick_name} onChange={set("nick_name")} />
              </div>
              <div className="col-md-6">
                <label className="form-label auth-label">ชื่อผู้ใช้ (username) *</label>
                <input className="form-control" value={f.username} onChange={set("username")} autoComplete="username" required />
              </div>
              <div className="col-md-6">
                <label className="form-label auth-label">เบอร์โทร</label>
                <input className="form-control" value={f.phone} onChange={set("phone")} />
              </div>
              <div className="col-md-6">
                <label className="form-label auth-label">รหัสผ่าน *</label>
                <input type="password" className="form-control" value={f.password} onChange={set("password")} autoComplete="new-password" required />
              </div>
              <div className="col-md-6">
                <label className="form-label auth-label">ยืนยันรหัสผ่าน *</label>
                <input type="password" className="form-control" value={f.password2} onChange={set("password2")} autoComplete="new-password" required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary d-block ms-auto px-4 fw-semibold auth-submit" disabled={busy}>
              {busy ? "กำลังสร้างระบบ…" : <><i className="bi bi-check2-circle me-1" /> สร้างระบบ & เข้าใช้งาน</>}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link href="/about_me" className="text-decoration-none small auth-link">
              <i className="bi bi-house me-1" />กลับหน้าแรก
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
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
        .auth-label { font-size: 0.82rem; font-weight: 600; letter-spacing: 0.02em; }
        .auth-sec { letter-spacing: 0.01em; margin-bottom: 0.9rem; }
        .auth-sec-tile {
          width: 32px; height: 32px; border-radius: 0.6rem;
          display: inline-flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #1560a3, #2a7bc4); color: #fff; font-size: 15px;
          box-shadow: 0 4px 10px rgba(21, 96, 163, 0.3);
        }
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
