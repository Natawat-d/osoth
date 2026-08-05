"use client";
// Dashboard เจ้าของ (/app) — ภาพรวมละเอียด: KPI 6 ใบ + กราฟย่อยหลายตัว + แจ้งเตือนธุรกิจ
// data ทั้งหมดผ่าน RTK Query (exec summary + AR + stock + PO) — cache แชร์, realtime invalidate แล้วกราฟขยับเอง
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  useGetExecSummaryQuery, useGetFinReportQuery, useGetStockSummaryQuery, useGetPOsQuery,
} from "@/store/apiSlice";
import { LineChart, StackedBarChart, HBarChart, DonutChart, V2_PALETTE } from "@/components/V2Charts";

const money = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dstr(d); };

const METHOD_TH = { cash: "เงินสด", transfer: "โอน", card: "บัตร" };
const ROLE_TH = { doctor: "หมอ", BT: "BT", sale: "เซลล์", admin: "แอดมิน", acception: "ต้อนรับ" };

export default function DashboardPage() {
  const auth = useSelector((s) => s.auth);
  const router = useRouter();
  const isOwner = auth.user?.role === "super_admin";

  // ช่วงวันที่ (default 30 วันล่าสุด)
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(dstr(new Date()));

  const { data, error, isFetching } = useGetExecSummaryQuery(`?from=${from}&to=${to}`, { skip: !isOwner });
  const { data: ar } = useGetFinReportQuery({ kind: "ar" }, { skip: !isOwner });
  const { data: stock = [] } = useGetStockSummaryQuery(undefined, { skip: !isOwner });
  const { data: pos = [] } = useGetPOsQuery(undefined, { skip: !isOwner });

  useEffect(() => {
    if (auth.ready && auth.user && !isOwner) router.replace("/app/opd"); // role อื่นไปหน้างาน (กัน loop root→/app)
  }, [auth.ready, auth.user, isOwner, router]);

  // ---- แปลงข้อมูลเป็นชุดกราฟ (memo กันคำนวณซ้ำ) ----
  const t = data?.total;
  const series = data?.series || [];

  const methodDonut = useMemo(() =>
    Object.entries(data?.income_by_method || {}).map(([k, v], i) => ({
      label: METHOD_TH[k] || k, value: v, color: [V2_PALETTE[0], V2_PALETTE[1], V2_PALETTE[3]][i % 3],
    })), [data]);

  // bar ใช้สีเดียวต่อการ์ด (สีสลับหลายสีไม่สื่อความหมาย — แดงชวนเข้าใจผิดว่าแย่)
  const courseBars = useMemo(() =>
    (data?.sales_by_course || []).slice(0, 7).map((c) => ({ label: c.name, value: c.revenue, hint: `${c.count} คอร์ส`, color: "#1560a3" })), [data]);

  const staffBars = useMemo(() =>
    (data?.top_staff || []).slice(0, 7).map((s) => ({ label: s.name, value: s.total, hint: ROLE_TH[s.role] || s.role, color: "#fd7e14" })), [data]);

  const costDonut = useMemo(() => t ? [
    { label: "ต้นทุนยา (COGS)", value: t.cogs, color: "#dc3545" },
    { label: "ค่ามือ+คอม", value: t.labor, color: "#fd7e14" },
    { label: "ค่าใช้จ่ายอื่น", value: t.expense, color: "#6c757d" },
  ] : [], [t]);

  // แจ้งเตือนธุรกิจ
  const lowStock = stock.filter((r) => r.warnings.some((w) => w.type === "low_stock"));
  const expiring = stock.filter((r) => r.warnings.some((w) => w.type === "lot_expiry"));
  const openPo = pos.filter((p) => p.status === "ordered");

  if (auth.user && !isOwner) return null;

  const thaiDate = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const heroName = auth.user?.nick_name || auth.user?.full_name || "ผู้บริหาร";

  // KPI: การ์ดพื้นกลาง + ไอคอนชิป gradient (อ่านง่าย รอด dark mode)
  const kpis = [
    { label: "รายรับ", value: t ? `${money(t.income)}฿` : null, sub: t ? `${t.tx} ธุรกรรม · เฉลี่ย ${money(t.avg_tx)}฿` : "", ico: "bi-cash-stack", grad: "linear-gradient(135deg,#1560a3,#2a7bc4)" },
    { label: "กำไรสุทธิ", value: t ? `${money(t.net)}฿` : null, sub: t && t.income > 0 ? `margin ${Math.round((t.net / t.income) * 100)}%` : "", ico: "bi-graph-up-arrow", grad: (t?.net ?? 0) >= 0 ? "linear-gradient(135deg,#157347,#2eb377)" : "linear-gradient(135deg,#b02a37,#e35d6a)" },
    { label: "ต้นทุนรวม", value: t ? `${money(t.cogs + t.labor + t.expense)}฿` : null, sub: t ? `ยา ${money(t.cogs)} · ค่ามือ ${money(t.labor)}` : "", ico: "bi-basket", grad: "linear-gradient(135deg,#495057,#848c94)" },
    { label: "เคสปิด", value: t ? money(t.cases) : null, sub: "ช่วงที่เลือก", ico: "bi-clipboard2-check", grad: "linear-gradient(135deg,#0f7285,#2ec3e0)" },
    { label: "คอร์สขายได้", value: t ? money(t.courses_sold) : null, sub: "ช่วงที่เลือก", ico: "bi-bag-check", grad: "linear-gradient(135deg,#59359a,#8a63d2)" },
    { label: "ลูกหนี้ค้างชำระ", value: ar ? `${money(ar.total)}฿` : null, sub: ar ? `${ar.rows.length} รายการ` : "", ico: "bi-hourglass-split", grad: "linear-gradient(135deg,#c07f00,#f0b429)" },
  ];

  const quickLinks = [
    { href: "/app/setup", ico: "bi-sliders", label: "ตั้งค่าธุรกิจ", desc: "สาขา · คอร์ส · สิทธิ์" },
    { href: "/app/inventory", ico: "bi-box-seam", label: "คลังสินค้า", desc: "สต๊อก · ล็อต · PO" },
    { href: "/app/finance", ico: "bi-cash-coin", label: "การเงิน/บัญชี", desc: "รายรับ · ลูกหนี้ · งบ" },
    { href: "/app/hr", ico: "bi-people", label: "บุคคล (HR)", desc: "พนักงาน · ค่ามือ · คอม" },
  ];

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">

        {/* แถบต้อนรับ + ช่วงวันที่ */}
        <div className="dash-hero rounded-4 mb-3 p-3 p-lg-4 position-relative overflow-hidden text-white">
          <div className="hero-orb orb-a" aria-hidden="true" />
          <div className="hero-orb orb-b" aria-hidden="true" />
          <div className="d-flex flex-wrap align-items-center gap-3 position-relative">
            <div className="me-auto">
              <div className="hero-kicker">Dashboard · ภาพรวมธุรกิจ</div>
              <h3 className="fw-bold mb-1 lh-sm">สวัสดี, คุณ{heroName}</h3>
              <div className="hero-date small"><i className="bi bi-calendar3 me-1" />{thaiDate}</div>
              <div className="hero-sum small mt-2">
                {t
                  ? <>ช่วงที่เลือกทำรายรับ <b className="tnum">{money(t.income)}฿</b> · กำไรสุทธิ <b className="tnum">{money(t.net)}฿</b> · ปิดเคสแล้ว <b className="tnum">{money(t.cases)}</b> เคส</>
                  : <span className="placeholder-glow"><span className="placeholder rounded" style={{ width: 220 }} /></span>}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {[["7 วัน", 6], ["30 วัน", 29], ["90 วัน", 89]].map(([l, n]) => (
                <button key={l} className={`btn btn-sm rounded-pill px-3 hero-pill ${from === daysAgo(n) ? "active" : ""}`}
                  onClick={() => { setFrom(daysAgo(n)); setTo(dstr(new Date())); }}>{l}</button>
              ))}
              <input type="date" className="form-control form-control-sm hero-input" style={{ width: 140 }} value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="hero-sep">–</span>
              <input type="date" className="form-control form-control-sm hero-input" style={{ width: 140 }} value={to} onChange={(e) => setTo(e.target.value)} />
              {isFetching && <div className="spinner-border spinner-border-sm text-white" />}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error.message}</div>}

        {/* KPI 6 ใบ */}
        <div className="row g-2 mb-3">
          {kpis.map((k, idx) => (
            <div className="col-xl-2 col-md-4 col-6" key={k.label}>
              <div className="card border-0 pcard kpi-card h-100">
                <div className="card-body py-2 px-3 d-flex align-items-center gap-2">
                  <span className="d-inline-flex flex-shrink-0 align-items-center justify-content-center rounded-3 text-white kpi-chip"
                        style={{ width: 44, height: 44, background: k.grad }}>
                    <i className={`bi ${k.ico} fs-5`} />
                  </span>
                  <div className="min-w-0 flex-grow-1">
                    <div className="kpi-label text-muted text-truncate">{k.label}</div>
                    {k.value === null
                      ? <div className="placeholder-glow"><span className="placeholder rounded" style={{ width: 70 }} /></div>
                      : <div className="fs-5 fw-bold lh-sm text-truncate tnum kpi-val" style={{ animationDelay: `${idx * 70}ms` }}>{k.value}</div>}
                    {k.sub && <div className="text-muted text-truncate tnum" style={{ fontSize: 11 }}>{k.sub}</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* แถวกราฟหลัก: รายรับ-กำไรรายวัน + ช่องทางชำระ */}
        <div className="row g-3 mb-3">
          <div className="col-lg-8">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2"><i className="bi bi-graph-up me-1 text-primary" /> รายรับ · กำไรสุทธิ รายวัน</div>
              <div className="card-body py-2">
                <LineChart data={series} height={235} series={[
                  { key: "income", label: "รายรับ", color: "#1560a3" },
                  { key: "net", label: "กำไรสุทธิ", color: "#198754" },
                ]} />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2"><i className="bi bi-credit-card me-1 text-primary" /> รายรับแยกช่องทาง</div>
              <div className="card-body py-2 d-flex align-items-center justify-content-center">
                <DonutChart data={methodDonut} size={160} unit="฿" />
              </div>
            </div>
          </div>
        </div>

        {/* แถวต้นทุน: โครงสร้างต้นทุนรายวัน (stacked) + สัดส่วนต้นทุน */}
        <div className="row g-3 mb-3">
          <div className="col-lg-8">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2"><i className="bi bi-bar-chart-steps me-1 text-danger" /> โครงสร้างต้นทุนรายวัน</div>
              <div className="card-body py-2">
                <StackedBarChart data={series} height={220} series={[
                  { key: "cogs", label: "ต้นทุนยา", color: "#dc3545" },
                  { key: "labor", label: "ค่ามือ+คอม", color: "#fd7e14" },
                  { key: "expense", label: "ค่าใช้จ่ายอื่น", color: "#6c757d" },
                ]} />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2"><i className="bi bi-pie-chart me-1 text-danger" /> สัดส่วนต้นทุน</div>
              <div className="card-body py-2 d-flex align-items-center justify-content-center">
                <DonutChart data={costDonut} size={160} unit="฿" />
              </div>
            </div>
          </div>
        </div>

        {/* แถวขาย/คน: ยอดขายต่อคอร์ส + ท็อปพนักงาน */}
        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2 d-flex">
                <span><i className="bi bi-grid-3x3-gap me-1 text-primary" /> รายได้ต่อคอร์ส (Top 7)</span>
                <Link href="/app/finance" className="ms-auto small text-decoration-none plink">การเงิน <i className="bi bi-arrow-right-short" /></Link>
              </div>
              <div className="card-body py-3"><HBarChart data={courseBars} unit="฿" /></div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2 d-flex">
                <span><i className="bi bi-trophy me-1 text-warning" /> ท็อปพนักงาน — ค่ามือ+คอม (Top 7)</span>
                <Link href="/app/hr" className="ms-auto small text-decoration-none plink">HR <i className="bi bi-arrow-right-short" /></Link>
              </div>
              <div className="card-body py-3"><HBarChart data={staffBars} unit="฿" /></div>
            </div>
          </div>
        </div>

        {/* แจ้งเตือนธุรกิจ + ลูกหนี้ */}
        <div className="row g-3 mb-3">
          <div className="col-lg-4">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2 d-flex">
                <span><i className="bi bi-exclamation-triangle me-1 text-danger" /> สต๊อกต้องจัดการ</span>
                <Link href="/app/inventory" className="ms-auto small text-decoration-none plink">คลัง <i className="bi bi-arrow-right-short" /></Link>
              </div>
              <ul className="list-group list-group-flush small">
                {lowStock.map((r) => (
                  <li className="list-group-item d-flex py-2" key={r.product.product_ID}>
                    <span className="text-truncate">{r.product.name}</span>
                    <span className="badge text-bg-danger ms-auto">เหลือ {r.unused + r.in_use} · ต่ำกว่าจุดสั่งซื้อ</span>
                  </li>
                ))}
                {expiring.map((r) => (
                  <li className="list-group-item d-flex py-2" key={r.product.product_ID + "x"}>
                    <span className="text-truncate">{r.product.name}</span>
                    <span className="badge text-bg-warning ms-auto">ใกล้หมดอายุ</span>
                  </li>
                ))}
                {!lowStock.length && !expiring.length && (
                  <li className="list-group-item border-0 text-center py-4">
                    <span className="empty-orb"><i className="bi bi-check-circle" /></span>
                    <div className="small fw-semibold mt-2">สต๊อกเรียบร้อยดี</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>ไม่มีรายการต้องจัดการตอนนี้</div>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2 d-flex">
                <span><i className="bi bi-person-down me-1 text-warning" /> ลูกหนี้ค้างนาน</span>
                <Link href="/app/finance" className="ms-auto small text-decoration-none plink">AR <i className="bi bi-arrow-right-short" /></Link>
              </div>
              <ul className="list-group list-group-flush small">
                {(ar?.rows || []).slice(0, 5).map((r) => (
                  <li className="list-group-item py-2" key={r.customer_course_ID}>
                    <div className="d-flex">
                      <span className="text-truncate">{r.customer}</span>
                      <b className="ms-auto text-danger tnum">{money(r.balance_due)}฿</b>
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{r.course} · ค้าง {r.days} วัน</div>
                  </li>
                ))}
                {!ar?.rows?.length && (
                  <li className="list-group-item border-0 text-center py-4">
                    <span className="empty-orb"><i className="bi bi-check-circle" /></span>
                    <div className="small fw-semibold mt-2">ไม่มีลูกหนี้ค้างชำระ</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>ทุกยอดเก็บครบเรียบร้อย</div>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 pcard h-100">
              <div className="card-header phead py-2 d-flex">
                <span><i className="bi bi-cart-check me-1 text-info" /> PO ค้างรับ ({openPo.length})</span>
                <Link href="/app/inventory" className="ms-auto small text-decoration-none plink">PO <i className="bi bi-arrow-right-short" /></Link>
              </div>
              <ul className="list-group list-group-flush small">
                {openPo.slice(0, 5).map((p) => (
                  <li className="list-group-item d-flex py-2" key={p.po_ID}>
                    <span className="font-monospace">{p.po_ID}</span>
                    <span className="text-muted ms-2 text-truncate">{p.supplier || "-"}</span>
                    <b className="ms-auto tnum">{money(p.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0))}฿</b>
                  </li>
                ))}
                {!openPo.length && (
                  <li className="list-group-item border-0 text-center py-4">
                    <span className="empty-orb"><i className="bi bi-check-circle" /></span>
                    <div className="small fw-semibold mt-2">ไม่มี PO ค้างรับ</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>รับของครบทุกใบสั่งซื้อแล้ว</div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* ทางลัดโมดูล */}
        <div className="row g-2 mb-3">
          {quickLinks.map((m) => (
            <div className="col-md-3 col-6" key={m.href}>
              <Link href={m.href} className="card text-decoration-none text-body quick-card h-100">
                <div className="card-body text-center py-3">
                  <span className="qc-ico d-inline-flex align-items-center justify-content-center rounded-circle mb-2">
                    <i className={`bi ${m.ico} fs-4`} />
                  </span>
                  <div className="fw-semibold small">{m.label} <i className="bi bi-arrow-right-short qc-arrow" /></div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{m.desc}</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .tnum { font-variant-numeric: tabular-nums; }

        /* ── แถบต้อนรับ gradient แบรนด์ ── */
        .dash-hero {
          background: linear-gradient(135deg, #124f87 0%, #1560a3 45%, #2a7bc4 100%);
          box-shadow: 0 14px 34px -14px rgba(21, 96, 163, 0.5);
          animation: heroIn 0.5s ease both;
        }
        @keyframes heroIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .hero-orb { position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle at 32% 32%, rgba(255,255,255,0.2), rgba(255,255,255,0) 70%); }
        .orb-a { width: 360px; height: 360px; top: -190px; right: -70px; }
        .orb-b { width: 240px; height: 240px; bottom: -150px; left: 32%; }
        .hero-kicker { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.78; font-weight: 600; }
        .hero-date { opacity: 0.85; }
        .hero-sum { opacity: 0.92; }
        .hero-sum b { font-weight: 700; }
        .hero-sep { color: rgba(255, 255, 255, 0.6); }
        .hero-pill { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.38); color: #fff;
          transition: background 0.18s ease, transform 0.15s ease; }
        .hero-pill:hover { background: rgba(255,255,255,0.26); border-color: rgba(255,255,255,0.55); color: #fff; }
        .hero-pill:active { transform: scale(0.96); }
        .hero-pill.active { background: #fff; color: #1560a3; border-color: #fff; font-weight: 600;
          box-shadow: 0 3px 10px -2px rgba(0, 0, 0, 0.25); }
        .hero-pill:focus-visible { outline: 2px solid rgba(255,255,255,0.85); outline-offset: 2px; box-shadow: none; }
        .hero-input { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.38); color: #fff;
          color-scheme: dark; transition: background 0.18s ease, border-color 0.18s ease; }
        .hero-input:focus { background: rgba(255,255,255,0.24); border-color: #fff; color: #fff;
          box-shadow: 0 0 0 0.2rem rgba(255,255,255,0.18); }

        /* ── การ์ดพรีเมียม: เงา 2 ระดับ + ยกตอน hover ── */
        .pcard { border-radius: 0.9rem; border: 1px solid var(--bs-border-color-translucent);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06);
          transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .pcard:hover { transform: translateY(-2px);
          box-shadow: 0 12px 26px -10px rgba(21, 96, 163, 0.2), 0 4px 10px rgba(16, 24, 40, 0.07); }
        .pcard .card-header.phead { background: transparent; border-bottom: 1px solid var(--bs-border-color-translucent);
          font-weight: 600; font-size: 13.5px; letter-spacing: 0.01em; }
        .pcard .list-group-item { background: transparent; }
        .plink { color: var(--bs-primary); font-weight: 500; transition: opacity 0.15s ease; }
        .plink:hover { opacity: 0.75; }

        /* ── KPI ── */
        .kpi-label { font-size: 11px; letter-spacing: 0.05em; font-weight: 600; text-transform: uppercase; }
        .kpi-chip { box-shadow: 0 4px 10px -3px rgba(16, 24, 40, 0.35); transition: transform 0.2s ease; }
        .kpi-card:hover .kpi-chip { transform: scale(1.07) rotate(-3deg); }
        .kpi-val { animation: kpiPop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.15) both; }
        @keyframes kpiPop { from { opacity: 0; transform: translateY(7px) scale(0.94); } to { opacity: 1; transform: none; } }

        /* ── empty state ── */
        .empty-orb { width: 46px; height: 46px; border-radius: 50%; display: inline-flex; align-items: center;
          justify-content: center; font-size: 21px; color: var(--bs-success);
          background: rgba(25, 135, 84, 0.12); }

        /* ── ทางลัดโมดูล: gradient border ตอน hover ── */
        .quick-card { border-radius: 0.9rem; border: 1px solid var(--bs-border-color-translucent);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease; }
        .quick-card:hover { transform: translateY(-3px); border-color: transparent;
          background: linear-gradient(var(--bs-card-bg), var(--bs-card-bg)) padding-box,
                      linear-gradient(135deg, #1560a3, #2a7bc4) border-box;
          box-shadow: 0 14px 28px -12px rgba(21, 96, 163, 0.35); }
        .quick-card:active { transform: translateY(-1px) scale(0.99); }
        .qc-ico { width: 52px; height: 52px; color: var(--bs-primary); background: rgba(21, 96, 163, 0.1);
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease; }
        .quick-card:hover .qc-ico { background: linear-gradient(135deg, #1560a3, #2a7bc4); color: #fff; transform: scale(1.08); }
        .qc-arrow { color: var(--bs-secondary-color); transition: transform 0.2s ease, color 0.2s ease; display: inline-block; }
        .quick-card:hover .qc-arrow { transform: translateX(3px); color: var(--bs-primary); }

        @media (prefers-reduced-motion: reduce) {
          .dash-hero, .kpi-val { animation: none; }
          .pcard, .quick-card, .kpi-chip, .qc-ico, .qc-arrow { transition: none; }
        }
      `}</style>
    </div>
  );
}
