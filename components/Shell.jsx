"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { login, logout, setBranch } from "@/store/authSlice";
import { setLang } from "@/store/uiSlice";
import { useT } from "@/i18n/messages";
import { ROLE_LABEL } from "@/components/ui";
import Toaster from "@/components/Toaster";
import { api } from "@/lib/client";

const ROLE_COLORS = {
  super_admin: "#8f2b25",
  admin: "#b23a33",
  acception: "#a5842f",
  sale: "#34618f",
  doctor: "#2f7d5b",
  BT: "#7a4f96",
};

// เมนู + icon + role ที่เห็นได้ (ใช้เป็น route guard ด้วย)
const NAV = [
  { group: "หน้าร้าน" },
  { href: "/", key: "nav_calendar_customer", ico: "📅", roles: "*" },
  { href: "/calendar", key: "nav_calendar_sale", ico: "🗓️", roles: ["super_admin", "admin", "acception", "sale"] },
  { href: "/reception", key: "nav_calendar_reception", ico: "🛎️", roles: ["super_admin", "admin", "acception"] },
  { href: "/opd", key: "nav_opd", ico: "🩺", roles: ["super_admin", "admin", "acception", "doctor", "BT"] },
  { href: "/customers", key: "nav_customers", ico: "👤", roles: ["super_admin", "admin", "acception", "sale"] },
  { group: "บุคคล" },
  { href: "/attendance", key: "nav_attendance", ico: "⏰", roles: "*" },
  { href: "/leaves", key: "nav_leaves", ico: "📝", roles: "*" },
  { group: "จัดการ" },
  { href: "/stock", key: "nav_stock", ico: "📦", roles: ["super_admin", "admin"] },
  { href: "/purchasing", key: "nav_purchasing", ico: "🧾", roles: ["super_admin", "admin"] },
  { href: "/courses", key: "nav_courses", ico: "🎴", roles: ["super_admin", "admin"] },
  { href: "/promotions", key: "nav_promotions", ico: "🧧", roles: ["super_admin", "admin"] },
  { href: "/procedures", key: "nav_procedures", ico: "💉", roles: ["super_admin", "admin"] },
  { href: "/products", key: "nav_products", ico: "🧴", roles: ["super_admin", "admin"] },
  { href: "/hr", key: "nav_hr", ico: "👥", roles: ["super_admin", "admin"] },
  { group: "การเงิน" },
  { href: "/finance", key: "nav_finance", ico: "💰", roles: ["super_admin", "admin"] },
  { href: "/my-earnings", key: "nav_my_earnings", ico: "📈", roles: ["doctor", "BT", "sale"] },
  { group: "ระบบ / ตั้งค่า" },
  { href: "/commission", key: "nav_commission", ico: "📈", roles: ["super_admin", "admin"] },
  { href: "/settings", key: "nav_settings", ico: "⚙️", roles: ["super_admin"] },
];

export default function Shell({ children }) {
  const auth = useSelector((s) => s.auth);
  const lang = useSelector((s) => s.ui.lang);
  const dispatch = useDispatch();
  const pathname = usePathname();
  const t = useT();
  const [hydrated, setHydrated] = useState(false);
  const [branches, setBranches] = useState([]);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const saved = JSON.parse(localStorage.getItem("osoth_auth") || "null");
    if (saved?.user) dispatch(login(saved));
    const savedLang = localStorage.getItem("osoth_lang");
    if (savedLang) dispatch(setLang(savedLang));
  }, [dispatch]);

  useEffect(() => {
    if (auth.user) api("/branches").then(setBranches).catch(() => {});
  }, [auth.user]);

  useEffect(() => { setDrawer(false); }, [pathname]);

  if (!hydrated) return null;
  if (!auth.user) return (<><Toaster /><LoginScreen /></>);

  const visible = (item) =>
    item.roles === "*" || item.roles.includes(auth.user.role);
  const current = NAV.find((n) => n.href === pathname);
  // route guard (F-19): หน้าที่อยู่ใน NAV แต่ role ไม่มีสิทธิ์ → หน้า "ไม่มีสิทธิ์"
  const denied = current && !visible(current);

  return (
    <div className="shell">
      <Toaster />
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-name">
            <span className="brand-mark">☯</span> {t("app_name")}
          </div>
          <div className="brand-sub">龍 · {t("app_sub")}</div>
        </div>
        <div className="fret-band" />
        <nav className="nav">
          {NAV.map((item, i) =>
            item.group ? (
              <div key={i} className="group">{item.group}</div>
            ) : visible(item) ? (
              <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                <span className="nav-ico">{item.ico}</span>
                {t(item.key)}
              </Link>
            ) : null
          )}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setDrawer((d) => !d)} aria-label="เมนู">☰</button>
          <span className="page-title">{current ? t(current.key) : t("app_name")}</span>
          <GlobalSearch />
          <div className="spacer" />
          {auth.user.role === "super_admin" ? (
            <select
              value={auth.branch_ID || ""}
              style={{ width: "auto", minWidth: 150 }}
              onChange={(e) => dispatch(setBranch(e.target.value))}
            >
              <option value="">🏢 ทุกสาขา</option>
              {branches.map((b) => (<option key={b.branch_ID} value={b.branch_ID}>{b.name}</option>))}
            </select>
          ) : (
            <span className="badge gold nodot">
              🏢 {branches.find((b) => b.branch_ID === auth.branch_ID)?.name || auth.branch_ID}
            </span>
          )}
          <button className="btn small ghost" onClick={() => dispatch(setLang(lang === "th" ? "en" : "th"))}>
            {lang === "th" ? "EN" : "ไทย"}
          </button>
          <div className="user-chip">
            <span className="avatar" style={{ background: ROLE_COLORS[auth.user.role] || "#64615a" }}>
              {(auth.user.nick_name || auth.user.full_name).slice(0, 2)}
            </span>
            <span>
              <div className="u-name">{auth.user.nick_name || auth.user.full_name}</div>
              <div className="u-role">{ROLE_LABEL[auth.user.role] || auth.user.role}</div>
            </span>
          </div>
          <button className="btn small ghost" onClick={() => dispatch(logout())}>
            {t("logout")}
          </button>
        </header>
        <main className="content">{denied ? <NoAccess /> : children}</main>
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="no-access">
      <div className="na-ico">🔒</div>
      <h2>ไม่มีสิทธิ์เข้าถึง</h2>
      <div className="muted">บัญชีของคุณไม่มีสิทธิ์เปิดหน้านี้ — กรุณาติดต่อผู้ดูแลระบบ</div>
      <Link href="/" className="btn primary" style={{ marginTop: 16 }}>กลับหน้าหลัก</Link>
    </div>
  );
}

// ค้นหาลูกค้าแบบ global (F-16a) — พิมพ์แล้วเห็นผล คลิกไปหน้าโปรไฟล์
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const run = async (v) => {
    if (!v || v.length < 2) { setRes([]); return; }
    try {
      const r = await api(`/customers?q=${encodeURIComponent(v)}`);
      setRes(r.slice(0, 8));
      setOpen(true);
    } catch { setRes([]); }
  };
  const goto = (hn) => {
    setOpen(false); setQ("");
    router.push(`/customers?hn=${hn}`);
  };

  return (
    <div className="gsearch" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <input
        value={q}
        placeholder="🔎 ค้นหาลูกค้า (HN/ชื่อ/เบอร์)"
        onChange={(e) => { setQ(e.target.value); run(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter" && res[0]) goto(res[0].HN_number); }}
        onFocus={() => res.length && setOpen(true)}
      />
      {open && res.length > 0 && (
        <div className="gsearch-results">
          {res.map((c) => (
            <a key={c.HN_number} onMouseDown={() => goto(c.HN_number)}>
              <b>{c.HN_number}</b> · {c.full_name} <span className="muted">({c.nick_name} · {c.phone})</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginScreen() {
  const dispatch = useDispatch();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.ok ? j.data : []))
      .catch(() => setError("เชื่อมต่อ server ไม่ได้ — ตรวจสอบ MongoDB"));
  }, []);

  return (
    <div className="login-bg">
      <div className="login-card corner-cn">
        <div className="login-brand">
          <div className="login-mark">☯</div>
          <div className="login-title">โอสถ</div>
          <div className="login-sub">เลือกผู้ใช้งานเพื่อเข้าระบบ</div>
        </div>
        {error && <div className="err">{error}</div>}
        {users === null && <div className="muted" style={{ textAlign: "center" }}>กำลังโหลด...</div>}
        {users?.length === 0 && (
          <div className="hint-box">ยังไม่มีผู้ใช้ — รัน <code>npm run seed</code> ก่อน</div>
        )}
        {users?.map((u) => (
          <button key={u.user_ID} className="user-pick" onClick={() => dispatch(login({ user: u }))}>
            <span className="avatar" style={{ background: ROLE_COLORS[u.role] || "#64615a" }}>
              {(u.nick_name || u.full_name).slice(0, 2)}
            </span>
            <span>
              <b>{u.full_name}</b>
              <div className="muted">{ROLE_LABEL[u.role] || u.role} · {u.branch_ID}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
