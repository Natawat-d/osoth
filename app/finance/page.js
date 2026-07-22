"use client";
// รายรับรายจ่าย: สรุป + กราฟ + แยกสาขา + ปิดยอดสิ้นวัน + export + save PDF
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, todayStr, AsyncButton, ROLE_LABEL, METHOD_LABEL, fmtThaiDate } from "@/components/ui";
import { LineChart, DonutChart } from "@/components/Charts";
import { exportCsv } from "@/lib/exportCsv";

export default function FinancePage() {
  const auth = useSelector((s) => s.auth);
  const t = useT();
  const isSuper = auth.user?.role === "super_admin";
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [branch, setBranch] = useState(isSuper ? "all" : auth.branch_ID);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState({});
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const [exp, setExp] = useState({ category: "other", description: "", amount: "", date: todayStr() });

  useEffect(() => {
    api("/branches").then(setBranches).catch(() => {});
    api("/users?active=all").then((u) => setUsers(Object.fromEntries(u.map((x) => [x.user_ID, x.full_name])))).catch(() => {});
  }, []);

  const branchOf = () => (isSuper ? branch : auth.branch_ID);
  const load = useCallback(() => {
    const b = branchOf();
    api(`/finance/summary?branch_ID=${b}&from=${from}&to=${to}`).then(setData).catch(() => {});
    api(`/finance/reconcile?branch_ID=${b}&date=${to}`).then(setRecon).catch(() => setRecon(null));
  }, [isSuper, branch, auth.branch_ID, from, to]);
  useEffect(load, [load]);

  const addExpense = async () => {
    const b = isSuper && branch !== "all" ? branch : auth.branch_ID;
    await api("/expenses", { method: "POST", body: { ...exp, amount: +exp.amount, branch_ID: b } });
    setExp({ category: "other", description: "", amount: "", date: todayStr() });
    load();
  };

  const exportStaff = () => {
    exportCsv(`รายได้พนักงาน_${from}_${to}`, [
      { label: "พนักงาน", value: (s) => users[s.user_ID] || s.user_ID },
      { label: "role", value: (s) => ROLE_LABEL[s.role] || s.role },
      { label: "รายการ", key: "cases" }, { label: "รวม(บาท)", key: "total" },
    ], data.by_staff);
  };

  const branchName = branch === "all" ? "ทุกสาขา" : branches.find((b) => b.branch_ID === branch)?.name || branch;
  const series = (data?.series || []).map((d) => ({ ...d, expense_total: (d.cogs || 0) + (d.labor || 0) + (d.expense || 0) }));

  return (
    <div>
      <div className="print-head">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>โอสถ — รายงานการเงิน · {branchName}</h2>
        <div className="muted">ช่วง {fmtThaiDate(from)} ถึง {fmtThaiDate(to)}</div>
      </div>

      <div className="toolbar no-print">
        <div className="field" style={{ margin: 0 }}><label>จาก</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="date-hint">{fmtThaiDate(from)}</span></div>
        <div className="field" style={{ margin: 0 }}><label>ถึง</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="date-hint">{fmtThaiDate(to)}</span></div>
        {isSuper && (
          <div className="field" style={{ margin: 0 }}>
            <label>สาขา</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="all">รวมทุกสาขา</option>
              {branches.map((b) => <option key={b.branch_ID} value={b.branch_ID}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div className="grow" />
        <button className="btn gold" onClick={() => window.print()}>🖨️ บันทึก PDF</button>
      </div>

      {data && (
        <>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat accent-jade"><div className="num">{money(data.income)}฿</div><div className="lbl">{t("income")}</div></div>
            <div className="stat accent-red"><div className="num">-{money(data.cogs)}฿</div><div className="lbl">{t("cogs")}</div></div>
            <div className="stat accent-red"><div className="num">-{money(data.labor_cost)}฿</div><div className="lbl">{t("labor")}</div></div>
            <div className="stat accent-red"><div className="num">-{money(data.other_expense)}฿</div><div className="lbl">{t("expense")}</div></div>
            <div className="stat"><div className="num" style={{ color: data.net >= 0 ? "var(--jade)" : "var(--seal)" }}>{money(data.net)}฿</div><div className="lbl">{t("net")}</div></div>
          </div>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat"><div className="num">{data.cases_closed}</div><div className="lbl">เคสที่ปิด</div></div>
            <div className="stat"><div className="num">{data.courses_sold ?? 0}</div><div className="lbl">คอร์สที่ขาย</div></div>
            <div className="stat accent-red"><div className="num">{money(data.receivables)}฿</div><div className="lbl">{t("receivables")} ({data.debtor_count} ราย)</div></div>
          </div>

          <div className="charts-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <h2><span className="h2-ico">📈</span> แนวโน้มรายวัน</h2>
              <LineChart data={series} series={[
                { key: "income", label: "รายรับ", color: "#2f7d5b" },
                { key: "expense_total", label: "รายจ่ายรวม", color: "#a8455c" },
                { key: "net", label: "กำไร", color: "#a5842f" },
              ]} />
            </div>
            <div className="card">
              <h2><span className="h2-ico">🥧</span> ยอดขายแยกคอร์ส</h2>
              <DonutChart data={(data.sales_by_course || []).map((c) => ({ label: c.name, value: c.revenue }))} unit="฿" />
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <h2><span className="h2-ico">💳</span> รายรับแยกช่องทาง</h2>
              <DonutChart data={Object.entries(data.income_by_method || {}).map(([m, v]) => ({ label: METHOD_LABEL[m] || m, value: v }))} unit="฿" />
            </div>
            <div className="card">
              <h2><span className="h2-ico">🧾</span> รายรับแยกประเภท</h2>
              <DonutChart data={Object.entries(data.income_by_type || {}).map(([m, v]) => ({
                label: { course_purchase: "ซื้อคอร์ส", installment: "ชำระคอร์ส", add_on: "Add-on", deposit: "มัดจำ" }[m] || m, value: v,
              }))} unit="฿" />
            </div>
          </div>

          {/* ปิดยอดสิ้นวัน (GAP-04) */}
          {recon && (
            <div className="card">
              <h2><span className="h2-ico">🧮</span> ปิดยอดสิ้นวัน — {fmtThaiDate(recon.date)}</h2>
              <div className="stats" style={{ marginBottom: 12 }}>
                <div className="stat accent-jade"><div className="num">{money(recon.by_method.cash)}฿</div><div className="lbl">เงินสด (ควรมีในลิ้นชัก)</div></div>
                <div className="stat"><div className="num">{money(recon.by_method.transfer)}฿</div><div className="lbl">โอน</div></div>
                <div className="stat"><div className="num">{money(recon.by_method.card)}฿</div><div className="lbl">บัตร</div></div>
                <div className="stat accent-red"><div className="num">{money(recon.total)}฿</div><div className="lbl">รวมรับวันนี้ ({recon.payment_count} บิล)</div></div>
              </div>
              <div className="hint-box">
                <b>รายการค้าง (exception):</b>{" "}
                คอร์สค้างชำระ {recon.exceptions.debtor_count} ราย = {money(recon.exceptions.receivables_total)}฿ ·
                คิววันนี้ที่ยังไม่จบ {recon.exceptions.pending_reserves.length} คิว
                {recon.exceptions.pending_reserves.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {recon.exceptions.pending_reserves.map((p) => (
                      <span key={p.reserve_ID} className="badge orange" style={{ margin: "2px 4px 2px 0" }}>
                        {p.who} · {p.time} · {p.status}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <h2><span className="h2-ico">👥</span> รายได้พนักงาน — ทำไปกี่เคส
              <button className="btn small no-print" style={{ marginLeft: "auto" }} onClick={exportStaff}>⬇ ส่งออก CSV</button>
            </h2>
            <table className="tbl">
              <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>รายการ</th><th>{t("total")}</th></tr></thead>
              <tbody>
                {data.by_staff.length === 0 && <tr><td colSpan={4} className="muted">ไม่มีข้อมูล</td></tr>}
                {data.by_staff.map((s) => (
                  <tr key={s.user_ID}>
                    <td>{users[s.user_ID] || s.user_ID}</td>
                    <td><span className="badge gray nodot">{ROLE_LABEL[s.role] || s.role}</span></td>
                    <td>{s.cases}</td><td>{money(s.total)}฿</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="card no-print">
        <h2><span className="h2-ico">➕</span> บันทึกรายจ่ายอื่น</h2>
        <div className="row">
          <div className="field">
            <label>หมวด</label>
            <select value={exp.category} onChange={(e) => setExp((f) => ({ ...f, category: e.target.value }))}>
              <option value="rent">ค่าเช่า</option><option value="salary">เงินเดือน</option>
              <option value="utility">น้ำ/ไฟ</option><option value="other">อื่นๆ</option>
            </select>
          </div>
          <div className="field"><label>รายละเอียด</label>
            <input value={exp.description} onChange={(e) => setExp((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="field"><label>จำนวน</label>
            <input type="number" value={exp.amount} onChange={(e) => setExp((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div className="field"><label>{t("date")}</label>
            <input type="date" value={exp.date} onChange={(e) => setExp((f) => ({ ...f, date: e.target.value }))} /></div>
          <AsyncButton className="btn primary" disabled={!exp.amount} ok="บันทึกรายจ่ายแล้ว" onClick={addExpense}>{t("add")}</AsyncButton>
        </div>
      </div>
    </div>
  );
}
