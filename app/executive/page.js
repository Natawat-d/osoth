"use client";
// โมดูลผู้บริหาร — วิเคราะห์การเงินทุกสาขาในทีเดียว (super_admin เท่านั้น)
// รายรับ/ต้นทุน/ค่ามือ/คอม/กำไร · เปรียบเทียบสาขา · กราฟแนวโน้ม · ท็อปพนักงาน
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { money, todayStr } from "@/components/ui";
import { LineChart, DonutChart, CHART_PALETTE } from "@/components/Charts";

const METHOD_LABEL = { cash: "เงินสด", transfer: "โอน", card: "บัตร" };
const ROLE_LABEL = { doctor: "แพทย์", BT: "BT", sale: "ฝ่ายขาย", admin: "แอดมิน", acception: "ต้อนรับ", super_admin: "เจ้าของ" };

// แถบเปรียบเทียบแนวนอน
function Bars({ rows, valueKey, color = "#a8455c", fmt = money }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[valueKey] || 0)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const v = r[valueKey] || 0;
        const w = Math.max(2, (Math.abs(v) / max) * 100);
        const c = v < 0 ? "#a8455c" : color;
        return (
          <div key={r.branch_ID} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 150, fontSize: 13, flexShrink: 0 }}>{r.name}</div>
            <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden", height: 24 }}>
              <div style={{ width: `${w}%`, height: "100%", background: c, borderRadius: 5, transition: "width .3s" }} />
            </div>
            <div style={{ width: 110, textAlign: "right", fontWeight: 600, fontSize: 13, color: v < 0 ? "var(--seal)" : "var(--ink)" }}>{fmt(v)}฿</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExecutivePage() {
  const auth = useSelector((s) => s.auth);
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setErr("");
    api(`/executive/summary?from=${from}&to=${to}`).then(setData).catch((e) => setErr(e.message));
  }, [from, to]);
  useEffect(load, [load]);

  if (auth.user?.role !== "super_admin")
    return <div className="card"><div className="empty-state">เฉพาะผู้บริหาร (เจ้าของระบบ) เท่านั้น</div></div>;

  const t = data?.total;
  const branches = data?.branches || [];

  return (
    <div>
      <div className="card" style={{ background: "linear-gradient(100deg, var(--seal-tint), var(--surface))" }}>
        <h2 style={{ borderBottom: "none", marginBottom: 6 }}>
          <span className="h2-ico">👑</span> Dashboard ผู้บริหาร — ภาพรวมการเงินทุกสาขา
        </h2>
        <div className="toolbar" style={{ marginTop: 4 }}>
          <div className="field" style={{ margin: 0 }}><label>จาก</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>ถึง</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="grow" />
          <span className="badge gold nodot">🏢 {data?.branch_count ?? 0} สาขา</span>
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      {!data ? <div className="card"><div className="empty-state">กำลังโหลด…</div></div> : (
        <>
          {/* KPI รวมทุกสาขา */}
          <div className="stats" style={{ marginBottom: 14 }}>
            <div className="stat accent-jade"><div className="num">{money(t.income)}฿</div><div className="lbl">รายรับรวม</div></div>
            <div className="stat accent-red"><div className="num">-{money(t.cogs)}฿</div><div className="lbl">ต้นทุนสินค้า (COGS)</div></div>
            <div className="stat accent-red"><div className="num">-{money(t.fee)}฿</div><div className="lbl">ค่ามือหมอ/BT</div></div>
            <div className="stat accent-red"><div className="num">-{money(t.commission)}฿</div><div className="lbl">คอมมิชชั่น</div></div>
            <div className="stat accent-red"><div className="num">-{money(t.expense)}฿</div><div className="lbl">รายจ่ายอื่น</div></div>
            <div className="stat"><div className="num" style={{ color: t.net >= 0 ? "var(--jade)" : "var(--seal)" }}>{money(t.net)}฿</div><div className="lbl">กำไรสุทธิ</div></div>
          </div>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat"><div className="num">{t.cases}</div><div className="lbl">เคสที่ปิด (รวม)</div></div>
            <div className="stat"><div className="num">{t.courses_sold}</div><div className="lbl">คอร์สที่ขาย (รวม)</div></div>
            <div className="stat accent-red"><div className="num">{money(t.receivables)}฿</div><div className="lbl">คอร์สค้างชำระ</div></div>
            <div className="stat"><div className="num">{t.income > 0 ? Math.round((t.net / t.income) * 100) : 0}%</div><div className="lbl">อัตรากำไร (margin)</div></div>
          </div>

          {/* เปรียบเทียบรายรับ & กำไร รายสาขา */}
          <div className="charts-grid">
            <div className="card">
              <h2><span className="h2-ico">🏢</span> รายรับ แยกรายสาขา</h2>
              <Bars rows={branches} valueKey="income" color="#2f7d5b" />
            </div>
            <div className="card">
              <h2><span className="h2-ico">💰</span> กำไรสุทธิ แยกรายสาขา</h2>
              <Bars rows={branches} valueKey="net" color="#a5842f" />
            </div>
          </div>

          {/* ตารางเปรียบเทียบเต็ม */}
          <div className="card">
            <h2><span className="h2-ico">📊</span> ตารางเปรียบเทียบสาขา (แยก + รวม)</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr>
                  <th>สาขา</th><th>รายรับ</th><th>ต้นทุน</th><th>ค่ามือ</th><th>คอม</th><th>รายจ่าย</th><th>กำไรสุทธิ</th><th>margin</th><th>เคส</th><th>คอร์สขาย</th><th>ค้างชำระ</th>
                </tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.branch_ID}>
                      <td><b>{b.name}</b></td>
                      <td>{money(b.income)}</td>
                      <td className="muted">{money(b.cogs)}</td>
                      <td className="muted">{money(b.fee)}</td>
                      <td className="muted">{money(b.commission)}</td>
                      <td className="muted">{money(b.expense)}</td>
                      <td style={{ fontWeight: 700, color: b.net >= 0 ? "var(--jade)" : "var(--seal)" }}>{money(b.net)}</td>
                      <td>{b.income > 0 ? Math.round((b.net / b.income) * 100) : 0}%</td>
                      <td>{b.cases}</td>
                      <td>{b.courses_sold}</td>
                      <td className="muted">{money(b.receivables)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--seal-tint)", fontWeight: 700 }}>
                    <td>รวมทุกสาขา</td>
                    <td>{money(t.income)}</td><td>{money(t.cogs)}</td><td>{money(t.fee)}</td><td>{money(t.commission)}</td>
                    <td>{money(t.expense)}</td>
                    <td style={{ color: t.net >= 0 ? "var(--jade)" : "var(--seal)" }}>{money(t.net)}</td>
                    <td>{t.income > 0 ? Math.round((t.net / t.income) * 100) : 0}%</td>
                    <td>{t.cases}</td><td>{t.courses_sold}</td><td>{money(t.receivables)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* แนวโน้มรายวัน (รวม) */}
          <div className="card">
            <h2><span className="h2-ico">📈</span> แนวโน้มรายวัน (รวมทุกสาขา)</h2>
            <LineChart data={data.series} series={[
              { key: "income", label: "รายรับ", color: "#2f7d5b" },
              { key: "net", label: "กำไรสุทธิ", color: "#a5842f" },
              { key: "cogs", label: "ต้นทุน", color: "#a8455c" },
              { key: "labor", label: "ค่าแรง", color: "#34618f" },
            ]} height={260} />
          </div>

          {/* โดนัท: ช่องทาง + คอร์ส */}
          <div className="charts-grid">
            <div className="card">
              <h2><span className="h2-ico">💳</span> รายรับแยกช่องทาง (รวม)</h2>
              <DonutChart data={Object.entries(data.income_by_method || {}).map(([m, v]) => ({ label: METHOD_LABEL[m] || m, value: v }))} unit="฿" />
            </div>
            <div className="card">
              <h2><span className="h2-ico">🎴</span> ยอดขายแยกคอร์ส (รวม)</h2>
              <DonutChart data={(data.sales_by_course || []).slice(0, 8).map((c) => ({ label: c.name, value: c.revenue }))} unit="฿" />
            </div>
          </div>

          {/* ท็อปพนักงาน (ค่ามือ + คอม) */}
          <div className="card">
            <h2><span className="h2-ico">🏆</span> ท็อปพนักงาน — ค่ามือ + คอมมิชชั่น (ทุกสาขา)</h2>
            {data.top_staff.length === 0 ? <div className="muted">— ไม่มีข้อมูลในช่วงนี้ —</div> : (
              <table className="tbl">
                <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>สาขา</th><th>ค่ามือ</th><th>คอม</th><th>รวม</th></tr></thead>
                <tbody>
                  {data.top_staff.map((s, i) => (
                    <tr key={s.user_ID}>
                      <td><b>{i + 1}. {s.name}</b></td>
                      <td><span className="badge gray nodot">{ROLE_LABEL[s.role] || s.role}</span></td>
                      <td className="muted">{s.branch_ID}</td>
                      <td className="muted">{money(s.fee)}฿</td>
                      <td className="muted">{money(s.commission)}฿</td>
                      <td style={{ fontWeight: 700 }}>{money(s.total)}฿</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
