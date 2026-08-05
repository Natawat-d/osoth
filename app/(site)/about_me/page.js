"use client";
// หน้าแรกสาธารณะ (/about_me) — แนะนำคลินิก + โปรโมชั่น/คอร์ส + ติดต่อเรา + ปุ่ม login มุมขวาบน
// data ผ่าน RTK Query ทั้งหมด (cache แชร์กับหน้า login/register — setup/state ยิงครั้งเดียว)
import { useEffect } from "react";
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
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: "#1560a3" }}>
        <div className="container">
          <span className="navbar-brand d-flex align-items-center gap-2 fw-bold">
            <img src={`${bp}${brand.logo}`} alt="logo" width={34} height={34} style={{ borderRadius: 6 }} />
            {brand.display_name}
            <span className="fw-normal small opacity-75 d-none d-sm-inline">· {brand.tagline}</span>
          </span>
          <div className="ms-auto d-flex gap-2">
            <Link href="/calendar" className="btn btn-outline-light btn-sm">
              <i className="bi bi-calendar-check me-1" /> ดูคิว / จอง
            </Link>
            <Link href="/login" className="btn btn-light btn-sm fw-semibold">
              <i className="bi bi-box-arrow-in-right me-1" /> เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — รูปคลินิกเป็นพื้นหลัง เบลอหน่อยๆ + ทับขาวใสๆ (ไม่มีรูป → gradient เดิม) */}
      <header className="text-center py-5 position-relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#1560a3,#0f4a7d)" }}>
        <div aria-hidden className="position-absolute top-0 start-0 w-100 h-100"
             style={{
               backgroundImage: `url(${bp}/brand/hero.jpg)`,
               backgroundSize: "cover", backgroundPosition: "center 30%",
               filter: "blur(4px) brightness(1.04)", transform: "scale(1.06)",
             }} />
        <div aria-hidden className="position-absolute top-0 start-0 w-100 h-100"
             style={{ background: "linear-gradient(120deg, rgba(255,255,255,.86) 0%, rgba(232,242,250,.7) 55%, rgba(214,231,246,.55) 100%)" }} />
        <div className="container py-4 position-relative" style={{ color: "#0f3c66" }}>
          <img src={`${bp}${brand.logo}`} alt="logo" width={92} height={92}
               className="mb-3" style={{ borderRadius: 18, boxShadow: "0 8px 24px rgba(15,60,102,.25)" }} />
          <div className="mb-2">
            <span className="badge rounded-pill px-3 py-2 fw-semibold"
                  style={{ background: "rgba(21,96,163,.12)", color: "#0f4a7d", letterSpacing: ".03em" }}>
              <i className="bi bi-flower1 me-1" />{brand.tagline}
            </span>
          </div>
          <h1 className="display-5 fw-bold mb-2">{company?.name || brand.display_name}</h1>
          {brand.about && <p className="lead mx-auto mb-0" style={{ maxWidth: 640 }}>{brand.about}</p>}
          <div className="d-flex gap-2 justify-content-center mt-4 flex-wrap">
            <Link href="/calendar" className="btn btn-primary btn-lg fw-semibold shadow-sm px-4">
              <i className="bi bi-calendar-heart me-1" /> ดูคิวว่าง & จอง
            </Link>
            <Link href="/login" className="btn btn-outline-primary btn-lg bg-white bg-opacity-75 px-4">เข้าสู่ระบบพนักงาน</Link>
          </div>
          {/* ช่องทางติดต่อด่วน */}
          {(mainBranch?.phone || mainBranch?.line_id) && (
            <div className="d-flex gap-3 justify-content-center mt-3 flex-wrap small fw-semibold">
              {mainBranch?.phone && (
                <a href={`tel:${mainBranch.phone}`} className="text-decoration-none" style={{ color: "#0f4a7d" }}>
                  <i className="bi bi-telephone-fill me-1" />{mainBranch.phone}
                </a>
              )}
              {lineHref && (
                <a href={lineHref} target="_blank" rel="noreferrer" className="text-decoration-none" style={{ color: "#0f4a7d" }}>
                  <i className="bi bi-chat-dots-fill me-1" />LINE {mainBranch.line_id}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container py-5 flex-grow-1">
        {/* จุดเด่นบริการ */}
        <div className="row g-4 mb-5">
          {[
            { ico: "bi-gem", t: "บริการครบวงจร", d: "ดูแลความงามโดยแพทย์และผู้เชี่ยวชาญ" },
            { ico: "bi-shield-check", t: "ปลอดภัย มาตรฐาน", d: "เวชภัณฑ์คุณภาพ ตรวจสอบย้อนกลับได้" },
            { ico: "bi-stars", t: "คอร์ส & โปรโมชั่น", d: "แพ็กเกจคุ้มค่า ปรับตามความต้องการ" },
          ].map((f) => (
            <div className="col-md-4" key={f.t}>
              <div className="card h-100 shadow-sm border-0 text-center p-4 lift">
                <div className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
                     style={{ width: 72, height: 72, background: "rgba(21,96,163,.1)" }}>
                  <i className={`bi ${f.ico}`} style={{ fontSize: 32, color: "#1560a3" }} />
                </div>
                <h5 className="fw-bold">{f.t}</h5>
                <p className="text-muted mb-0">{f.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* โปรโมชั่น */}
        {promos.length > 0 && (
          <section className="mb-5">
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <h3 className="fw-bold mb-0"><i className="bi bi-tag-fill text-primary me-2" />โปรโมชั่น</h3>
            </div>
            <p className="text-muted mb-3">ข้อเสนอพิเศษช่วงนี้ — จองก่อนหมดเขต</p>
            <div className="row g-3">
              {promos.map((p, i) => (
                <div className="col-md-4" key={i}>
                  <div className="card h-100 shadow-sm border-0 overflow-hidden lift">
                    {p.banner_image && <img src={p.banner_image} className="card-img-top" alt={p.name} style={{ height: 160, objectFit: "cover" }} />}
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
          <section className="mb-5">
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <h3 className="fw-bold mb-0"><i className="bi bi-grid-3x3-gap-fill text-primary me-2" />คอร์สแนะนำ</h3>
            </div>
            <p className="text-muted mb-3">แพ็กเกจดูแลผิวยอดนิยม สอบถามรายละเอียดได้ที่คลินิก</p>
            <div className="row g-3">
              {courses.map((c, i) => (
                <div className="col-md-3 col-6" key={i}>
                  <div className="card h-100 shadow-sm border-0 overflow-hidden lift">
                    {c.image && <img src={c.image} className="card-img-top" alt={c.name} style={{ height: 130, objectFit: "cover" }} />}
                    <div className="card-body d-flex flex-column">
                      <h6 className="fw-bold mb-1">{c.name}</h6>
                      <div className="mt-auto d-flex align-items-center justify-content-between">
                        <span className="text-primary fw-bold">{Number(c.price).toLocaleString()} ฿</span>
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
          <section className="mb-5 text-center">
            <div className="card shadow-sm border-0 py-5">
              <div className="card-body">
                <i className="bi bi-stars text-primary" style={{ fontSize: 40 }} />
                <h5 className="fw-bold mt-3 mb-1">โปรโมชั่นใหม่กำลังจะมา</h5>
                <p className="text-muted mb-0">สอบถามคอร์สและสิทธิพิเศษล่าสุดได้ที่เคาน์เตอร์ หรือช่องทางติดต่อด้านล่าง</p>
              </div>
            </div>
          </section>
        )}

        {/* ติดต่อเรา */}
        <section id="contact">
          <div className="d-flex align-items-baseline gap-2 mb-1">
            <h3 className="fw-bold mb-0"><i className="bi bi-geo-alt-fill text-primary me-2" />ติดต่อ & จองคิว</h3>
          </div>
          <p className="text-muted mb-3">ทีมงานพร้อมให้คำปรึกษาและจองคิวให้คุณทุกวัน</p>
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <div className="row g-4 align-items-center">
                <div className="col-lg-7">
                  <div className="d-flex flex-column gap-2">
                    {mainBranch?.address && (
                      <div className="d-flex gap-2">
                        <i className="bi bi-geo-alt text-primary" />
                        <span>{mainBranch.address}</span>
                      </div>
                    )}
                    {mainBranch?.phone && (
                      <div className="d-flex gap-2">
                        <i className="bi bi-telephone text-primary" />
                        <span>{mainBranch.phone}</span>
                      </div>
                    )}
                    {mainBranch?.line_id && (
                      <div className="d-flex gap-2">
                        <i className="bi bi-chat-dots text-primary" />
                        <span>LINE {mainBranch.line_id}</span>
                      </div>
                    )}
                    {!mainBranch && <span className="text-muted">— กำลังโหลดข้อมูลสาขา —</span>}
                  </div>
                </div>
                <div className="col-lg-5">
                  <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                    {mainBranch?.phone && (
                      <a className="btn btn-primary px-4" href={`tel:${mainBranch.phone}`}>
                        <i className="bi bi-telephone-fill me-1" /> โทรจองคิว
                      </a>
                    )}
                    {lineHref && (
                      <a className="btn btn-success px-4" target="_blank" rel="noreferrer" href={lineHref}>
                        <i className="bi bi-chat-dots-fill me-1" /> LINE
                      </a>
                    )}
                    <Link href="/calendar" className="btn btn-outline-primary px-4">
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
        .lift { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .lift:hover { transform: translateY(-3px); box-shadow: 0 0.5rem 1.25rem rgba(15, 60, 102, 0.12) !important; }
      `}</style>
    </div>
  );
}
