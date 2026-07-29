"use client";
// หน้าแรกสาธารณะ (/about_me) — แนะนำคลินิก + โปรโมชั่น/คอร์ส + ปุ่ม login มุมขวาบน
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

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9" }}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: "#1560a3" }}>
        <div className="container">
          <span className="navbar-brand d-flex align-items-center gap-2 fw-bold">
            <img src={`${bp}${brand.logo}`} alt="logo" width={34} height={34} style={{ borderRadius: 6 }} />
            {brand.display_name}
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
             style={{ background: "linear-gradient(120deg, rgba(255,255,255,.82) 0%, rgba(232,242,250,.66) 55%, rgba(214,231,246,.5) 100%)" }} />
        <div className="container py-4 position-relative" style={{ color: "#0f3c66" }}>
          <img src={`${bp}${brand.logo}`} alt="logo" width={92} height={92}
               className="mb-3" style={{ borderRadius: 18, boxShadow: "0 8px 24px rgba(15,60,102,.25)" }} />
          <h1 className="display-5 fw-bold">{company?.name || brand.display_name}</h1>
          <p className="lead mb-3">{brand.tagline}</p>
          {brand.about && <p className="mx-auto" style={{ maxWidth: 640 }}>{brand.about}</p>}
          <div className="d-flex gap-2 justify-content-center mt-3 flex-wrap">
            <Link href="/calendar" className="btn btn-primary btn-lg fw-semibold shadow-sm">
              <i className="bi bi-calendar-heart me-1" /> ดูคิวว่าง & จอง
            </Link>
            <Link href="/login" className="btn btn-outline-primary btn-lg bg-white bg-opacity-75">เข้าสู่ระบบพนักงาน</Link>
          </div>
        </div>
      </header>

      <main className="container py-5">
        {/* จุดเด่นบริการ */}
        <div className="row g-4 mb-5">
          {[
            { ico: "bi-gem", t: "บริการครบวงจร", d: "ดูแลความงามโดยแพทย์และผู้เชี่ยวชาญ" },
            { ico: "bi-shield-check", t: "ปลอดภัย มาตรฐาน", d: "เวชภัณฑ์คุณภาพ ตรวจสอบย้อนกลับได้" },
            { ico: "bi-stars", t: "คอร์ส & โปรโมชั่น", d: "แพ็กเกจคุ้มค่า ปรับตามความต้องการ" },
          ].map((f) => (
            <div className="col-md-4" key={f.t}>
              <div className="card h-100 shadow-sm border-0 text-center p-4">
                <div className="mb-2"><i className={`bi ${f.ico}`} style={{ fontSize: 40, color: "#1560a3" }} /></div>
                <h5 className="fw-bold">{f.t}</h5>
                <p className="text-muted mb-0">{f.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* โปรโมชั่น */}
        {promos.length > 0 && (
          <section className="mb-5">
            <h3 className="fw-bold mb-3"><i className="bi bi-tag-fill text-primary me-2" />โปรโมชั่น</h3>
            <div className="row g-3">
              {promos.map((p, i) => (
                <div className="col-md-4" key={i}>
                  <div className="card h-100 shadow-sm border-0">
                    {p.banner_image && <img src={p.banner_image} className="card-img-top" alt={p.name} style={{ height: 160, objectFit: "cover" }} />}
                    <div className="card-body">
                      <h6 className="fw-bold">{p.name}</h6>
                      <span className="badge bg-primary-subtle text-primary">ถึง {p.date_end}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* คอร์ส */}
        {courses.length > 0 && (
          <section>
            <h3 className="fw-bold mb-3"><i className="bi bi-grid-3x3-gap-fill text-primary me-2" />คอร์สแนะนำ</h3>
            <div className="row g-3">
              {courses.map((c, i) => (
                <div className="col-md-3 col-6" key={i}>
                  <div className="card h-100 shadow-sm border-0">
                    {c.image && <img src={c.image} className="card-img-top" alt={c.name} style={{ height: 130, objectFit: "cover" }} />}
                    <div className="card-body">
                      <h6 className="fw-bold mb-1">{c.name}</h6>
                      <div className="text-primary fw-bold">{Number(c.price).toLocaleString()} ฿</div>
                      <small className="text-muted">{c.quantity_used} ครั้ง</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center text-muted py-4 border-top">
        <small>© {new Date().getFullYear()} {company?.name || brand.display_name} · {company?.address}</small>
      </footer>
    </div>
  );
}
