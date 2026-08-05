"use client";
// รายได้ของฉัน — V3 Bootstrap แท้ (ref info-box): เงินเดือนฐาน + ค่ามือ/DF/คอมช่วงที่เลือก + ตาราง + CSV
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { useGetMyPayslipQuery } from "@/store/apiSlice";
import InfoBox from "@/components/InfoBox";
import { exportCsv } from "@/lib/exportCsv";

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const fmtD = (d) => (d ? String(d).split("-").reverse().join("/") : "—");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const TYPE_TH = {
  procedure_fee: ["ค่ามือ/DF", "info"],
  commission: ["คอมมิชชั่น", "success"],
  addon_commission: ["คอม add-on", "success"],
};
const ssoOf = (salary) => (salary <= 0 ? 0 : Math.min(Math.max(salary, 1650), 15000) * 0.05);

export default function MyEarningsPage() {
  const auth = useSelector((s) => s.auth);
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api(`/earnings?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }, [from, to]);
  useEffect(load, [load]);

  // งวดเงินเดือนของฉัน (เดือนของช่วงที่เลือก) — สลิปเงินเดือน + สลิปโอน
  const period = from.slice(0, 7);
  const { data: payslip } = useGetMyPayslipQuery(period);
  const [showSlip, setShowSlip] = useState(false);

  const salary = auth.user?.salary || 0;
  const sso = ssoOf(salary);
  // ประมาณการรับสุทธิเดือนนี้ = เงินเดือน + ค่ามือ/คอมช่วงที่เลือก − สปส. (ก่อนภาษี/หักอื่น)
  const estNet = salary + (data?.total || 0) - sso;

  const byType = useMemo(() => {
    const m = {};
    for (const r of data?.rows || []) m[r.type] = (m[r.type] || 0) + r.amount;
    return m;
  }, [data]);

  return (
    <div className="app-content">
      <div className="container-fluid pt-3 earn-prem">
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0 prem-title">รายได้ของฉัน</h4>
          <span className="ms-auto d-flex gap-2 align-items-center">
            <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted">–</span>
            <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </span>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-2 mb-3">
          <div className="col-md-3 col-6"><InfoBox ico="bi-wallet2" label="เงินเดือนฐาน/เดือน" value={salary ? money(salary) : "—"} color="primary" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-magic" label="ค่ามือ/คอม (ช่วงที่เลือก)" value={money(data?.total || 0)} sub={`${data?.cases || 0} รายการ`} color="info" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-shield-plus" label="ประกันสังคม 5%" value={sso ? `−${money(sso)}` : "—"} color="warning" /></div>
          <div className="col-md-3 col-6"><InfoBox ico="bi-cash-stack" label="ประมาณรับสุทธิ" value={money(estNet)} sub="ก่อนภาษี/หักอื่น" color="success" /></div>
        </div>

        {/* งวดเงินเดือนของฉัน — การ์ดสลิปหรูเหมือนบัตร */}
        {payslip?.found && (
          <div className="earn-slip mb-3">
            <div className="d-flex align-items-center gap-3 flex-wrap position-relative">
              <span className="earn-slip-ico d-inline-flex align-items-center justify-content-center rounded-3">
                <i className="bi bi-receipt" />
              </span>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="earn-slip-label">งวดเงินเดือน</span>
                  <b className="earn-slip-period">{period}</b>
                  <span className={`earn-slip-chip ${payslip.status === "paid" ? "is-paid" : ""}`}>
                    <i className={`bi ${payslip.status === "paid" ? "bi-check2-circle" : "bi-hourglass-split"} me-1`} />
                    {payslip.status === "paid" ? `โอนแล้ว ${payslip.paid_at ? new Date(payslip.paid_at).toLocaleDateString("th-TH") : ""}` : "รอจ่าย"}
                  </span>
                </div>
                <div className="earn-slip-detail small">
                  เงินเดือน {money(payslip.row.salary)} + ค่ามือ/คอม {money(payslip.row.earnings)}
                  {payslip.row.additions > 0 && <> + เพิ่ม {money(payslip.row.additions)}</>}
                  {" "}− สปส. {money(payslip.row.sso)}
                  {payslip.row.tax > 0 && <> − ภาษี {money(payslip.row.tax)}</>}
                  {payslip.row.deduction > 0 && <> − หักอื่น {money(payslip.row.deduction)}</>}
                  {payslip.row.prorated_days != null && <span className="earn-slip-chip ms-1">เดือนแรก มาจริง {payslip.row.prorated_days} วัน</span>}
                </div>
              </div>
              <div className="ms-auto text-end">
                <div className="earn-slip-label">รับสุทธิ</div>
                <div className="d-flex align-items-center gap-2 justify-content-end">
                  <span className="earn-slip-net">{money(payslip.row.net)}<span className="earn-slip-baht">฿</span></span>
                  {payslip.row.slip && (
                    <button className="btn btn-light btn-sm fw-semibold" onClick={() => setShowSlip(true)}>
                      <i className="bi bi-receipt-cutoff me-1" />ดูสลิปโอน
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {showSlip && payslip?.row?.slip && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSlip(false); }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <b>สลิปโอนเงินเดือน · งวด {period}</b>
                  <button className="btn-close" onClick={() => setShowSlip(false)} />
                </div>
                <div className="modal-body text-center" style={{ maxHeight: "75vh", overflow: "auto" }}>
                  {payslip.row.slip.startsWith("data:application/pdf")
                    ? <iframe src={payslip.row.slip} title="slip" style={{ width: "100%", height: "65vh", border: 0 }} />
                    : <img src={payslip.row.slip} alt="slip" style={{ maxWidth: "100%" }} />}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="row g-3">
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-header py-2 d-flex align-items-center">
                <span className="fw-semibold"><i className="bi bi-list-check me-1 text-primary" />รายละเอียดค่ามือ/คอม</span>
                {data?.rows?.length > 0 && (
                  <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => exportCsv(`รายได้ของฉัน_${from}_${to}`, [
                    { label: "วันที่", value: (r) => fmtD(r.date) },
                    { label: "ชนิด", value: (r) => TYPE_TH[r.type]?.[0] || r.type },
                    { label: "อ้างอิง", value: (r) => r.ref?.opd_ID || r.ref?.customer_course_ID || "" },
                    { label: "จำนวน(บาท)", key: "amount" },
                  ], data.rows)}><i className="bi bi-download me-1" />CSV</button>
                )}
              </div>
              <div className="card-body p-0" style={{ maxHeight: "58vh", overflowY: "auto" }}>
                <table className="table table-sm table-hover mb-0">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th className="bg-body-tertiary">วันที่</th>
                      <th className="bg-body-tertiary">ชนิด</th>
                      <th className="bg-body-tertiary">อ้างอิง</th>
                      <th className="bg-body-tertiary text-end">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rows || []).map((r) => {
                      const [tl, tc] = TYPE_TH[r.type] || [r.type, "light"];
                      return (
                        <tr key={r.earning_ID}>
                          <td>{fmtD(r.date)}</td>
                          <td><span className={`badge text-bg-${tc}`}>{tl}</span></td>
                          <td className="text-muted small font-monospace">{r.ref?.opd_ID || r.ref?.customer_course_ID || "—"}</td>
                          <td className="text-end fw-semibold">{money(r.amount)}฿</td>
                        </tr>
                      );
                    })}
                    {!data?.rows?.length && (
                      <tr><td colSpan={4} className="text-center text-muted py-5 earn-empty">
                        <i className="bi bi-cash-coin d-block mb-2" />
                        ไม่มีรายการค่ามือ/คอมในช่วงนี้
                        <div className="small">ลองปรับช่วงวันที่จากมุมขวาบน</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header py-2 fw-semibold"><i className="bi bi-pie-chart me-1 text-primary" />แยกตามชนิด</div>
              <ul className="list-group list-group-flush">
                {Object.entries(byType).map(([k, v]) => {
                  const [tl, tc] = TYPE_TH[k] || [k, "light"];
                  return (
                    <li key={k} className="list-group-item d-flex align-items-center">
                      <span className={`badge text-bg-${tc} me-2`}>{tl}</span>
                      <b className="ms-auto">{money(v)}฿</b>
                    </li>
                  );
                })}
                {!Object.keys(byType).length && <li className="list-group-item text-muted small text-center py-3">ยังไม่มีข้อมูลในช่วงนี้</li>}
                <li className="list-group-item d-flex align-items-center bg-body-tertiary">
                  <b>รวมช่วงที่เลือก</b>
                  <b className="ms-auto text-primary">{money(data?.total || 0)}฿</b>
                </li>
              </ul>
              <div className="card-footer text-muted" style={{ fontSize: 11 }}>
                * ยอดจ่ายจริงดูจากสลิปเงินเดือนงวดเดือน (หักประกันสังคม/ภาษีตามจริง)
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .earn-prem { --earn-grad: linear-gradient(135deg, #1560a3, #2a7bc4); }
        .earn-prem .prem-title { letter-spacing: 0.01em; position: relative; padding-bottom: 7px; }
        .earn-prem .prem-title::after {
          content: ""; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px;
          border-radius: 2px; background: var(--earn-grad);
        }
        .earn-prem .card.shadow-sm { border-color: var(--bs-border-color); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06) !important; }
        .earn-prem .table { font-variant-numeric: tabular-nums; }
        .earn-prem thead th { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.02em; color: var(--bs-secondary-color); }
        .earn-prem .form-control:focus { border-color: #2a7bc4; box-shadow: 0 0 0 0.18rem rgba(21, 96, 163, 0.15); }
        .earn-prem .earn-empty i { font-size: 2.6rem; opacity: 0.35; }
        /* ── การ์ดสลิปงวดเดือน — หรูเหมือนบัตร ── */
        .earn-slip {
          position: relative; overflow: hidden; color: #fff;
          border-radius: 1.1rem; padding: 1.1rem 1.35rem;
          background: linear-gradient(135deg, #0e4a82 0%, #1560a3 48%, #2a7bc4 100%);
          box-shadow: 0 10px 28px rgba(21, 96, 163, 0.32);
        }
        .earn-slip::before, .earn-slip::after {
          content: ""; position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0));
        }
        .earn-slip::before { width: 260px; height: 260px; top: -140px; right: -60px; }
        .earn-slip::after { width: 180px; height: 180px; bottom: -110px; left: 22%; }
        .earn-slip-ico {
          width: 52px; height: 52px; font-size: 24px; flex: 0 0 auto;
          background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }
        .earn-slip-label { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; }
        .earn-slip-period { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
        .earn-slip-detail { opacity: 0.85; margin-top: 2px; }
        .earn-slip-chip {
          display: inline-flex; align-items: center; font-size: 0.72rem; font-weight: 600;
          padding: 0.14rem 0.6rem; border-radius: 999px;
          background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .earn-slip-chip.is-paid { background: rgba(38, 168, 108, 0.5); border-color: rgba(255, 255, 255, 0.35); }
        .earn-slip-net { font-size: 1.75rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .earn-slip-baht { font-size: 1rem; font-weight: 600; opacity: 0.85; margin-left: 2px; }
        .earn-slip .btn-light { transition: transform 0.15s ease; }
        .earn-slip .btn-light:active { transform: scale(0.96); }
      `}</style>
    </div>
  );
}
