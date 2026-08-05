"use client";
// หน้าแรกสาธารณะ (/about_me) — แนะนำคลินิก + โปรโมชั่น/คอร์ส + ติดต่อเรา + ปุ่ม login มุมขวาบน
// data ผ่าน RTK Query ทั้งหมด (cache แชร์กับหน้า login/register — setup/state ยิงครั้งเดียว)
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useGetSetupStateQuery, useGetPublicStorefrontQuery, useGetPublicCalendarQuery,
} from "@/store/apiSlice";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// แสดงวันที่แบบไทยย่อ เช่น 2026-10-03 → 3 ต.ค. 2569
const M_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return Number.isFinite(y) ? `${d} ${M_ABBR[m - 1]} ${y + 543}` : s;
};

export default function AboutMePage() {
  const router = useRouter();
  const { data: setup } = useGetSetupStateQuery();
  const { data: branches } = useGetPublicStorefrontQuery();
  const mainBranch = branches?.[0];
  // โปร/คอร์สจาก public calendar ของสาขาหลัก (ยิงเมื่อรู้สาขาแล้ว)
  const { data: storeData } = useGetPublicCalendarQuery(
    { branch_ID: mainBranch?.branch_ID, date: today() },
    { skip: !mainBranch }
  );
  // มีรูป hero จริงไหม (public/brand/hero.jpg) — ไม่มีก็ใช้พื้นหลัง CSS ล้วนที่สวยยืนเดี่ยวได้
  const [heroImg, setHeroImg] = useState(false);

  // first-run: ยังไม่มี owner → ไปหน้าสมัครตั้งค่าระบบ
  useEffect(() => {
    if (setup?.needs_owner) router.replace("/register");
  }, [setup, router]);

  const company = setup?.company;
  const brand = company?.brand || { display_name: "Osoth", logo: "/brand/logo.jpg", tagline: "คลินิกความงาม", about: "" };
  const promos = storeData?.promos || [];
  const courses = storeData?.courses || [];
  const lineHref = mainBranch?.line_id
    ? `https://line.me/R/ti/p/~${encodeURIComponent(mainBranch.line_id.replace(/^@?/, "@"))}`
    : null;

  return (
    <div className="d-flex flex-column bg-body-tertiary" style={{ minHeight: "100vh" }}>
      {/* probe: เช็คว่ามีรูป hero จริง (โหลดสำเร็จค่อยเปิดเลเยอร์รูป) */}
      <img src={`${bp}/brand/hero.jpg`} alt="" aria-hidden className="d-none"
           onLoad={() => setHeroImg(true)} onError={() => setHeroImg(false)} />

      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark lux-nav sticky-top">
        <div className="container">
          <span className="navbar-brand d-flex align-items-center gap-2 fw-bold">
            <img src={`${bp}${brand.logo}`} alt="logo" width={34} height={34} style={{ borderRadius: 8 }} />
            {brand.display_name}
            <span className="fw-normal small opacity-75 d-none d-sm-inline">· {brand.tagline}</span>
          </span>
          <div className="ms-auto d-flex gap-2">
            <Link href="/calendar" className="btn btn-outline-light btn-sm lux-btn">
              <i className="bi bi-calendar-check me-1" /> ดูคิว / จอง
            </Link>
            <Link href="/login" className="btn btn-light btn-sm fw-semibold lux-btn">
              <i className="bi bi-box-arrow-in-right me-1" /> เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — แลนดิ้งหรู: gradient หลายชั้น + วงกลม blur ลอย + ลายเส้นบาง (มีรูปจริงค่อยซ้อนจางๆ) */}
      <header className="lux-hero text-center position-relative overflow-hidden">
        {heroImg && (
          <div aria-hidden className="position-absolute top-0 start-0 w-100 h-100 lux-hero-photo"
               style={{ backgroundImage: `url(${bp}/brand/hero.jpg)` }} />
        )}
        <div aria-hidden className="lux-grid position-absolute top-0 start-0 w-100 h-100" />
        <div aria-hidden className="lux-orb lux-orb-1" />
        <div aria-hidden className="lux-orb lux-orb-2" />
        <div aria-hidden className="lux-orb lux-orb-3" />
        <div aria-hidden className="lux-ring lux-ring-1" />
        <div aria-hidden className="lux-ring lux-ring-2" />

        <div className="container position-relative lux-hero-inner">
          <img src={`${bp}${brand.logo}`} alt="logo" width={96} height={96} className="mb-4 lux-logo" />
          <div className="mb-3">
            <span className="badge rounded-pill px-3 py-2 fw-semibold lux-eyebrow">
              <i className="bi bi-flower1 me-1" />{brand.tagline}
            </span>
          </div>
          <h1 className="display-4 fw-bold mb-3 text-white lux-title">{company?.name || brand.display_name}</h1>
          {brand.about && <p className="lead mx-auto mb-0 lux-lead" style={{ maxWidth: 640 }}>{brand.about}</p>}
          <div className="d-flex gap-3 justify-content-center mt-4 pt-2 flex-wrap">
            <Link href="/calendar" className="btn btn-light btn-lg fw-semibold px-4 lux-cta">
              <i className="bi bi-calendar-heart me-2" />ดูคิวว่าง & จอง
            </Link>
            <Link href="/login" className="btn btn-lg px-4 lux-cta-ghost">เข้าสู่ระบบพนักงาน</Link>
          </div>
          {/* ช่องทางติดต่อด่วน */}
          {(mainBranch?.phone || mainBranch?.line_id) && (
            <div className="d-flex gap-2 justify-content-center mt-4 flex-wrap small fw-semibold">
              {mainBranch?.phone && (
                <a href={`tel:${mainBranch.phone}`} className="lux-chip text-decoration-none">
                  <i className="bi bi-telephone-fill me-1" />{mainBranch.phone}
                </a>
              )}
              {lineHref && (
                <a href={lineHref} target="_blank" rel="noreferrer" className="lux-chip text-decoration-none">
                  <i className="bi bi-chat-dots-fill me-1" />LINE {mainBranch.line_id}
                </a>
              )}
            </div>
          )}
        </div>
        <div aria-hidden className="lux-hero-fade position-absolute bottom-0 start-0 w-100" />
      </header>

      <main className="container py-5 flex-grow-1">
        {/* จุดเด่นบริการ */}
        <div className="row g-4 mb-5 pb-3 lux-features">
          {[
            { ico: "bi-gem", t: "บริการครบวงจร", d: "ดูแลความงามโดยแพทย์และผู้เชี่ยวชาญ" },
            { ico: "bi-shield-check", t: "ปลอดภัย มาตรฐาน", d: "เวชภัณฑ์คุณภาพ ตรวจสอบย้อนกลับได้" },
            { ico: "bi-stars", t: "คอร์ส & โปรโมชั่น", d: "แพ็กเกจคุ้มค่า ปรับตามความต้องการ" },
          ].map((f) => (
            <div className="col-md-4" key={f.t}>
              <div className="card h-100 border-0 text-center p-4 lux-card lift">
                <div className="mx-auto mb-3 d-flex align-items-center justify-content-center lux-icon-tile">
                  <i className={`bi ${f.ico}`} />
                </div>
                <h5 className="fw-bold">{f.t}</h5>
                <p className="text-body-secondary mb-0">{f.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* โปรโมชั่น */}
        {promos.length > 0 && (
          <section className="mb-5 pb-3">
            <div className="lux-sec-eyebrow">Special Offers</div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <h3 className="fw-bold mb-0"><i className="bi bi-tag-fill text-primary me-2" />โปรโมชั่น</h3>
            </div>
            <p className="text-body-secondary mb-4">ข้อเสนอพิเศษช่วงนี้ — จองก่อนหมดเขต</p>
            <div className="row g-4">
              {promos.map((p, i) => (
                <div className="col-md-4" key={i}>
                  <div className="card h-100 border-0 overflow-hidden lux-card lift lux-media-card">
                    {p.banner_image && (
                      <div className="overflow-hidden">
                        <img src={p.banner_image} className="card-img-top lux-media" alt={p.name} style={{ height: 170, objectFit: "cover" }} />
                      </div>
                    )}
                    <div className="card-body">
                      <h6 className="fw-bold mb-2">{p.name}</h6>
                      <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">
                        <i className="bi bi-clock-history me-1" />ถึง {thDate(p.date_end)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* คอร์ส */}
        {courses.length > 0 && (
          <section className="mb-5 pb-3">
            <div className="lux-sec-eyebrow">Signature Courses</div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <h3 className="fw-bold mb-0"><i className="bi bi-grid-3x3-gap-fill text-primary me-2" />คอร์สแนะนำ</h3>
            </div>
            <p className="text-body-secondary mb-4">แพ็กเกจดูแลผิวยอดนิยม สอบถามรายละเอียดได้ที่คลินิก</p>
            <div className="row g-4">
              {courses.map((c, i) => (
                <div className="col-md-3 col-6" key={i}>
                  <div className="card h-100 border-0 overflow-hidden lux-card lift lux-media-card">
                    {c.image && (
                      <div className="overflow-hidden">
                        <img src={c.image} className="card-img-top lux-media" alt={c.name} style={{ height: 135, objectFit: "cover" }} />
                      </div>
                    )}
                    <div className="card-body d-flex flex-column">
                      <h6 className="fw-bold mb-1">{c.name}</h6>
                      <div className="mt-auto d-flex align-items-center justify-content-between pt-2">
                        <span className="text-primary fw-bold lux-price">{Number(c.price).toLocaleString()} ฿</span>
                        <span className="badge bg-body-secondary text-body-secondary fw-normal">{c.quantity_used} ครั้ง</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ยังไม่มีโปร/คอร์สช่วงนี้ */}
        {storeData && promos.length === 0 && courses.length === 0 && (
          <section className="mb-5 pb-3 text-center">
            <div className="card border-0 py-5 lux-card">
              <div className="card-body">
                <i className="bi bi-stars text-primary opacity-50" style={{ fontSize: 48 }} />
                <h5 className="fw-bold mt-3 mb-1">โปรโมชั่นใหม่กำลังจะมา</h5>
                <p className="text-body-secondary mb-0">สอบถามคอร์สและสิทธิพิเศษล่าสุดได้ที่เคาน์เตอร์ หรือช่องทางติดต่อด้านล่าง</p>
              </div>
            </div>
          </section>
        )}

        {/* ติดต่อเรา */}
        <section id="contact">
          <div className="lux-sec-eyebrow">Contact</div>
          <div className="d-flex align-items-baseline gap-2 mb-1">
            <h3 className="fw-bold mb-0"><i className="bi bi-geo-alt-fill text-primary me-2" />ติดต่อ & จองคิว</h3>
          </div>
          <p className="text-body-secondary mb-4">ทีมงานพร้อมให้คำปรึกษาและจองคิวให้คุณทุกวัน</p>
          <div className="card border-0 lux-card lux-contact overflow-hidden">
            <div className="card-body p-4 p-lg-5 position-relative">
              <div aria-hidden className="lux-contact-glow" />
              <div className="row g-4 align-items-center position-relative">
                <div className="col-lg-7">
                  <div className="d-flex flex-column gap-3">
                    {mainBranch?.address && (
                      <div className="d-flex align-items-center gap-3">
                        <span className="lux-mini-tile"><i className="bi bi-geo-alt" /></span>
                        <span>{mainBranch.address}</span>
                      </div>
                    )}
                    {mainBranch?.phone && (
                      <div className="d-flex align-items-center gap-3">
                        <span className="lux-mini-tile"><i className="bi bi-telephone" /></span>
                        <span>{mainBranch.phone}</span>
                      </div>
                    )}
                    {mainBranch?.line_id && (
                      <div className="d-flex align-items-center gap-3">
                        <span className="lux-mini-tile"><i className="bi bi-chat-dots" /></span>
                        <span>LINE {mainBranch.line_id}</span>
                      </div>
                    )}
                    {!mainBranch && <span className="text-body-secondary">— กำลังโหลดข้อมูลสาขา —</span>}
                  </div>
                </div>
                <div className="col-lg-5">
                  <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                    {mainBranch?.phone && (
                      <a className="btn btn-primary px-4 lux-btn" href={`tel:${mainBranch.phone}`}>
                        <i className="bi bi-telephone-fill me-1" /> โทรจองคิว
                      </a>
                    )}
                    {lineHref && (
                      <a className="btn btn-success px-4 lux-btn" target="_blank" rel="noreferrer" href={lineHref}>
                        <i className="bi bi-chat-dots-fill me-1" /> LINE
                      </a>
                    )}
                    <Link href="/calendar" className="btn btn-outline-primary px-4 lux-btn">
                      <i className="bi bi-calendar-check me-1" /> ดูคิวว่าง
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center py-4 border-top bg-body">
        <small className="text-body-secondary">
          © {new Date().getFullYear()} {company?.name || brand.display_name}
          {company?.address ? ` · ${company.address}` : ""}
          {mainBranch?.phone ? ` · โทร ${mainBranch.phone}` : ""}
        </small>
      </footer>

      <style jsx>{`
        /* ── navbar: gradient แบรนด์ + เงานุ่ม ── */
        .lux-nav {
          background: linear-gradient(135deg, #0f4a7d 0%, #1560a3 55%, #2a7bc4 100%);
          box-shadow: 0 2px 14px rgba(11, 51, 88, 0.28);
        }
        /* :global — ปุ่มที่เป็น <Link> component ไม่ได้รับ jsx hash class (สโคปด้วยชื่อคลาสเฉพาะหน้านี้แทน) */
        :global(.lux-btn) { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        :global(.lux-btn:hover) { transform: translateY(-1px); }
        :global(.lux-btn:active) { transform: scale(0.97); }

        /* ── hero: gradient หลายชั้น (ยืนเดี่ยวได้โดยไม่มีรูป) ── */
        .lux-hero {
          background:
            radial-gradient(1100px 460px at 85% -10%, rgba(96, 176, 244, 0.4), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(10, 38, 66, 0.55), transparent 62%),
            linear-gradient(135deg, #0b3358 0%, #1560a3 58%, #2a7bc4 100%);
          padding: 5.5rem 0 6.5rem;
        }
        @media (max-width: 767.98px) { .lux-hero { padding: 3.5rem 0 4.5rem; } }
        .lux-hero-photo {
          background-size: cover; background-position: center 30%;
          opacity: 0.26; filter: blur(2px) saturate(1.05); transform: scale(1.04);
        }
        /* ลายเส้นบางๆ โปร่งจาง */
        .lux-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(70% 90% at 50% 40%, #000 30%, transparent 100%);
          -webkit-mask-image: radial-gradient(70% 90% at 50% 40%, #000 30%, transparent 100%);
        }
        /* วงกลมเบลอลอยช้าๆ */
        .lux-orb { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; }
        .lux-orb-1 {
          width: 420px; height: 420px; top: -140px; right: -80px;
          background: radial-gradient(circle, rgba(120, 194, 255, 0.5), transparent 70%);
          animation: luxFloat 13s ease-in-out infinite;
        }
        .lux-orb-2 {
          width: 360px; height: 360px; bottom: -160px; left: -100px;
          background: radial-gradient(circle, rgba(9, 36, 62, 0.75), transparent 70%);
          animation: luxFloat 17s ease-in-out infinite reverse;
        }
        .lux-orb-3 {
          width: 220px; height: 220px; top: 30%; left: 12%;
          background: radial-gradient(circle, rgba(180, 220, 255, 0.28), transparent 70%);
          animation: luxFloat 15s ease-in-out 2s infinite;
        }
        @keyframes luxFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(14px, -18px); }
        }
        /* วงแหวนเส้นบาง */
        .lux-ring {
          position: absolute; border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 50%; pointer-events: none;
        }
        .lux-ring-1 { width: 560px; height: 560px; top: -230px; right: 6%; }
        .lux-ring-2 { width: 340px; height: 340px; bottom: -150px; left: 4%; border-color: rgba(255, 255, 255, 0.1); }
        .lux-hero-fade {
          height: 90px;
          background: linear-gradient(to bottom, transparent, var(--bs-tertiary-bg));
        }
        .lux-hero-inner { z-index: 1; }

        .lux-logo {
          border-radius: 22px;
          box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.18), 0 18px 44px rgba(4, 22, 40, 0.45);
        }
        .lux-eyebrow {
          background: rgba(255, 255, 255, 0.14); color: #eaf4ff;
          letter-spacing: 0.08em; border: 1px solid rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(4px);
        }
        .lux-title { text-shadow: 0 3px 22px rgba(5, 26, 47, 0.45); letter-spacing: -0.01em; }
        .lux-lead { color: rgba(235, 245, 255, 0.88); }
        :global(.lux-cta) {
          color: #0f4a7d; border-radius: 0.9rem;
          box-shadow: 0 10px 26px rgba(4, 22, 40, 0.35);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        :global(.lux-cta:hover) { color: #0f4a7d; transform: translateY(-2px); box-shadow: 0 14px 32px rgba(4, 22, 40, 0.42); }
        :global(.lux-cta:active) { transform: scale(0.97); }
        :global(.lux-cta-ghost) {
          color: #fff; border: 1px solid rgba(255, 255, 255, 0.55); border-radius: 0.9rem;
          background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px);
          transition: transform 0.18s ease, background 0.18s ease;
        }
        :global(.lux-cta-ghost:hover) { background: rgba(255, 255, 255, 0.18); color: #fff; transform: translateY(-2px); }
        :global(.lux-cta-ghost:active) { transform: scale(0.97); }
        .lux-chip {
          color: #eaf4ff; background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 999px;
          padding: 0.4rem 1rem; backdrop-filter: blur(4px);
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .lux-chip:hover { background: rgba(255, 255, 255, 0.22); color: #fff; transform: translateY(-1px); }

        /* ── การ์ดหรู + hover ยก ── */
        .lux-features { margin-top: -2.25rem; position: relative; z-index: 2; }
        .lux-card {
          border-radius: 1.1rem;
          box-shadow: 0 1px 3px rgba(15, 60, 102, 0.07), 0 6px 18px rgba(15, 60, 102, 0.07);
        }
        .lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 10px rgba(15, 60, 102, 0.09), 0 18px 38px rgba(15, 60, 102, 0.16);
        }
        .lux-icon-tile {
          width: 68px; height: 68px; border-radius: 1.1rem;
          background: linear-gradient(135deg, #1560a3, #2a7bc4);
          box-shadow: 0 8px 20px rgba(21, 96, 163, 0.35);
          color: #fff; font-size: 30px;
        }
        .lux-media { transition: transform 0.35s ease; }
        .lux-media-card:hover .lux-media { transform: scale(1.05); }
        .lux-price { font-size: 1.05rem; font-variant-numeric: tabular-nums; }

        .lux-sec-eyebrow {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.22em;
          text-transform: uppercase; color: var(--bs-primary); opacity: 0.75; margin-bottom: 0.35rem;
        }
        .lux-contact { border-top: 3px solid transparent; }
        .lux-contact-glow {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(420px 200px at 100% 0%, rgba(21, 96, 163, 0.08), transparent 70%),
            linear-gradient(135deg, rgba(21, 96, 163, 0.05), transparent 45%);
        }
        .lux-mini-tile {
          width: 42px; height: 42px; border-radius: 0.8rem; flex: 0 0 auto;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(21, 96, 163, 0.1); color: #1560a3; font-size: 18px;
        }
        :global([data-bs-theme="dark"]) .lux-mini-tile { background: rgba(96, 176, 244, 0.14); color: #7cb8e8; }
        :global([data-bs-theme="dark"]) .lux-card {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 6px 18px rgba(0, 0, 0, 0.3);
        }
        :global([data-bs-theme="dark"]) .lift:hover {
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4), 0 18px 38px rgba(0, 0, 0, 0.45);
        }
        @media (prefers-reduced-motion: reduce) {
          .lux-orb-1, .lux-orb-2, .lux-orb-3 { animation: none; }
        }
      `}</style>
    </div>
  );
}
