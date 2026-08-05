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
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">รายได้ของฉัน</h4>
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

        {/* งวดเงินเดือนของฉัน */}
        {payslip?.found && (
          <div className="card shadow-sm mb-3 border-success">
            <div className="card-body py-2 d-flex align-items-center gap-3 flex-wrap">
              <i className="bi bi-receipt fs-3 text-success" />
              <div>
                <b>งวดเงินเดือน {period}</b>
                <span className={`badge ms-2 ${payslip.status === "paid" ? "text-bg-success" : "text-bg-warning"}`}>
                  {payslip.status === "paid" ? `โอนแล้ว ${payslip.paid_at ? new Date(payslip.paid_at).toLocaleDateString("th-TH") : ""}` : "รอจ่าย"}
                </span>
                <div className="text-muted small">
                  เงินเดือน {money(payslip.row.salary)} + ค่ามือ/คอม {money(payslip.row.earnings)}
                  {payslip.row.additions > 0 && <> + เพิ่ม {money(payslip.row.additions)}</>}
                  {" "}− สปส. {money(payslip.row.sso)}
                  {payslip.row.tax > 0 && <> − ภาษี {money(payslip.row.tax)}</>}
                  {payslip.row.deduction > 0 && <> − หักอื่น {money(payslip.row.deduction)}</>}
                  {payslip.row.prorated_days != null && <span className="badge text-bg-warning ms-1">เดือนแรก มาจริง {payslip.row.prorated_days} วัน</span>}
                </div>
              </div>
              <div className="ms-auto d-flex align-items-center gap-2">
                <span className="fs-5 fw-bold text-success">รับสุทธิ {money(payslip.row.net)}฿</span>
                {payslip.row.slip && (
                  <button className="btn btn-outline-success btn-sm" onClick={() => setShowSlip(true)}>
                    <i className="bi bi-receipt-cutoff me-1" />ดูสลิปโอน
                  </button>
                )}
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
                      <tr><td colSpan={4} className="text-center text-muted py-5">
                        <i className="bi bi-cash-coin fs-3 d-block mb-1" />
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
    </div>
  );
}
