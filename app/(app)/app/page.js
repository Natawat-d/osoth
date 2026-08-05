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

  // KPI: การ์ดพื้นกลาง + ไอคอนชิปสี (แทนการ์ดสีทึบ 6 สี — อ่านง่ายขึ้น รอด dark mode)
  const kpis = [
    { label: "รายรับ", value: t ? `${money(t.income)}฿` : null, sub: t ? `${t.tx} ธุรกรรม · เฉลี่ย ${money(t.avg_tx)}฿` : "", ico: "bi-cash-stack", bg: "text-bg-primary" },
    { label: "กำไรสุทธิ", value: t ? `${money(t.net)}฿` : null, sub: t && t.income > 0 ? `margin ${Math.round((t.net / t.income) * 100)}%` : "", ico: "bi-graph-up-arrow", bg: (t?.net ?? 0) >= 0 ? "text-bg-success" : "text-bg-danger" },
    { label: "ต้นทุนรวม", value: t ? `${money(t.cogs + t.labor + t.expense)}฿` : null, sub: t ? `ยา ${money(t.cogs)} · ค่ามือ ${money(t.labor)}` : "", ico: "bi-basket", bg: "text-bg-secondary" },
    { label: "เคสปิด", value: t ? money(t.cases) : null, sub: "ช่วงที่เลือก", ico: "bi-clipboard2-check", bg: "text-bg-info" },
    { label: "คอร์สขายได้", value: t ? money(t.courses_sold) : null, sub: "ช่วงที่เลือก", ico: "bi-bag-check", chipStyle: { background: "#6f42c1", color: "#fff" } },
    { label: "ลูกหนี้ค้างชำระ", value: ar ? `${money(ar.total)}฿` : null, sub: ar ? `${ar.rows.length} รายการ` : "", ico: "bi-hourglass-split", bg: "text-bg-warning" },
  ];

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        {/* หัว + ช่วงวันที่ */}
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="mb-0 fw-bold">Dashboard</h4>
          <span className="text-muted small">ภาพรวมธุรกิจ</span>
          <div className="ms-auto d-flex align-items-center gap-2">
            {[["7 วัน", 6], ["30 วัน", 29], ["90 วัน", 89]].map(([l, n]) => (
              <button key={l} className={`btn btn-sm ${from === daysAgo(n) ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => { setFrom(daysAgo(n)); setTo(dstr(new Date())); }}>{l}</button>
            ))}
            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted">–</span>
            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={to} onChange={(e) => setTo(e.target.value)} />
            {isFetching && <div className="spinner-border spinner-border-sm text-primary" />}
          </div>
        </div>

        {error && <div className="alert alert-danger">{error.message}</div>}

        {/* KPI 6 ใบ */}
        <div className="row g-2 mb-3">
          {kpis.map((k) => (
            <div className="col-xl-2 col-md-4 col-6" key={k.label}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body py-2 px-3 d-flex align-items-center gap-2">
                  <span className={`d-inline-flex flex-shrink-0 align-items-center justify-content-center rounded-3 ${k.bg || ""}`}
                        style={{ width: 42, height: 42, ...k.chipStyle }}>
                    <i className={`bi ${k.ico} fs-5`} />
                  </span>
                  <div className="min-w-0 flex-grow-1">
                    <div className="text-muted text-truncate" style={{ fontSize: 12 }}>{k.label}</div>
                    {k.value === null
                      ? <div className="placeholder-glow"><span className="placeholder rounded" style={{ width: 70 }} /></div>
                      : <div className="fs-5 fw-bold lh-sm text-truncate">{k.value}</div>}
                    {k.sub && <div className="text-muted text-truncate" style={{ fontSize: 11 }}>{k.sub}</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* แถวกราฟหลัก: รายรับ-กำไรรายวัน + ช่องทางชำระ */}
        <div className="row g-3 mb-3">
          <div className="col-lg-8">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2"><i className="bi bi-graph-up me-1 text-primary" /> รายรับ · กำไรสุทธิ รายวัน</div>
              <div className="card-body py-2">
                <LineChart data={series} height={235} series={[
                  { key: "income", label: "รายรับ", color: "#1560a3" },
                  { key: "net", label: "กำไรสุทธิ", color: "#198754" },
                ]} />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2"><i className="bi bi-credit-card me-1 text-primary" /> รายรับแยกช่องทาง</div>
              <div className="card-body py-2 d-flex align-items-center justify-content-center">
                <DonutChart data={methodDonut} size={160} unit="฿" />
              </div>
            </div>
          </div>
        </div>

        {/* แถวต้นทุน: โครงสร้างต้นทุนรายวัน (stacked) + สัดส่วนต้นทุน */}
        <div className="row g-3 mb-3">
          <div className="col-lg-8">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2"><i className="bi bi-bar-chart-steps me-1 text-danger" /> โครงสร้างต้นทุนรายวัน</div>
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
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2"><i className="bi bi-pie-chart me-1 text-danger" /> สัดส่วนต้นทุน</div>
              <div className="card-body py-2 d-flex align-items-center justify-content-center">
                <DonutChart data={costDonut} size={160} unit="฿" />
              </div>
            </div>
          </div>
        </div>

        {/* แถวขาย/คน: ยอดขายต่อคอร์ส + ท็อปพนักงาน */}
        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2 d-flex">
                <span><i className="bi bi-grid-3x3-gap me-1 text-primary" /> รายได้ต่อคอร์ส (Top 7)</span>
                <Link href="/app/finance" className="ms-auto small text-decoration-none">การเงิน →</Link>
              </div>
              <div className="card-body py-3"><HBarChart data={courseBars} unit="฿" /></div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2 d-flex">
                <span><i className="bi bi-trophy me-1 text-warning" /> ท็อปพนักงาน — ค่ามือ+คอม (Top 7)</span>
                <Link href="/app/hr" className="ms-auto small text-decoration-none">HR →</Link>
              </div>
              <div className="card-body py-3"><HBarChart data={staffBars} unit="฿" /></div>
            </div>
          </div>
        </div>

        {/* แจ้งเตือนธุรกิจ + ลูกหนี้ */}
        <div className="row g-3 mb-3">
          <div className="col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2 d-flex">
                <span><i className="bi bi-exclamation-triangle me-1 text-danger" /> สต๊อกต้องจัดการ</span>
                <Link href="/app/inventory" className="ms-auto small text-decoration-none">คลัง →</Link>
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
                  <li className="list-group-item text-muted py-4 text-center">
                    <i className="bi bi-check-circle text-success d-block mb-1 fs-5" />สต๊อกปกติ ไม่มีรายการต้องจัดการ
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2 d-flex">
                <span><i className="bi bi-person-down me-1 text-warning" /> ลูกหนี้ค้างนาน</span>
                <Link href="/app/finance" className="ms-auto small text-decoration-none">AR →</Link>
              </div>
              <ul className="list-group list-group-flush small">
                {(ar?.rows || []).slice(0, 5).map((r) => (
                  <li className="list-group-item py-2" key={r.customer_course_ID}>
                    <div className="d-flex">
                      <span className="text-truncate">{r.customer}</span>
                      <b className="ms-auto text-danger">{money(r.balance_due)}฿</b>
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{r.course} · ค้าง {r.days} วัน</div>
                  </li>
                ))}
                {!ar?.rows?.length && (
                  <li className="list-group-item text-muted py-4 text-center">
                    <i className="bi bi-check-circle text-success d-block mb-1 fs-5" />ไม่มีลูกหนี้ค้างชำระ
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold py-2 d-flex">
                <span><i className="bi bi-cart-check me-1 text-info" /> PO ค้างรับ ({openPo.length})</span>
                <Link href="/app/inventory" className="ms-auto small text-decoration-none">PO →</Link>
              </div>
              <ul className="list-group list-group-flush small">
                {openPo.slice(0, 5).map((p) => (
                  <li className="list-group-item d-flex py-2" key={p.po_ID}>
                    <span className="font-monospace">{p.po_ID}</span>
                    <span className="text-muted ms-2 text-truncate">{p.supplier || "-"}</span>
                    <b className="ms-auto">{money(p.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0))}฿</b>
                  </li>
                ))}
                {!openPo.length && (
                  <li className="list-group-item text-muted py-4 text-center">
                    <i className="bi bi-check-circle text-success d-block mb-1 fs-5" />ไม่มี PO ค้างรับ
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* ทางลัดโมดูล */}
        <div className="row g-2 mb-3">
          {[
            { href: "/app/setup", ico: "bi-sliders", label: "ตั้งค่าธุรกิจ" },
            { href: "/app/inventory", ico: "bi-box-seam", label: "คลังสินค้า" },
            { href: "/app/finance", ico: "bi-cash-coin", label: "การเงิน/บัญชี" },
            { href: "/app/hr", ico: "bi-people", label: "บุคคล (HR)" },
          ].map((m) => (
            <div className="col-md-3 col-6" key={m.href}>
              <Link href={m.href} className="card shadow-sm text-decoration-none text-body quick-card h-100">
                <div className="card-body text-center py-3">
                  <i className={`bi ${m.ico} fs-3 text-primary`} />
                  <div className="fw-semibold small mt-1">{m.label} <i className="bi bi-arrow-right-short text-muted" /></div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
      <style jsx global>{`
        .quick-card { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .quick-card:hover { transform: translateY(-2px); box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important; }
      `}</style>
    </div>
  );
}
