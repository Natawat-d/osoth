"use client";
// แท็บใหม่ของหน้า Finance: ใบเสร็จรับเงิน + ปิดวัน/ปิดงวด/เคลียร์บัตร
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";

const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const METHOD_TH = { cash: "เงินสด", transfer: "โอน/QR", card: "บัตร", credit: "บัตร", promptpay: "โอน/QR" };
const methodTH = (m) => METHOD_TH[m] || m;

// ── ใบเสร็จ: รายการตามวัน + พิมพ์ + ยกเลิก (void) ──
export function ReceiptsTab() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api(`/receipts?date=${date}`).then((r) => { setRows(r); setErr(""); }).catch((e) => setErr(e.message));
  }, [date]);
  useEffect(load, [load]);
  const doVoid = async (r) => {
    const reason = prompt(`ยกเลิกใบเสร็จ ${r.receipt_no}?\nเงินทุกบรรทัดในใบจะถูกกลับรายการ + คอร์สกลับเป็นค้างชำระ\n\nเหตุผล:`);
    if (!reason || !reason.trim()) return;
    try {
      await api(`/receipts/${r.receipt_ID}/void`, { method: "POST", body: { reason } });
      load();
    } catch (e) { alert(e.message); }
  };
  const total = rows.filter((r) => r.status === "issued").reduce((s, r) => s + r.total, 0);
  return (
    <div className="card shadow-sm">
      <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold"><i className="bi bi-receipt me-1 text-primary" />ใบเสร็จรับเงิน</span>
        <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <span className={`badge ms-auto ${total > 0 ? "text-bg-success" : "bg-body-tertiary text-muted border"}`}>รวม {money(total)}฿ · {rows.length} ใบ</span>
      </div>
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        {err && <div className="alert alert-danger py-2 m-2">{err}</div>}
        <table className="table table-sm table-hover mb-0 fin-audit">
          <thead className="table-light">
            <tr><th>เลขที่</th><th>เวลา</th><th>ลูกค้า</th><th>รายการ</th><th className="text-end">ยอด</th><th>ช่องทาง</th><th>สถานะ</th><th style={{ width: 110 }} /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.receipt_ID} className={r.status === "voided" ? "table-danger opacity-75" : ""}>
                <td className="font-monospace small">{r.receipt_no}</td>
                <td className="small">{new Date(r.issued_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="small">{r.customer_name || r.HN_number || "—"}</td>
                <td className="small text-muted">{(r.items || []).map((i) => i.description).join(", ")}</td>
                <td className="text-end fw-semibold">{money(r.total)}</td>
                <td className="small">{(r.payments || []).map((p) => methodTH(p.method)).join(" + ")}</td>
                <td>{r.status === "voided" ? <span className="badge text-bg-danger">ยกเลิก</span> : <span className="badge text-bg-success">ใช้ได้</span>}</td>
                <td className="text-end pe-2">
                  <a className="btn btn-outline-secondary btn-sm me-1" href={`/app/receipt?id=${r.receipt_ID}`} target="_blank" rel="noreferrer" title="พิมพ์">
                    <i className="bi bi-printer" />
                  </a>
                  {r.status === "issued" && (
                    <button className="btn btn-outline-danger btn-sm" title="ยกเลิกใบเสร็จ (กลับรายการเงิน)" onClick={() => doVoid(r)}>
                      <i className="bi bi-x-circle" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-5 fin-empty">
                  <i className="bi bi-receipt d-block mb-2" />
                  <div className="fw-semibold">ไม่มีใบเสร็จของวันที่เลือก</div>
                  <div className="small">ใบเสร็จออกอัตโนมัติเมื่อรับเงิน (คอร์ส / add-on / มัดจำ) — ลองเลือกวันอื่นจากช่องด้านบน</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-footer text-muted" style={{ fontSize: 11 }}>
        * ใบเสร็จออกอัตโนมัติทุกครั้งที่รับเงิน (คอร์ส/add-on/มัดจำ) · ยกเลิก = เลขคงอยู่ + เงินถูกกลับรายการในบัญชี (ห้ามลบตามหลักบัญชี)
      </div>
    </div>
  );
}

// ── ปิดวัน/ปิดงวด: นับเงินสดจริง · เคลียร์เงินบัตรเข้าธนาคาร · ล็อกงวดบัญชี ──
export function ClosingTab() {
  const [date, setDate] = useState(today());
  const [dc, setDc] = useState(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [cs, setCs] = useState(null);
  const [settle, setSettle] = useState({ amount: "", fee: "" });
  const [lock, setLock] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    api(`/finance/daily-close?date=${date}`).then(setDc).catch(() => setDc(null));
    api("/finance/card-settlement").then(setCs).catch(() => setCs(null));
    api("/gl/period-lock").then((r) => setLock(r.locked_through || "")).catch(() => {});
  }, [date]);
  useEffect(load, [load]);
  const run = async (fn, okMsg) => {
    try { await fn(); setMsg(okMsg); load(); }
    catch (e) { setMsg("✗ " + e.message); }
  };
  return (
    <div className="row g-3">
      {msg && <div className="col-12"><div className={`alert py-2 mb-0 ${msg.startsWith("✗") ? "alert-danger" : "alert-success"}`}>{msg}</div></div>}
      <div className="col-12">
        <div className="close-guide d-flex align-items-center flex-wrap gap-2 small text-muted">
          <i className="bi bi-signpost-2 me-1" />ลำดับงาน:
          <span className="close-guide-chip"><b className="me-1">1</b>นับเงินสดทุกสิ้นวัน</span>
          <i className="bi bi-arrow-right-short" />
          <span className="close-guide-chip"><b className="me-1">2</b>เคลียร์เงินบัตรเมื่อธนาคารโอนเข้า</span>
          <i className="bi bi-arrow-right-short" />
          <span className="close-guide-chip"><b className="me-1">3</b>ล็อกงวดเมื่อปิดบัญชีสิ้นเดือน</span>
        </div>
      </div>

      {/* นับเงินสดสิ้นวัน */}
      <div className="col-lg-4">
        <div className="card shadow-sm h-100 close-step">
          <div className="card-header py-2 fw-semibold d-flex align-items-center">
            <span className="close-num me-2">1</span>
            <i className="bi bi-cash-coin me-1 text-primary" />ปิดยอดสิ้นวัน (นับเงินสดจริง)
          </div>
          <div className="card-body">
            <input type="date" className="form-control form-control-sm mb-2" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="close-kpi rounded-3 border px-3 py-2 mb-2">
              <div className="close-kpi-label text-muted">เงินสดที่ควรมีตามระบบ</div>
              <div className="close-kpi-value fw-bold lh-sm">{money(dc?.expected_cash || 0)} ฿</div>
            </div>
            {dc?.closed ? (
              <div className={`alert py-2 small ${dc.record.diff === 0 ? "alert-success" : "alert-warning"}`}>
                ปิดแล้ว · นับได้ {money(dc.record.counted_cash)}฿
                {dc.record.diff !== 0 && <> · {dc.record.diff > 0 ? "เกิน" : "ขาด"} {money(Math.abs(dc.record.diff))}฿ (ลงบัญชีแล้ว)</>}
              </div>
            ) : (
              <>
                <label className="form-label small mb-1">เงินสดนับได้จริง (บาท)</label>
                <input type="number" className="form-control form-control-sm mb-2" value={counted} onChange={(e) => setCounted(e.target.value)} />
                <input className="form-control form-control-sm mb-2" placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-primary btn-sm d-block ms-auto px-4" disabled={counted === ""}
                        onClick={() => run(() => api("/finance/daily-close", { method: "POST", body: { date, counted_cash: Number(counted), note } }),
                          "ปิดยอดวันสำเร็จ — ส่วนต่าง (ถ้ามี) ลงบัญชีแล้ว")}>
                  ปิดยอดวัน
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* เคลียร์เงินบัตร */}
      <div className="col-lg-4">
        <div className="card shadow-sm h-100 close-step">
          <div className="card-header py-2 fw-semibold d-flex align-items-center">
            <span className="close-num me-2">2</span>
            <i className="bi bi-credit-card me-1 text-primary" />เคลียร์เงินบัตรเข้าธนาคาร
          </div>
          <div className="card-body">
            <div className="close-kpi rounded-3 border px-3 py-2 mb-2">
              <div className="close-kpi-label text-muted">ยอดบัตรรอเคลียร์ (บัญชี 1020)</div>
              <div className="close-kpi-value fw-bold lh-sm text-warning-emphasis">{money(cs?.pending_1020 || 0)} ฿</div>
            </div>
            <label className="form-label small mb-1">ยอดที่เคลียร์ (เต็ม ก่อนหักค่าธรรมเนียม)</label>
            <input type="number" className="form-control form-control-sm mb-2" value={settle.amount} onChange={(e) => setSettle((s) => ({ ...s, amount: e.target.value }))} />
            <label className="form-label small mb-1">ค่าธรรมเนียมบัตร (MDR)</label>
            <input type="number" className="form-control form-control-sm mb-2" value={settle.fee} onChange={(e) => setSettle((s) => ({ ...s, fee: e.target.value }))} />
            <button className="btn btn-primary btn-sm d-block ms-auto px-4" disabled={!settle.amount}
                    onClick={() => run(() => api("/finance/card-settlement", { method: "POST", body: { amount: Number(settle.amount), fee: Number(settle.fee) || 0 } }),
                      "บันทึกเคลียร์เงินบัตรแล้ว")}>
              บันทึก
            </button>
            {(cs?.rows || []).slice(0, 4).map((r) => (
              <div className="small text-muted border-top pt-1 mt-1" key={r.settle_ID}>
                {r.date} · เคลียร์ {money(r.amount)}฿ − ค่าธรรมเนียม {money(r.fee)}฿ = เข้าธนาคาร {money(r.net)}฿
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ล็อกงวดบัญชี */}
      <div className="col-lg-4">
        <div className="card shadow-sm h-100 close-step">
          <div className="card-header py-2 fw-semibold d-flex align-items-center">
            <span className="close-num me-2">3</span>
            <i className="bi bi-lock me-1 text-primary" />ปิดงวดบัญชี (ล็อกย้อนหลัง)
          </div>
          <div className="card-body">
            <div className="small text-muted mb-2">
              เอกสารเงินที่ลงวันที่ ≤ วันที่ล็อก จะบันทึกใหม่ไม่ได้ (ค่าใช้จ่ายย้อนหลัง/JE มือ/จ่ายเงินเดือนงวดเก่า)
              — งบเดือนที่ปิดแล้วนิ่ง แก้ผิดให้กลับรายการในงวดปัจจุบันแทน
            </div>
            <div className="small mb-2">สถานะ: {lock ? <b className="text-danger">ล็อกถึง {lock}</b> : <span className="text-muted">ยังไม่ล็อก</span>}</div>
            <input type="date" className="form-control form-control-sm mb-2" value={lock} onChange={(e) => setLock(e.target.value)} />
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm"
                      onClick={() => run(() => api("/gl/period-lock", { method: "PUT", body: { locked_through: "" } }), "ปลดล็อกแล้ว")}>ปลดล็อก</button>
              <button className="btn btn-primary btn-sm px-4" disabled={!lock}
                      onClick={() => run(() => api("/gl/period-lock", { method: "PUT", body: { locked_through: lock } }), `ล็อกงวดถึง ${lock} แล้ว`)}>
                ล็อกงวด
              </button>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        /* การ์ดปิดวัน 3 ใบ — step หรู: แถบ gradient บน + เลข step วงกลม gradient + hover ยกนุ่ม */
        .close-guide-chip {
          display: inline-flex; align-items: center;
          background: var(--bs-tertiary-bg); border: 1px solid var(--bs-border-color);
          border-radius: 999px; padding: 0.18rem 0.7rem; color: var(--bs-body-color);
        }
        :global(.close-step) {
          position: relative; overflow: hidden; border-radius: 1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        :global(.close-step)::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #1560a3, #2a7bc4); z-index: 1;
        }
        :global(.close-step:hover) {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12) !important;
        }
        .close-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; flex: 0 0 auto; border-radius: 50%;
          background: linear-gradient(135deg, #1560a3, #2a7bc4); color: #fff;
          font-size: 0.78rem; font-weight: 700;
          box-shadow: 0 2px 7px rgba(21, 96, 163, 0.35);
        }
        .close-kpi { background: color-mix(in srgb, #1560a3 5%, var(--bs-tertiary-bg)); }
        .close-kpi-label { font-size: 11px; letter-spacing: 0.03em; }
        .close-kpi-value { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
