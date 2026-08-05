"use client";
// เงินเดือน (Payroll) มาตรฐาน — งวดรายเดือน:
// ฐานเงินเดือน + ค่ามือ/คอมของเดือน (อัตโนมัติ) + เพิ่มเติม − ประกันสังคม 5% (cap 750) − ภาษี − หักอื่น = สุทธิ
// จ่ายงวด → ลงบัญชีคู่อัตโนมัติ (เงินเดือน/สปส.นายจ้าง/เคลียร์ค่ามือค้างจ่าย/ภาษี-สปส.รอนำส่ง) + สลิปพิมพ์ได้
import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { useGetPayrollQuery, useSavePayrollMutation, useUploadPayrollSlipMutation, useGetSetupStateQuery } from "@/store/apiSlice";
import InfoBox from "@/components/InfoBox";

const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const thisPeriod = () => new Date().toISOString().slice(0, 7);
const ROLE_TH = { admin: "แอดมิน", sale: "ฝ่ายขาย", doctor: "แพทย์", BT: "BT" };

export default function PayrollTab() {
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const [period, setPeriod] = useState(thisPeriod());
  const { data, isFetching } = useGetPayrollQuery(period);
  const [savePayroll, { isLoading: saving }] = useSavePayrollMutation();
  const [uploadSlip] = useUploadPayrollSlipMutation();
  const [viewSlip, setViewSlip] = useState(null);
  const { data: setup } = useGetSetupStateQuery();
  const [edits, setEdits] = useState({}); // user_ID → {additions, tax, deduction, note}
  const [slip, setSlip] = useState(null); // แถวที่เปิดสลิป

  const paid = data?.status === "paid";
  const rows = useMemo(() => (data?.rows || []).map((r) => {
    const e = edits[r.user_ID] || {};
    const additions = e.additions !== undefined ? Number(e.additions) || 0 : r.additions;
    const tax = e.tax !== undefined ? Number(e.tax) || 0 : r.tax;
    const deduction = e.deduction !== undefined ? Number(e.deduction) || 0 : r.deduction;
    const sso = e.sso !== undefined && e.sso !== "" ? Number(e.sso) || 0 : r.sso; // แก้เลขสปส.เองได้
    return { ...r, additions, tax, deduction, sso, net: r.salary + r.earnings + additions - sso - tax - deduction };
  }), [data, edits]);

  const totals = useMemo(() => ({
    gross: rows.reduce((s, r) => s + r.salary + r.earnings + r.additions, 0),
    sso: rows.reduce((s, r) => s + r.sso, 0),
    net: rows.reduce((s, r) => s + r.net, 0),
    people: rows.length,
  }), [rows]);

  const setEdit = (uid, k, v) => setEdits((s) => ({ ...s, [uid]: { ...s[uid], [k]: v } }));

  async function submit(action) {
    if (action === "pay" && !confirm(`จ่ายเงินเดือนงวด ${period} รวมสุทธิ ${money(totals.net)} บาท?\n(ลงบัญชีอัตโนมัติ · แก้ไขงวดนี้ไม่ได้อีก)`)) return;
    try {
      await savePayroll({
        period, action, method: "transfer",
        rows: rows.map((r) => ({ user_ID: r.user_ID, additions: r.additions, tax: r.tax, deduction: r.deduction, sso: r.sso, note: r.note })),
      }).unwrap();
      setEdits({});
      toast.success(action === "pay" ? `จ่ายงวด ${period} แล้ว + ลงบัญชีเรียบร้อย` : "บันทึกงวด (draft) แล้ว");
    } catch (e) { toast.error(e.message); }
  }

  function attachSlip(row, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("สลิปใหญ่เกิน 3MB");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadSlip({ period, user_ID: row.user_ID, file: reader.result }).unwrap();
        toast.success(`แนบสลิปโอนของ ${row.full_name} แล้ว`);
      } catch (err) { toast.error(err.message); }
    };
    reader.readAsDataURL(file);
  }

  function printSlip(row) {
    setSlip(row);
    setTimeout(() => {
      document.body.classList.add("printing-payslip");
      window.print();
      document.body.classList.remove("printing-payslip");
    }, 150);
  }

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <input type="month" className="form-control form-control-sm" style={{ width: 160 }}
               value={period} onChange={(e) => { setPeriod(e.target.value); setEdits({}); }} />
        {paid
          ? <span className="badge text-bg-success">จ่ายแล้ว · {data?.paid_at ? new Date(data.paid_at).toLocaleDateString("th-TH") : ""}</span>
          : <span className="badge text-bg-warning">งวดร่าง (ยังไม่จ่าย)</span>}
        {isFetching && <span className="spinner-border spinner-border-sm text-primary" />}
        {!paid && (
          <span className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm" disabled={saving} onClick={() => submit("save")}>
              <i className="bi bi-save me-1" />บันทึกร่าง
            </button>
            <button className="btn btn-primary btn-sm" disabled={saving || !rows.length} onClick={() => submit("pay")}>
              {saving && <span className="spinner-border spinner-border-sm me-1" />}
              <i className="bi bi-cash-coin me-1" />จ่ายงวดนี้ + ลงบัญชี
            </button>
          </span>
        )}
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-3 col-6"><InfoBox ico="bi-people" label="พนักงาน" value={totals.people} color="primary" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-wallet2" label="รายได้รวม (gross)" value={money(totals.gross)} color="info" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-shield-plus" label="ประกันสังคม (ลูกจ้าง)" value={money(totals.sso)} color="warning" /></div>
        <div className="col-md-3 col-6"><InfoBox ico="bi-cash-stack" label="จ่ายสุทธิ" value={money(totals.net)} color="success" /></div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0 pay-scroll">
          <table className="table table-sm table-hover align-middle mb-0" style={{ minWidth: 900 }}>
            <thead className="table-light">
              <tr>
                <th>พนักงาน</th>
                <th className="text-end text-nowrap">เงินเดือน</th>
                <th className="text-end text-nowrap">ค่ามือ/คอม</th>
                <th className="text-end text-nowrap" style={{ width: 110 }}>OT/โบนัส</th>
                <th className="text-end text-nowrap" style={{ width: 100 }}>สปส. (แก้ได้)</th>
                <th className="text-end text-nowrap" style={{ width: 100 }}>ภาษี</th>
                <th className="text-end text-nowrap" style={{ width: 100 }}>หักอื่น</th>
                <th className="text-end text-nowrap">สุทธิ</th>
                <th style={{ width: 120 }}>สลิปโอน</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_ID}>
                  <td>
                    <div className="fw-semibold">{r.full_name}</div>
                    <small className="text-muted">{ROLE_TH[r.role] || r.role}</small>
                    {r.prorated_days !== null && r.prorated_days !== undefined && (
                      <div><span className="badge text-bg-warning" style={{ fontSize: 10 }}>เดือนแรก · มาจริง {r.prorated_days} วัน</span></div>
                    )}
                  </td>
                  <td className="text-end">{money(r.salary)}</td>
                  <td className="text-end">{r.earnings ? money(r.earnings) : <span className="text-muted">—</span>}</td>
                  <td>{paid ? <div className="text-end">{money(r.additions)}</div>
                    : <input type="number" className="form-control form-control-sm text-end" value={edits[r.user_ID]?.additions ?? r.additions} onChange={(e) => setEdit(r.user_ID, "additions", e.target.value)} />}</td>
                  <td>{paid ? <div className="text-end">−{money(r.sso)}</div>
                    : <input type="number" className="form-control form-control-sm text-end" value={edits[r.user_ID]?.sso ?? r.sso} onChange={(e) => setEdit(r.user_ID, "sso", e.target.value)} />}</td>
                  <td>{paid ? <div className="text-end">−{money(r.tax)}</div>
                    : <input type="number" className="form-control form-control-sm text-end" value={edits[r.user_ID]?.tax ?? r.tax} onChange={(e) => setEdit(r.user_ID, "tax", e.target.value)} />}</td>
                  <td>{paid ? <div className="text-end">−{money(r.deduction)}</div>
                    : <input type="number" className="form-control form-control-sm text-end" value={edits[r.user_ID]?.deduction ?? r.deduction} onChange={(e) => setEdit(r.user_ID, "deduction", e.target.value)} />}</td>
                  <td className="text-end fw-bold">{money(r.net)}</td>
                  <td>
                    {r.slip ? (
                      <span className="d-flex gap-1">
                        <button className="btn btn-outline-success btn-sm" title="ดูสลิปโอน" onClick={() => setViewSlip(r)}>
                          <i className="bi bi-receipt-cutoff me-1" />ดู
                        </button>
                        <label className="btn btn-outline-secondary btn-sm mb-0" title="เปลี่ยนสลิป">
                          <i className="bi bi-arrow-repeat" />
                          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => attachSlip(r, e)} />
                        </label>
                      </span>
                    ) : data?.saved ? (
                      <label className="btn btn-outline-primary btn-sm mb-0">
                        <i className="bi bi-upload me-1" />แนบ
                        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => attachSlip(r, e)} />
                      </label>
                    ) : <span className="text-muted small">บันทึกงวดก่อน</span>}
                  </td>
                  <td className="text-end pe-2">
                    <button className="btn btn-outline-secondary btn-sm" title="สลิปเงินเดือน" onClick={() => printSlip(r)}>
                      <i className="bi bi-receipt" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10} className="text-center text-muted py-4">— ไม่มีพนักงาน — เพิ่มที่แท็บ "พนักงาน" ก่อน</td></tr>}
            </tbody>
            <tfoot className="fw-bold">
              <tr>
                <td>รวม ({totals.people} คน)</td>
                <td className="text-end">{money(rows.reduce((s, r) => s + r.salary, 0))}</td>
                <td className="text-end">{money(rows.reduce((s, r) => s + r.earnings, 0))}</td>
                <td className="text-end">{money(rows.reduce((s, r) => s + r.additions, 0))}</td>
                <td className="text-end">−{money(totals.sso)}</td>
                <td className="text-end">−{money(rows.reduce((s, r) => s + r.tax, 0))}</td>
                <td className="text-end">−{money(rows.reduce((s, r) => s + r.deduction, 0))}</td>
                <td className="text-end">{money(totals.net)}</td>
                <td /><td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="card-footer text-muted" style={{ fontSize: 11 }}>
          มาตรฐาน: ประกันสังคมหัก 5% ของฐานเงินเดือน (ฐาน 1,650–15,000 → หัก 83–750 บาท) + นายจ้างสมทบเท่ากัน ·
          ค่ามือ/DF/คอม ดึงจากรายการของเดือนอัตโนมัติ · จ่ายงวด = ลงบัญชีคู่ (เงินเดือน · สปส.นายจ้าง · เคลียร์ค่าตอบแทนค้างจ่าย · สปส./ภาษีรอนำส่ง)
        </div>
      </div>

      {/* ดูสลิปโอน */}
      {viewSlip && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setViewSlip(null); }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <b>สลิปโอน — {viewSlip.full_name} · งวด {period}</b>
                <button className="btn-close" onClick={() => setViewSlip(null)} />
              </div>
              <div className="modal-body text-center" style={{ maxHeight: "75vh", overflow: "auto" }}>
                {viewSlip.slip?.startsWith("data:application/pdf")
                  ? <iframe src={viewSlip.slip} title="slip" style={{ width: "100%", height: "65vh", border: 0 }} />
                  : <img src={viewSlip.slip} alt="slip" style={{ maxWidth: "100%" }} />}
                {viewSlip.slip_at && <div className="text-muted small mt-2">แนบเมื่อ {new Date(viewSlip.slip_at).toLocaleString("th-TH")}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* สลิปเงินเดือน (พิมพ์เฉพาะส่วนนี้) */}
      {slip && (
        <div className="payslip-print card shadow-sm mt-3" style={{ maxWidth: 640 }}>
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-0">สลิปเงินเดือน (Pay Slip)</h5>
                <small className="text-muted">{setup?.company?.name || "บริษัท"} · งวด {period}</small>
              </div>
              <button className="btn btn-outline-secondary btn-sm ms-auto d-print-none" onClick={() => setSlip(null)}>ปิด</button>
            </div>
            <table className="table table-sm">
              <tbody>
                <tr><td>พนักงาน</td><td className="text-end fw-semibold">{slip.full_name} ({ROLE_TH[slip.role] || slip.role})</td></tr>
                <tr><td>เงินเดือน</td><td className="text-end">{money(slip.salary)}</td></tr>
                <tr><td>ค่ามือ / DF / คอมมิชชั่น</td><td className="text-end">{money(slip.earnings)}</td></tr>
                <tr><td>เพิ่มเติม (OT/โบนัส)</td><td className="text-end">{money(slip.additions)}</td></tr>
                <tr className="table-light"><td><b>รวมรายได้</b></td><td className="text-end fw-bold">{money(slip.salary + slip.earnings + slip.additions)}</td></tr>
                <tr><td>หัก ประกันสังคม (5%)</td><td className="text-end text-danger">−{money(slip.sso)}</td></tr>
                <tr><td>หัก ภาษี ณ ที่จ่าย</td><td className="text-end text-danger">−{money(slip.tax)}</td></tr>
                <tr><td>หัก อื่นๆ</td><td className="text-end text-danger">−{money(slip.deduction)}</td></tr>
                <tr className="table-success"><td><b>รับสุทธิ (Net Pay)</b></td><td className="text-end fw-bold fs-5">{money(slip.net)} บาท</td></tr>
              </tbody>
            </table>
            <div className="d-flex justify-content-between text-muted small mt-4">
              <span>ผู้จ่าย ______________________</span>
              <span>ผู้รับ ______________________</span>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .pay-scroll { max-height: 65vh; overflow: auto; }
        .pay-scroll table { font-variant-numeric: tabular-nums; }
        .pay-scroll thead th { position: sticky; top: 0; z-index: 3; background: var(--bs-tertiary-bg); color: var(--bs-body-color); box-shadow: inset 0 -1px 0 var(--bs-border-color); }
        .pay-scroll tfoot td { position: sticky; bottom: 0; z-index: 3; background: var(--bs-tertiary-bg); border-top: 2px solid var(--bs-border-color); }
      `}</style>
    </>
  );
}
