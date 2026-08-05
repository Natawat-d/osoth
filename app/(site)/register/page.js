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
    <div className="osoth-auth-bg">
      <div className="card shadow-lg border-0 my-4" style={{ width: 640, maxWidth: "100%" }}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <div className="osoth-logo-box mx-auto mb-2"><img src={`${bp}/brand/logo.jpg`} alt="logo" /></div>
            <h4 className="fw-bold mb-0">ตั้งค่าระบบครั้งแรก</h4>
            <small className="text-muted">สมัครบัญชีเจ้าของระบบ (Owner) และข้อมูลบริษัท</small>
          </div>

          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <h6 className="fw-bold text-primary mt-2"><i className="bi bi-building me-1" /> ข้อมูลบริษัท</h6>
            <div className="row g-3 mb-3">
              <div className="col-12">
                <label className="form-label">ชื่อบริษัท / คลินิก *</label>
                <input className="form-control" value={f.company_name} onChange={set("company_name")} required />
              </div>
              <div className="col-md-8">
                <label className="form-label">ที่อยู่</label>
                <input className="form-control" value={f.address} onChange={set("address")} />
              </div>
              <div className="col-md-4">
                <label className="form-label">เลขผู้เสียภาษี</label>
                <input className="form-control" value={f.tax_id} onChange={set("tax_id")} />
              </div>
              <div className="col-md-4">
                <label className="form-label">เบอร์บริษัท</label>
                <input className="form-control" value={f.company_phone} onChange={set("company_phone")} />
              </div>
            </div>

            <h6 className="fw-bold text-primary mt-2"><i className="bi bi-person-badge me-1" /> บัญชีเจ้าของ (Owner)</h6>
            <div className="row g-3 mb-3">
              <div className="col-md-8">
                <label className="form-label">ชื่อ-นามสกุล *</label>
                <input className="form-control" value={f.full_name} onChange={set("full_name")} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">ชื่อเล่น</label>
                <input className="form-control" value={f.nick_name} onChange={set("nick_name")} />
              </div>
              <div className="col-md-6">
                <label className="form-label">ชื่อผู้ใช้ (username) *</label>
                <input className="form-control" value={f.username} onChange={set("username")} autoComplete="username" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">เบอร์โทร</label>
                <input className="form-control" value={f.phone} onChange={set("phone")} />
              </div>
              <div className="col-md-6">
                <label className="form-label">รหัสผ่าน *</label>
                <input type="password" className="form-control" value={f.password} onChange={set("password")} autoComplete="new-password" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">ยืนยันรหัสผ่าน *</label>
                <input type="password" className="form-control" value={f.password2} onChange={set("password2")} autoComplete="new-password" required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary d-block ms-auto px-4 fw-semibold" disabled={busy}>
              {busy ? "กำลังสร้างระบบ…" : <><i className="bi bi-check2-circle me-1" /> สร้างระบบ & เข้าใช้งาน</>}
            </button>
          </form>

          <div className="text-center mt-3">
            <Link href="/about_me" className="text-decoration-none small">
              <i className="bi bi-house me-1" />กลับหน้าแรก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
