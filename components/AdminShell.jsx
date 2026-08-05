"use client";
// AdminShell — เปลือกเดียวของทั้งระบบ (AdminLTE v4): navbar + sidebar + content
// ทุกโมดูลอยู่ใต้ /app — เมนูตาม role + route guard · data ผ่าน Redux/RTK Query ไม่ prop-drill
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { login, logout, setReady, clearMustChange } from "@/store/authSlice";
import { setLang } from "@/store/uiSlice";
import { useGetSetupStateQuery, useLogoutUserMutation, useChangePasswordMutation } from "@/store/apiSlice";
import { api } from "@/lib/client";
import useRealtime from "@/lib/useRealtime";
import NotifyBell from "@/components/NotifyBell";
import BsToaster from "@/components/BsToaster";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
const ALL = ["super_admin", "admin", "sale", "doctor", "BT"];

// เมนู V3 (5 roles): admin = จอง+รับลูกค้า+OPD · sale = จอง+รับลูกค้า+ขายตอนจอง · งานบริหาร = owner
// owner: ผู้บริหารอยู่บนสุด (ถัดจากภาพรวม) และไม่เห็นกลุ่ม "บุคคล" (ลงเวลา/ลา — ของพนักงาน)
const STAFF = ["admin", "sale", "doctor", "BT"];
const MENU = [
  { header: "ภาพรวม" },
  { href: "/app", ico: "bi-speedometer2", label: "Dashboard", roles: ["super_admin"] },
  { href: "/app/notifications", ico: "bi-bell", label: "การแจ้งเตือน", roles: ALL },
  { header: "ผู้บริหาร" },
  { href: "/app/setup", ico: "bi-sliders", label: "ตั้งค่าธุรกิจ (Setup)", roles: ["super_admin"] },
  { href: "/app/inventory", ico: "bi-box-seam", label: "คลังสินค้า (Inventory)", roles: ["super_admin"] },
  { href: "/app/finance", ico: "bi-cash-coin", label: "การเงิน/บัญชี (Finance)", roles: ["super_admin"] },
  { href: "/app/hr", ico: "bi-people", label: "บุคคล (HR)", roles: ["super_admin"] },
  { header: "งานหน้าร้าน" },
  { href: "/app/booking", ico: "bi-calendar-week", label: "ปฏิทิน (จองคิว)", roles: ["super_admin", "admin", "sale"] },
  { href: "/app/reception", ico: "bi-bell-fill", label: "ปฏิทิน (รับลูกค้า)", roles: ["super_admin", "admin", "sale"] },
  { href: "/app/opd", ico: "bi-clipboard2-pulse", label: "OPD / หน้าห้อง", roles: ["super_admin", "admin", "doctor", "BT"] },
  { href: "/app/customers", ico: "bi-person-vcard", label: "ลูกค้า (HN)", roles: ["super_admin", "admin", "sale"] },
  { header: "บุคคล" },
  { href: "/app/attendance", ico: "bi-clock-history", label: "ลงเวลาเข้างาน", roles: STAFF },
  { href: "/app/leaves", ico: "bi-journal-minus", label: "ลางาน", roles: STAFF },
  { href: "/app/my-earnings", ico: "bi-graph-up-arrow", label: "รายได้ของฉัน", roles: STAFF },
];

const ROLE_TH = {
  super_admin: "เจ้าของระบบ", admin: "แอดมิน (จอง/รับ/OPD)",
  sale: "ฝ่ายขาย", doctor: "แพทย์", BT: "ผู้ช่วยหัตถการ",
};

export default function AdminShell({ children }) {
  const auth = useSelector((s) => s.auth);
  const lang = useSelector((s) => s.ui.lang);
  const dispatch = useDispatch();
  const pathname = usePathname();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const { data: setupState } = useGetSetupStateQuery();
  const [logoutUser] = useLogoutUserMutation();
  useRealtime(); // socket → invalidate RTK tags + toast

  useEffect(() => {
    setHydrated(true);
    api("/auth/me").then((d) => dispatch(login(d))).catch(() => dispatch(setReady()));
    // dark mode (ข้อ 22): จำค่าไว้ + ตั้ง data-bs-theme ที่ <html> (Bootstrap/AdminLTE รองรับ)
    const savedDark = localStorage.getItem("osoth_dark") === "1";
    setDark(savedDark);
    document.documentElement.setAttribute("data-bs-theme", savedDark ? "dark" : "light");
  }, [dispatch]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("osoth_dark", next ? "1" : "0");
    document.documentElement.setAttribute("data-bs-theme", next ? "dark" : "light");
  };

  useEffect(() => {
    if (hydrated && auth.ready && !auth.user) router.replace("/login");
  }, [hydrated, auth.ready, auth.user, router]);

  // role อื่นเปิด /app (Dashboard เจ้าของ) → พาไป "หน้างานแรกของ role ตัวเอง"
  // (sale ไม่มีสิทธิ์ OPD — เคยถูกส่งไป /app/opd แล้วเจอหน้าไม่มีสิทธิ์)
  useEffect(() => {
    if (auth.user && pathname === "/app" && auth.user.role !== "super_admin")
      router.replace(auth.user.role === "sale" ? "/app/booking" : "/app/opd");
  }, [auth.user, pathname, router]);

  if (!hydrated || !auth.ready || !auth.user) return <FullLoader />;
  if (auth.must_change_password) return <ForceChangePassword />;

  const role = auth.user.role;
  const visible = (m) => !m.roles || m.roles.includes(role);
  const company = setupState?.company;
  const brand = company?.brand || { display_name: "Osoth", logo: "/brand/logo.jpg" };
  const current = MENU.find((m) => m.href === pathname);
  const denied = current && !visible(current); // route guard — เข้าหน้าที่ role ไม่มีสิทธิ์

  // เมนูตาม role: header โชว์เมื่อกลุ่มมีลูกอย่างน้อย 1
  const items = [];
  for (let i = 0; i < MENU.length; i++) {
    const m = MENU[i];
    if (m.header) {
      let any = false;
      for (let j = i + 1; j < MENU.length && !MENU[j].header; j++) if (visible(MENU[j])) any = true;
      if (any) items.push(m);
    } else if (visible(m)) items.push(m);
  }

  async function doLogout() {
    try { await logoutUser().unwrap(); } catch {}
    dispatch(logout());
    router.replace("/login");
  }

  return (
    <div className={`app-wrapper ${collapsed ? "sidebar-collapse" : ""}`}>
      <BsToaster />
      {/* Navbar */}
      <nav className="app-header navbar navbar-expand osoth-topbar border-bottom">
        <div className="container-fluid">
          <ul className="navbar-nav">
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => setCollapsed((c) => !c)} aria-label="เมนู">
                <i className="bi bi-list fs-5" />
              </button>
            </li>
          </ul>
          <span className="navbar-text fw-semibold text-truncate d-none d-md-inline">{current?.label || company?.name || brand.display_name}</span>
          <CustomerSearch role={role} />
          <ul className="navbar-nav ms-auto align-items-center">
            <NotifyBell />
            <li className="nav-item">
              <button className="btn btn-link nav-link" title="สลับโหมดมืด/สว่าง" onClick={toggleDark}>
                <i className={`bi ${dark ? "bi-sun" : "bi-moon-stars"}`} />
              </button>
            </li>
            <li className="nav-item d-none d-lg-block">
              <button className="btn btn-link nav-link small" onClick={() => dispatch(setLang(lang === "th" ? "en" : "th"))}>
                {lang === "th" ? "EN" : "ไทย"}
              </button>
            </li>
            <li className="nav-item d-none d-sm-flex align-items-center me-2 gap-2">
              {auth.user.profile_picture
                ? <img src={auth.user.profile_picture} alt="" width={30} height={30} className="rounded-circle object-fit-cover" />
                : <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold" style={{ width: 30, height: 30, fontSize: 12 }}>{(auth.user.nick_name || auth.user.full_name).slice(0, 2)}</span>}
              <span className="text-end lh-1">
                <div className="fw-semibold small">{auth.user.nick_name || auth.user.full_name}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{ROLE_TH[role] || role}</div>
              </span>
            </li>
            <li className="nav-item">
              <button className="btn btn-outline-secondary btn-sm" onClick={doLogout}>
                <i className="bi bi-box-arrow-right me-1" /> ออก
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className="app-sidebar shadow" data-bs-theme="dark"
             style={{ background: "linear-gradient(180deg, #1a2035 0%, #212631 60%, #1e232e 100%)" }}>
        <div className="sidebar-brand">
          <Link href={role === "super_admin" ? "/app" : role === "sale" ? "/app/booking" : "/app/opd"} className="brand-link d-flex align-items-center gap-2">
            <img src={`${bp}${brand.logo}`} alt="logo" width={32} height={32} className="brand-image" />
            <span className="brand-text fw-bold text-white lh-1" style={{ fontSize: 14 }}>
              Healthcare Operator<br /><small className="fw-normal opacity-75">System · {brand.display_name}</small>
            </span>
          </Link>
        </div>
        <div className="sidebar-wrapper">
          <nav className="mt-2">
            <ul className="nav sidebar-menu flex-column" role="menu">
              {items.map((m, i) =>
                m.header ? (
                  <li className="nav-header text-uppercase" key={`h${i}`}>{m.header}</li>
                ) : (
                  <li className="nav-item" key={m.href}>
                    <Link href={m.href} className={`nav-link ${pathname === m.href ? "active" : ""}`}>
                      <i className={`nav-icon bi ${m.ico}`} />
                      <p>{m.label}</p>
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="app-main">
        {denied ? <NoAccess /> : children}
      </main>

      <footer className="app-footer">
        <div className="float-end d-none d-sm-inline">OSOTH ERP v2</div>
        <strong>© {new Date().getFullYear()} {company?.name || brand.display_name}</strong>
      </footer>

      {/* จัดช่องไฟ/active state ของ sidebar (เฉพาะเปลือก — ไม่แตะ css กลาง) */}
      <style jsx global>{`
        .app-sidebar .nav-header {
          font-size: 11px;
          letter-spacing: 0.09em;
          color: rgba(255, 255, 255, 0.42);
          padding: 0.95rem 1rem 0.3rem;
        }
        .app-sidebar .sidebar-menu > .nav-item > .nav-link {
          margin: 1px 8px;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.78);
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease,
            transform 0.18s ease;
        }
        .app-sidebar .sidebar-menu > .nav-item > .nav-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          transform: translateX(2px);
        }
        .app-sidebar .sidebar-menu > .nav-item > .nav-link:focus-visible {
          outline: none;
          box-shadow: 0 0 0 0.18rem rgba(72, 148, 212, 0.45);
          color: #fff;
        }
        .app-sidebar .sidebar-menu > .nav-item > .nav-link.active {
          background: linear-gradient(135deg, #1560a3 0%, #2a7bc4 100%);
          color: #fff;
          font-weight: 600;
          box-shadow: 0 3px 10px rgba(21, 96, 163, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: none;
        }
        .app-sidebar .sidebar-brand {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .app-sidebar .sidebar-wrapper {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
        }
      `}</style>
    </div>
  );
}

// ค้นหาลูกค้า (HN/ชื่อ/เบอร์) บน navbar — เฉพาะ role ที่เข้าหน้าลูกค้าได้
function CustomerSearch({ role }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  if (!["super_admin", "admin", "acception", "sale"].includes(role)) return null;

  const run = async (v) => {
    if (!v || v.length < 2) return setRes([]);
    try {
      const r = await api(`/customers?q=${encodeURIComponent(v)}`);
      setRes(r.slice(0, 8));
      setOpen(true);
    } catch { setRes([]); }
  };
  const goto = (hn) => { setOpen(false); setQ(""); router.push(`/app/customers?hn=${hn}`); };

  return (
    <div className="position-relative d-none d-md-block ms-3" style={{ width: 260 }}
         onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <i className="bi bi-search position-absolute top-50 translate-middle-y text-muted"
         style={{ left: 10, fontSize: 13, pointerEvents: "none" }} />
      <input className="form-control form-control-sm ps-4" value={q}
             placeholder="ค้นหาลูกค้า (HN / ชื่อ / เบอร์)"
             onChange={(e) => { setQ(e.target.value); run(e.target.value); }}
             onKeyDown={(e) => { if (e.key === "Enter" && res[0]) goto(res[0].HN_number); }}
             onFocus={() => res.length && setOpen(true)} />
      {open && res.length > 0 && (
        <div className="dropdown-menu show shadow w-100" style={{ top: "100%" }}>
          {res.map((c) => (
            <button key={c.HN_number} className="dropdown-item small" onMouseDown={() => goto(c.HN_number)}>
              <b>{c.HN_number}</b> · {c.full_name} <span className="text-muted">({c.nick_name} · {c.phone})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NoAccess() {
  return (
    <div className="app-content">
      <div className="container-fluid pt-4">
        <div className="card shadow-sm text-center" style={{ maxWidth: 480, margin: "40px auto" }}>
          <div className="card-body py-5">
            <i className="bi bi-shield-lock text-danger" style={{ fontSize: 48 }} />
            <h4 className="fw-bold mt-3">ไม่มีสิทธิ์เข้าถึง</h4>
            <p className="text-muted">บัญชีของคุณไม่มีสิทธิ์เปิดหน้านี้ — กรุณาติดต่อผู้ดูแลระบบ</p>
            <Link href={role === "sale" ? "/app/booking" : "/app/opd"} className="btn btn-primary">กลับหน้างาน</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FullLoader() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="spinner-border text-primary" role="status" />
    </div>
  );
}

// พนักงานใหม่ (owner ตั้งรหัสให้) — บังคับเปลี่ยนรหัสผ่านครั้งแรกก่อนใช้งาน
function ForceChangePassword() {
  const dispatch = useDispatch();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    if (pw.length < 4) return setError("รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร");
    if (pw !== pw2) return setError("รหัสผ่านยืนยันไม่ตรงกัน");
    try {
      await changePassword({ new_password: pw }).unwrap();
      dispatch(clearMustChange());
    } catch (err) {
      setError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }

  return (
    <div className="osoth-auth-bg">
      <form className="card shadow-lg border-0" style={{ width: 400, maxWidth: "100%" }} onSubmit={submit}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <i className="bi bi-shield-lock text-primary" style={{ fontSize: 48 }} />
            <h5 className="fw-bold mt-2 mb-0">ตั้งรหัสผ่านใหม่</h5>
            <small className="text-muted">เข้าใช้งานครั้งแรก — กรุณาตั้งรหัสผ่านของคุณเอง</small>
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <div className="mb-3">
            <label className="form-label">รหัสผ่านใหม่</label>
            <input type="password" className="form-control" value={pw} autoFocus autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">ยืนยันรหัสผ่าน</label>
            <input type="password" className="form-control" value={pw2} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary d-block ms-auto px-4" disabled={isLoading || !pw || !pw2}>
            {isLoading ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}
          </button>
        </div>
      </form>
    </div>
  );
}
