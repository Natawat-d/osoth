"use client";
// หน้าเข้าสู่ระบบ (/login) — AdminLTE login box · ตัด google/social auth
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
    <div className="osoth-auth-bg">
      <div className="card shadow-lg border-0" style={{ width: 400, maxWidth: "100%" }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <div className="osoth-logo-box mx-auto mb-2">
              <img src={`${bp}${brand.logo}`} alt="logo" />
            </div>
            <h4 className="fw-bold mb-0">{brand.display_name}</h4>
            <small className="text-muted">Healthcare Operator System — เข้าสู่ระบบพนักงาน</small>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label">ชื่อผู้ใช้</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-person" /></span>
                <input className="form-control" value={username} autoFocus autoComplete="username"
                       placeholder="username" onChange={(e) => setUsername(e.target.value)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">รหัสผ่าน</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock" /></span>
                <input type="password" className="form-control" value={password} autoComplete="current-password"
                       placeholder="••••••" onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary d-block ms-auto px-4 fw-semibold" disabled={isLoading || !username || !password}>
              {isLoading ? "กำลังเข้าสู่ระบบ…" : <><i className="bi bi-box-arrow-in-right me-1" /> เข้าสู่ระบบ</>}
            </button>
          </form>

          <div className="text-center mt-3">
            <Link href="/about_me" className="text-decoration-none small">← กลับหน้าแรก</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
