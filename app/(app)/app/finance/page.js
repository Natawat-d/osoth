"use client";
// Finance (การเงิน/บัญชี) V2 — บัญชีคู่เต็ม: P&L / Trial balance / สมุดรายวัน / ผังบัญชี / AR / AP / Budget
// data ทั้งหมดผ่าน RTK Query — mutation invalidate → รายงานรีเฟรชเองทุกแท็บ
import { useState } from "react";
import { useSelector } from "react-redux";
import DailyFinance from "@/components/lgc/DailyFinance";
import CommissionReport from "@/components/lgc/CommissionReport";
import { ReceiptsTab, ClosingTab } from "@/components/FinanceClosingTabs";
import {
  useGetFinReportQuery, useGetJournalQuery, usePostJournalMutation,
  useGetGlAccountsQuery, useSaveGlAccountMutation,
  useGetSuppliersQuery, useSaveSupplierMutation,
  useGetApBillsQuery, useCreateApBillMutation, usePayApBillMutation,
  useGetBudgetsQuery, useSaveBudgetMutation,
} from "@/store/apiSlice";

const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const thisMonthFrom = () => new Date().toISOString().slice(0, 8) + "01";
const today = () => new Date().toISOString().slice(0, 10);

// จัดกลุ่มแท็บ 11 อันตามงานจริง — หาเจอเร็วกว่าเรียงแบนแถวเดียว
const TAB_GROUPS = [
  {
    label: "งานประจำวัน",
    tabs: [
      { key: "daily", label: "รายวัน/ปิดยอด", ico: "bi-calendar-day" },
      { key: "receipts", label: "ใบเสร็จ", ico: "bi-receipt" },
      { key: "closing", label: "ปิดวัน/ปิดงวด", ico: "bi-safe" },
    ],
  },
  {
    label: "รายงานบัญชี",
    tabs: [
      { key: "pnl", label: "งบกำไรขาดทุน", ico: "bi-graph-up" },
      { key: "tb", label: "งบทดลอง", ico: "bi-list-columns" },
      { key: "journal", label: "สมุดรายวัน", ico: "bi-journal-text" },
      { key: "coa", label: "ผังบัญชี (GL)", ico: "bi-diagram-3" },
    ],
  },
  {
    label: "หนี้สิน & วางแผน",
    tabs: [
      { key: "ar", label: "ลูกหนี้ (AR)", ico: "bi-person-down" },
      { key: "ap", label: "เจ้าหนี้ (AP)", ico: "bi-building-down" },
      { key: "budget", label: "งบประมาณ", ico: "bi-clipboard-data" },
      { key: "commission", label: "คอมมิชชั่น", ico: "bi-percent" },
    ],
  },
];

export default function FinanceV2Page() {
  const role = useSelector((s) => s.auth.user?.role);
  const [tab, setTab] = useState("daily");

  if (role && role !== "super_admin")
    return <div className="app-content"><div className="container-fluid pt-3"><div className="alert alert-warning">เฉพาะเจ้าของระบบ</div></div></div>;

  return (
    <div className="app-content">
      <div className="container-fluid pt-3 fin-wrap">
        <div className="d-flex align-items-center mb-3">
          <h4 className="mb-0 fw-bold prem-title">การเงิน / บัญชี</h4>
          <span className="text-muted ms-2 small">บัญชีคู่ (double-entry GL)</span>
        </div>

        <div className="card shadow-sm mb-3">
          <div className="card-body py-2 d-flex flex-wrap align-items-start column-gap-4 row-gap-2">
            {TAB_GROUPS.map((g) => (
              <div key={g.label} className="fin-tab-group">
                <div className="text-muted text-uppercase fw-semibold mb-1" style={{ fontSize: 10.5, letterSpacing: ".05em" }}>{g.label}</div>
                <div className="d-flex flex-wrap gap-1">
                  {g.tabs.map((t) => (
                    <button key={t.key} type="button"
                            className={`btn btn-sm d-inline-flex align-items-center text-nowrap ${tab === t.key ? "btn-primary" : "btn-link text-body text-decoration-none"}`}
                            onClick={() => setTab(t.key)}>
                      <i className={`bi ${t.ico} me-1 ${tab === t.key ? "" : "text-primary"}`} />{t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {tab === "daily" && <div className="lgc"><DailyFinance /></div>}
        {tab === "receipts" && <ReceiptsTab />}
        {tab === "closing" && <ClosingTab />}
        {tab === "commission" && <div className="lgc"><CommissionReport /></div>}
        {tab === "pnl" && <PnlTab />}
        {tab === "tb" && <TrialBalanceTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "coa" && <CoaTab />}
        {tab === "ar" && <ArTab />}
        {tab === "ap" && <ApTab />}
        {tab === "budget" && <BudgetTab />}
      </div>
      <style jsx global>{`
        .fin-wrap { --fin-grad: linear-gradient(135deg, #1560a3, #2a7bc4); }
        .fin-wrap table { font-variant-numeric: tabular-nums; }
        .fin-wrap .prem-title { letter-spacing: 0.01em; position: relative; padding-bottom: 7px; }
        .fin-wrap .prem-title::after {
          content: ""; position: absolute; left: 1px; bottom: 0; width: 46px; height: 3px;
          border-radius: 2px; background: var(--fin-grad);
        }
        .fin-wrap .btn-link.text-body:hover { background: var(--bs-tertiary-bg); border-radius: 999px; }
        /* กันหัวตารางขาวจ้าใน dark mode — ใช้สีพื้นตามธีมแทน */
        .fin-wrap .table-light {
          --bs-table-bg: var(--bs-tertiary-bg);
          --bs-table-color: var(--bs-body-color);
          --bs-table-border-color: var(--bs-border-color);
        }
        /* กล่องสถิติ legacy (.stat) พื้นขาว hardcode — เปลี่ยนเป็นพื้นตามธีมให้อ่านออกใน dark mode */
        .fin-wrap .stat {
          background: var(--bs-body-bg);
          border-color: var(--bs-border-color);
          box-shadow: 0 2px 7px rgba(0, 0, 0, 0.07);
        }
        /* เส้นคั่นกลุ่มแท็บ — กวาดตาหากลุ่มเจอเร็วขึ้น */
        .fin-tab-group + .fin-tab-group { border-left: 1px solid var(--bs-border-color); padding-left: 1.25rem; }
        @media (max-width: 767.98px) {
          .fin-tab-group + .fin-tab-group { border-left: 0; padding-left: 0; }
        }
        /* แท็บกลุ่ม — ปุ่ม pill ลื่นๆ + active gradient แบรนด์ */
        .fin-tab-group .btn { border-radius: 999px; transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease; }
        .fin-tab-group .btn-primary { background: var(--fin-grad); border-color: transparent; box-shadow: 0 4px 12px rgba(21, 96, 163, 0.3); }
        /* ปุ่ม primary นอกโซน .lgc — gradient แบรนด์เดียวกันทั้งหน้า */
        .fin-wrap .btn-primary:not(.lgc *) { background: var(--fin-grad); border-color: #1560a3; transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease; }
        .fin-wrap .btn-primary:not(.lgc *):hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 5px 14px rgba(21, 96, 163, 0.32); }
        .fin-wrap .btn-primary:not(.lgc *):active { transform: scale(0.97); }
        /* ตารางรายงานระดับ audit — หัวเล็ก letter-spacing, แถวสลับจางมาก, hover เนียน */
        .fin-wrap .fin-audit thead th { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em; color: var(--bs-secondary-color); }
        .fin-wrap .fin-audit tbody tr:nth-of-type(even):not([class*="table-"]) td {
          background-color: color-mix(in srgb, var(--bs-body-color) 2.5%, transparent);
        }
        .fin-wrap .fin-audit tbody td { padding-block: 0.45rem; }
        .fin-wrap .fin-audit tfoot td {
          border-top: 2px solid color-mix(in srgb, #1560a3 45%, var(--bs-border-color));
          background: var(--bs-tertiary-bg);
        }
        .fin-wrap .card.shadow-sm:not(.lgc *) { border-color: var(--bs-border-color); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 16px rgba(15, 23, 42, 0.06) !important; }
        .fin-wrap .form-control:not(.lgc *):focus, .fin-wrap .form-select:not(.lgc *):focus {
          border-color: #2a7bc4; box-shadow: 0 0 0 0.18rem rgba(21, 96, 163, 0.15);
        }
        .fin-wrap .fin-empty i { font-size: 2.6rem; opacity: 0.35; }
      `}</style>
    </div>
  );
}

// ── งบกำไรขาดทุน ──
function PnlTab() {
  const [from, setFrom] = useState(thisMonthFrom());
  const [to, setTo] = useState(today());
  const { data, isFetching } = useGetFinReportQuery({ kind: "pnl", qs: `?from=${from}&to=${to}` });

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold">งบกำไรขาดทุน</span>
        <div className="ms-auto d-flex gap-2 align-items-center">
          <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>–</span>
          <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          {isFetching && <div className="spinner-border spinner-border-sm text-primary" />}
        </div>
      </div>
      <div className="card-body">
        <h6 className="fw-bold text-success"><i className="bi bi-arrow-down-left-circle me-1" />รายได้</h6>
        <table className="table table-sm mb-3">
          <tbody>
            {(data?.revenue || []).map((r) => (
              <tr key={r.code}><td><span className="font-monospace text-muted small me-1">{r.code}</span>{r.name}</td><td className="text-end">{money(r.amount)}</td></tr>
            ))}
            {!data?.revenue?.length && <tr><td colSpan={2} className="text-muted small">— ไม่มีรายได้ในช่วงที่เลือก —</td></tr>}
            <tr className="table-success fw-bold"><td>รวมรายได้</td><td className="text-end">{money(data?.total_revenue)}</td></tr>
          </tbody>
        </table>
        <h6 className="fw-bold text-danger"><i className="bi bi-arrow-up-right-circle me-1" />ค่าใช้จ่าย</h6>
        <table className="table table-sm mb-3">
          <tbody>
            {!data?.expense_groups?.length && <tr><td colSpan={2} className="text-muted small">— ไม่มีค่าใช้จ่ายในช่วงที่เลือก —</td></tr>}
            {(data?.expense_groups || []).map((g) => (
              <tr key={g.group}>
                <td>
                  <b>{g.group || "อื่นๆ"}</b>
                  <div className="text-muted small">{g.accounts.map((a) => `${a.code} ${a.name} (${money(a.amount)})`).join(" · ")}</div>
                </td>
                <td className="text-end align-top">{money(g.amount)}</td>
              </tr>
            ))}
            <tr className="table-danger fw-bold"><td>รวมค่าใช้จ่าย</td><td className="text-end">{money(data?.total_expense)}</td></tr>
          </tbody>
        </table>
        <div className={`alert ${(data?.net_profit ?? 0) >= 0 ? "alert-success" : "alert-danger"} d-flex align-items-center mb-0`}>
          <i className={`bi ${(data?.net_profit ?? 0) >= 0 ? "bi-graph-up-arrow" : "bi-graph-down-arrow"} fs-3 me-3`} />
          <div>
            <div className="small">กำไร (ขาดทุน) สุทธิ ช่วงที่เลือก</div>
            <div className="fw-bold fs-4 lh-1">{money(data?.net_profit)} บาท</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── งบทดลอง ──
function TrialBalanceTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = from || to ? `?from=${from || "0000-01-01"}&to=${to || "9999-12-31"}` : "";
  const { data, isFetching } = useGetFinReportQuery({ kind: "trial-balance", qs });

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold">งบทดลอง (Trial Balance)</span>
        {data && (
          <span className={`badge ${data.balanced ? "text-bg-success" : "text-bg-danger"}`}>
            {data.balanced ? "✓ สมดุล" : "✗ ไม่สมดุล!"}
          </span>
        )}
        <div className="ms-auto d-flex gap-2 align-items-center">
          <span className="text-muted small text-nowrap">ช่วงวันที่</span>
          <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted">–</span>
          <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          {isFetching && <div className="spinner-border spinner-border-sm text-primary" />}
        </div>
      </div>
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 fin-audit">
          <thead className="table-light"><tr><th>รหัส</th><th>บัญชี</th><th>หมวด</th><th className="text-end">เดบิต</th><th className="text-end">เครดิต</th><th className="text-end">คงเหลือ</th></tr></thead>
          <tbody>
            {(data?.rows || []).filter((r) => r.debit || r.credit).map((r) => (
              <tr key={r.code}>
                <td className="font-monospace">{r.code}</td><td>{r.name}</td>
                <td><span className="badge bg-body-tertiary text-body-secondary border">{r.group}</span></td>
                <td className="text-end">{money(r.debit)}</td><td className="text-end">{money(r.credit)}</td>
                <td className="text-end fw-semibold">{money(r.balance)}</td>
              </tr>
            ))}
            {!(data?.rows || []).filter((r) => r.debit || r.credit).length && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-5 fin-empty">
                  <i className="bi bi-list-columns d-block mb-2" />
                  <div className="fw-semibold">ยังไม่มีการเคลื่อนไหวในบัญชี</div>
                  <div className="small">แสดงเฉพาะบัญชีที่มียอด — ลองปรับช่วงวันที่ หรือรอรายการอัตโนมัติจากธุรกรรม</div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="fw-bold table-group-divider">
            <tr><td colSpan={3}>รวม</td><td className="text-end">{money(data?.total?.debit)}</td><td className="text-end">{money(data?.total?.credit)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── สมุดรายวัน + บันทึก manual ──
function JournalTab() {
  const { data: jes = [] } = useGetJournalQuery();
  const { data: accounts = [] } = useGetGlAccountsQuery();
  const [postJournal, { isLoading }] = usePostJournalMutation();
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ date: today(), memo: "", lines: [{ account_code: "", debit: 0, credit: 0 }, { account_code: "", debit: 0, credit: 0 }] });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const setLine = (i, k, v) => setF((s) => ({ ...s, lines: s.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const dr = f.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = f.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  async function submit() {
    setErr(""); setMsg("");
    try {
      await postJournal({ date: f.date, memo: f.memo, lines: f.lines.map((l) => ({ account_code: l.account_code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) }).unwrap();
      setMsg("บันทึกรายการแล้ว");
      setF({ date: today(), memo: "", lines: [{ account_code: "", debit: 0, credit: 0 }, { account_code: "", debit: 0, credit: 0 }] });
      setShowForm(false);
      setTimeout(() => setMsg(""), 4000);
    } catch (e) { setErr(e.message); }
  }

  const SOURCE_TH = { manual: "มือ", payment: "รับเงิน", cogs: "ต้นทุนยา", earning: "ค่าตอบแทน", expense: "ค่าใช้จ่าย", stock_receive: "รับของ", ap_bill: "ตั้งหนี้", ap_payment: "จ่ายหนี้", stock_adjust: "ปรับสต๊อก" };

  return (
    <>
      {msg && <div className="alert alert-success py-2">{msg}</div>}
      <div className="card shadow-sm mb-3">
        <div className="card-header d-flex align-items-center">
          <span className="fw-semibold">สมุดรายวัน (300 รายการล่าสุด)</span>
          <button className="btn btn-primary btn-sm ms-auto" onClick={() => setShowForm((v) => !v)}>
            <i className="bi bi-plus-lg me-1" /> บันทึกรายการเอง
          </button>
        </div>
        {showForm && (
          <div className="card-body border-bottom bg-body-tertiary">
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <div className="row g-2 mb-2">
              <div className="col-md-3"><input type="date" className="form-control form-control-sm" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} /></div>
              <div className="col-md-9"><input className="form-control form-control-sm" placeholder="คำอธิบายรายการ (memo)" value={f.memo} onChange={(e) => setF((s) => ({ ...s, memo: e.target.value }))} /></div>
            </div>
            {f.lines.map((l, i) => (
              <div className="row g-2 mb-1" key={i}>
                <div className="col-md-6">
                  <select className="form-select form-select-sm" value={l.account_code} onChange={(e) => setLine(i, "account_code", e.target.value)}>
                    <option value="">— เลือกบัญชี —</option>
                    {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3"><input type="number" className="form-control form-control-sm" placeholder="เดบิต" value={l.debit || ""} onChange={(e) => setLine(i, "debit", e.target.value)} /></div>
                <div className="col-md-3"><input type="number" className="form-control form-control-sm" placeholder="เครดิต" value={l.credit || ""} onChange={(e) => setLine(i, "credit", e.target.value)} /></div>
              </div>
            ))}
            <div className="d-flex gap-2 align-items-center mt-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setF((s) => ({ ...s, lines: [...s.lines, { account_code: "", debit: 0, credit: 0 }] }))}>+ บรรทัด</button>
              <span className={`badge ${dr === cr && dr > 0 ? "text-bg-success" : "text-bg-warning"}`}>Dr {money(dr)} / Cr {money(cr)}</span>
              <button className="btn btn-primary btn-sm ms-auto" disabled={isLoading || dr !== cr || dr === 0} onClick={submit}>บันทึก</button>
            </div>
          </div>
        )}
        <div className="card-body p-0" style={{ overflowX: "auto" }}>
          <table className="table table-sm table-hover mb-0 fin-audit">
            <thead className="table-light"><tr><th>วันที่</th><th>เลขที่</th><th>รายการ</th><th>ที่มา</th><th className="text-end">ยอด</th></tr></thead>
            <tbody>
              {jes.map((je) => (
                <tr key={je.je_ID}>
                  <td className="text-nowrap">{je.date}</td>
                  <td className="font-monospace small">{je.je_ID}</td>
                  <td>
                    {je.memo}
                    <div className="text-muted small">
                      {je.lines.map((l, i) => (
                        <span key={i} className="me-2">{l.debit ? `Dr ${l.account_code} ${money(l.debit)}` : `Cr ${l.account_code} ${money(l.credit)}`}</span>
                      ))}
                    </div>
                  </td>
                  <td><span className="badge bg-body-tertiary text-body-secondary border">{SOURCE_TH[je.source_type] || je.source_type}</span></td>
                  <td className="text-end fw-semibold">{money(je.lines.reduce((s, l) => s + (l.debit || 0), 0))}</td>
                </tr>
              ))}
              {!jes.length && <tr><td colSpan={5} className="text-center text-muted py-4">— ยังไม่มีรายการ — รายการจะถูกสร้างอัตโนมัติเมื่อมีธุรกรรม (ขาย/จ่าย/รับของ)</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── ผังบัญชี ──
function CoaTab() {
  const { data: accounts = [] } = useGetGlAccountsQuery();
  const [saveGl, { isLoading }] = useSaveGlAccountMutation();
  const [f, setF] = useState({ code: "", name: "", type: "expense", group: "OPEX" });
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    try {
      await saveGl(f).unwrap();
      setF({ code: "", name: "", type: "expense", group: "OPEX" });
    } catch (e) { setErr(e.message); }
  }

  const TYPE_TH = { asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ทุน", revenue: "รายได้", expense: "ค่าใช้จ่าย" };

  return (
    <div className="row g-3">
      <div className="col-lg-8">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">ผังบัญชี (Chart of Accounts)</div>
          <div className="card-body p-0">
            <table className="table table-sm table-hover mb-0 fin-audit">
              <thead className="table-light"><tr><th>รหัส</th><th>ชื่อบัญชี</th><th>ประเภท</th><th>หมวด (GL group)</th></tr></thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="font-monospace">{a.code}</td>
                    <td>{a.name} {a.system && <i className="bi bi-lock-fill text-muted small" title="บัญชีระบบ" />}</td>
                    <td>{TYPE_TH[a.type]}</td>
                    <td><span className="badge bg-body-tertiary text-body-secondary border">{a.group}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">เพิ่ม/แก้บัญชี</div>
          <div className="card-body">
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <div className="mb-2"><label className="form-label small">รหัส (เช่น 6400)</label><input className="form-control form-control-sm" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
            <div className="mb-2"><label className="form-label small">ชื่อบัญชี</label><input className="form-control form-control-sm" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
            <div className="mb-2"><label className="form-label small">ประเภท</label>
              <select className="form-select form-select-sm" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
                {Object.entries(TYPE_TH).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="mb-3"><label className="form-label small">หมวด GL (CAPEX/PEC/OPEX/FREIGHT/…)</label>
              <select className="form-select form-select-sm" value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}>
                {["OPEX", "CAPEX", "PEC", "FREIGHT", "COGS", "LABOR", "REVENUE", "CASH", "AR", "AP", "INVENTORY", "EQUITY", "PAYABLE"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm d-block ms-auto px-4" disabled={isLoading || !f.code || !f.name} onClick={submit}>บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ลูกหนี้ (AR) ──
function ArTab() {
  const { data } = useGetFinReportQuery({ kind: "ar" });
  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex">
        <span className="fw-semibold">ลูกหนี้ — คอร์สค้างชำระ</span>
        <span className="ms-auto badge text-bg-warning fs-6">รวม {money(data?.total)} ฿</span>
      </div>
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 fin-audit">
          <thead className="table-light"><tr><th>HN</th><th>ลูกค้า</th><th>คอร์ส</th><th className="text-end">ราคา</th><th className="text-end">ค้างชำระ</th><th className="text-end">ค้างมา (วัน)</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.customer_course_ID}>
                <td className="font-monospace small">{r.HN_number}</td><td>{r.customer}</td><td>{r.course}</td>
                <td className="text-end">{money(r.total_price)}</td>
                <td className="text-end fw-bold text-danger">{money(r.balance_due)}</td>
                <td className="text-end">
                  <span className={`badge ${r.days > 30 ? "text-bg-danger" : r.days > 7 ? "text-bg-warning" : "bg-body-tertiary border text-body-secondary"}`}>{r.days} วัน</span>
                </td>
              </tr>
            ))}
            {!data?.rows?.length && <tr><td colSpan={6} className="text-center text-muted py-4">— ไม่มีลูกหนี้ค้างชำระ —</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── เจ้าหนี้ (AP): supplier + บิล + จ่าย ──
function ApTab() {
  const { data: bills = [] } = useGetApBillsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: accounts = [] } = useGetGlAccountsQuery();
  const [createBill] = useCreateApBillMutation();
  const [payBill] = usePayApBillMutation();
  const [saveSupplier] = useSaveSupplierMutation();
  const [f, setF] = useState({ supplier_ID: "", description: "", amount: "", bill_date: today(), due_date: "", expense_account: "1200" });
  const [sup, setSup] = useState({ name: "", phone: "", credit_days: 30 });
  const [err, setErr] = useState("");

  async function addBill() {
    setErr("");
    try {
      await createBill({ ...f, amount: Number(f.amount) }).unwrap();
      setF({ supplier_ID: "", description: "", amount: "", bill_date: today(), due_date: "", expense_account: "1200" });
    } catch (e) { setErr(e.message); }
  }
  async function addSupplier() {
    setErr("");
    try { await saveSupplier(sup).unwrap(); setSup({ name: "", phone: "", credit_days: 30 }); }
    catch (e) { setErr(e.message); }
  }
  async function pay(bill) {
    const outstanding = bill.amount - (bill.payments || []).reduce((s, p) => s + p.amount, 0);
    if (!confirm(`จ่ายบิล ${bill.bill_ID} จำนวน ${money(outstanding)} บาท (โอน)?`)) return;
    try { await payBill({ bill_ID: bill.bill_ID, method: "transfer" }).unwrap(); }
    catch (e) { setErr(e.message); }
  }

  const STATUS_TH = { unpaid: ["ยังไม่จ่าย", "text-bg-danger"], partial: ["จ่ายบางส่วน", "text-bg-warning"], paid: ["จ่ายแล้ว", "text-bg-success"] };

  return (
    <div className="row g-3">
      <div className="col-lg-8">
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">บิลเจ้าหนี้ (AP)</div>
          <div className="card-body p-0" style={{ overflowX: "auto" }}>
            <table className="table table-sm table-hover mb-0 align-middle fin-audit">
              <thead className="table-light"><tr><th>เลขที่</th><th>ผู้ขาย</th><th>รายการ</th><th>วันที่/ครบกำหนด</th><th className="text-end">ยอด</th><th className="text-end">ค้าง</th><th>สถานะ</th><th /></tr></thead>
              <tbody>
                {bills.map((b) => {
                  const paid = (b.payments || []).reduce((s, p) => s + p.amount, 0);
                  const [label, cls] = STATUS_TH[b.status] || [b.status, "bg-body-tertiary text-body-secondary border"];
                  return (
                    <tr key={b.bill_ID}>
                      <td className="font-monospace small">{b.bill_ID}{b.po_ID && <div className="text-muted">{b.po_ID}</div>}</td>
                      <td>{b.supplier_name || "-"}</td><td className="small">{b.description}</td>
                      <td className="small">{b.bill_date}{b.due_date && <div className="text-muted">ครบ {b.due_date}</div>}</td>
                      <td className="text-end">{money(b.amount)}</td>
                      <td className="text-end fw-semibold">{money(b.amount - paid)}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td className="text-end pe-2">
                        {b.status !== "paid" && (
                          <button className="btn btn-outline-primary btn-sm" onClick={() => pay(b)}>จ่าย</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!bills.length && <tr><td colSpan={8} className="text-center text-muted py-4">— ไม่มีบิล — บิลเกิดอัตโนมัติเมื่อรับของตาม PO หรือคีย์เองด้านขวา</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <div className="card shadow-sm mb-3">
          <div className="card-header fw-semibold">คีย์บิลเจ้าหนี้</div>
          <div className="card-body">
            <div className="mb-2">
              <select className="form-select form-select-sm" value={f.supplier_ID} onChange={(e) => setF((s) => ({ ...s, supplier_ID: e.target.value }))}>
                <option value="">— ผู้ขาย (ไม่บังคับ) —</option>
                {suppliers.map((s) => <option key={s.supplier_ID} value={s.supplier_ID}>{s.name}</option>)}
              </select>
            </div>
            <div className="mb-2"><input className="form-control form-control-sm" placeholder="รายการ เช่น ค่าขนส่ง" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
            <div className="row g-2 mb-2">
              <div className="col-6"><input type="number" className="form-control form-control-sm" placeholder="ยอดเงิน" value={f.amount} onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))} /></div>
              <div className="col-6">
                <select className="form-select form-select-sm" value={f.expense_account} onChange={(e) => setF((s) => ({ ...s, expense_account: e.target.value }))}>
                  {accounts.filter((a) => ["expense", "asset"].includes(a.type)).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6"><input type="date" className="form-control form-control-sm" value={f.bill_date} onChange={(e) => setF((s) => ({ ...s, bill_date: e.target.value }))} /></div>
              <div className="col-6"><input type="date" className="form-control form-control-sm" value={f.due_date} onChange={(e) => setF((s) => ({ ...s, due_date: e.target.value }))} /></div>
            </div>
            <button className="btn btn-primary btn-sm d-block ms-auto px-4" disabled={!(Number(f.amount) > 0)} onClick={addBill}>ตั้งหนี้ + ลงบัญชี</button>
          </div>
        </div>
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">เพิ่มผู้ขาย (Supplier)</div>
          <div className="card-body">
            <div className="mb-2"><input className="form-control form-control-sm" placeholder="ชื่อผู้ขาย" value={sup.name} onChange={(e) => setSup((s) => ({ ...s, name: e.target.value }))} /></div>
            <div className="row g-2 mb-2">
              <div className="col-7"><input className="form-control form-control-sm" placeholder="เบอร์" value={sup.phone} onChange={(e) => setSup((s) => ({ ...s, phone: e.target.value }))} /></div>
              <div className="col-5"><input type="number" className="form-control form-control-sm" placeholder="เครดิต(วัน)" value={sup.credit_days} onChange={(e) => setSup((s) => ({ ...s, credit_days: Number(e.target.value) }))} /></div>
            </div>
            <button className="btn btn-outline-primary btn-sm d-block ms-auto px-4" disabled={!sup.name} onClick={addSupplier}>เพิ่มผู้ขาย</button>
            <div className="text-muted small mt-2">{suppliers.length} ราย: {suppliers.map((s) => s.name).join(", ") || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── งบประมาณ ──
function BudgetTab() {
  const year = new Date().getFullYear();
  const { data: report } = useGetFinReportQuery({ kind: "budget-vs-actual", qs: `?year=${year}` });
  const { data: accounts = [] } = useGetGlAccountsQuery();
  const [saveBudget, { isLoading }] = useSaveBudgetMutation();
  const [f, setF] = useState({ account_code: "", amount: "" });

  // ตั้งงบแบบง่าย: ยอดต่อปี → หาร 12 เดือนเท่ากัน (แก้ละเอียดรายเดือนได้ภายหลัง)
  async function submit() {
    const perMonth = Math.round(((Number(f.amount) || 0) / 12) * 100) / 100;
    await saveBudget({ year, account_code: f.account_code, monthly: Array(12).fill(perMonth) }).unwrap().catch(() => {});
    setF({ account_code: "", amount: "" });
  }

  return (
    <div className="row g-3">
      <div className="col-lg-8">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">งบประมาณ vs ยอดจริง · ปี {year}</div>
          <div className="card-body p-0" style={{ overflowX: "auto" }}>
            <table className="table table-sm table-hover mb-0 fin-audit">
              <thead className="table-light"><tr><th>บัญชี</th><th className="text-end">งบทั้งปี</th><th className="text-end">ใช้จริง</th><th className="text-end">คงเหลือ/เกิน</th><th style={{ width: 160 }}>สัดส่วน</th></tr></thead>
              <tbody>
                {(report?.rows || []).map((r) => {
                  const pct = r.total_budget > 0 ? Math.min(100, Math.round((r.total_actual / r.total_budget) * 100)) : 0;
                  const over = r.total_actual > r.total_budget;
                  return (
                    <tr key={r.account_code}>
                      <td>{r.account_code} {r.account_name}</td>
                      <td className="text-end">{money(r.total_budget)}</td>
                      <td className="text-end">{money(r.total_actual)}</td>
                      <td className={`text-end fw-semibold ${over ? "text-danger" : "text-success"}`}>{money(r.variance)}</td>
                      <td>
                        <div className="progress" style={{ height: 16 }}>
                          <div className={`progress-bar ${over ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }}>{pct}%</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!report?.rows?.length && <tr><td colSpan={5} className="text-center text-muted py-4">— ยังไม่ได้ตั้งงบ — ตั้งจากฟอร์มด้านขวา</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">ตั้งงบ ปี {year}</div>
          <div className="card-body">
            <div className="mb-2">
              <select className="form-select form-select-sm" value={f.account_code} onChange={(e) => setF((s) => ({ ...s, account_code: e.target.value }))}>
                <option value="">— เลือกบัญชี —</option>
                {accounts.filter((a) => a.type === "expense" || a.type === "revenue").map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name} ({a.group})</option>)}
              </select>
            </div>
            <div className="mb-2"><input type="number" className="form-control form-control-sm" placeholder="งบทั้งปี (บาท)" value={f.amount} onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))} /></div>
            <button className="btn btn-primary btn-sm d-block ms-auto px-4" disabled={isLoading || !f.account_code || !f.amount} onClick={submit}>บันทึกงบ (เฉลี่ย 12 เดือน)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
