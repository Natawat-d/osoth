"use client";
// โมดูลผู้บริหาร — standalone (แยกจากแอปหลัก) · ดีไซน์สะอาดสไตล์ Beam Lighthouse · responsive
// วิเคราะห์การเงินทุกสาขา: รายรับ/กำไร/ต้นทุน/ค่ามือ/คอม · แยกช่องทาง · เปรียบเทียบสาขา · ท็อปพนักงาน
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { logout } from "@/store/authSlice";
import { api } from "@/lib/client";
import { money, todayStr } from "@/components/ui";
import { LineChart } from "@/components/Charts";

// จานสีสไตล์ Beam
const C = { green: "#5FC97F", navy: "#16224A", purple: "#8B82E8", yellow: "#F2C94C", blue: "#4E6EF2", red: "#E8613C", accent: "#3D5AF1" };
const METHOD = { cash: { label: "เงินสด", color: C.green }, transfer: { label: "โอน", color: C.navy }, card: { label: "บัตร/EDC", color: C.purple } };
const ROLE = { doctor: "แพทย์", BT: "BT", sale: "ฝ่ายขาย", admin: "แอดมิน", acception: "ต้อนรับ", super_admin: "เจ้าของ" };
const num = (n) => money(Math.round((n || 0) * 100) / 100);
const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${d} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][+m-1]} ${+y+543}`; };

function Donut({ items, size = 200 }) {
  const withVal = items.filter((d) => d.value > 0);
  const total = withVal.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="exec-empty">ไม่มีข้อมูล</div>;
  const R = size / 2, r = R * 0.62, cx = R, cy = R;
  // ช่องทางเดียว 100% → วาดวงแหวนเต็ม (arc เต็มวงจะ degenerate)
  if (withVal.length === 1)
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={withVal[0].color} strokeWidth={R - r} />
    </svg>;
  let acc = 0;
  const arc = (a0, a1) => {
    const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${big} 0 ${x3} ${y3}Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {withVal.map((d, i) => {
        const f = d.value / total, a0 = acc * 2 * Math.PI - Math.PI / 2; acc += f;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        return <path key={i} d={arc(a0, a1)} fill={d.color} />;
      })}
    </svg>
  );
}

export default function ExecutivePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [guard, setGuard] = useState(null); // "denied" | "login"

  const load = useCallback(() => {
    api(`/executive/summary?from=${from}&to=${to}`)
      .then((d) => { setData(d); setGuard(null); })
      .catch((e) => setGuard(e.status === 401 ? "login" : "denied"));
  }, [from, to]);
  useEffect(load, [load]);

  const quick = (days) => { const d = new Date(); const s = new Date(d.getTime() - days * 86400000); setFrom(s.toISOString().slice(0, 10)); setTo(todayStr()); };
  const thisMonth = () => { setFrom(first); setTo(todayStr()); };
  const goApp = () => router.push("/finance");
  const doLogout = async () => { try { await api("/auth/logout", { method: "POST" }); } catch {} dispatch(logout()); router.push("/"); };

  if (guard) return (
    <div className="exec-bg"><div className="exec-guard">
      <div className="exec-guard-ico">{guard === "login" ? "🔒" : "⛔"}</div>
      <h2>{guard === "login" ? "ยังไม่ได้เข้าสู่ระบบ" : "เฉพาะผู้บริหาร (เจ้าของระบบ)"}</h2>
      <p>{guard === "login" ? "กรุณาเข้าสู่ระบบผู้บริหารก่อน" : "บัญชีนี้ไม่มีสิทธิ์เข้าดู Dashboard ผู้บริหาร"}</p>
      <button className="exec-btn-primary" onClick={() => router.push("/")}>กลับหน้าแรก</button>
    </div></div>
  );

  const t = data?.total;
  const branches = data?.branches || [];
  const methodItems = Object.entries(data?.income_by_method || {}).map(([m, v]) => ({ key: m, label: METHOD[m]?.label || m, color: METHOD[m]?.color || C.blue, value: v }));
  const methodTotal = methodItems.reduce((s, d) => s + d.value, 0) || 1;
  const maxIncome = Math.max(1, ...branches.map((b) => b.income));
  const maxNet = Math.max(1, ...branches.map((b) => Math.abs(b.net)));

  return (
    <div className="exec-bg">
      {/* top bar */}
      <header className="exec-top">
        <button className="exec-icon-btn" onClick={goApp} title="กลับแอป">←</button>
        <div className="exec-brand"><b>โอสถ</b> ผู้บริหาร</div>
        <button className="exec-icon-btn" onClick={doLogout} title="ออกจากระบบ">⎋</button>
      </header>

      <main className="exec-wrap">
        <div className="exec-headrow">
          <h1>ภาพรวมผู้บริหาร</h1>
          <span className="exec-branchtag">🏢 {data?.branch_count ?? 0} สาขา</span>
        </div>

        {/* filter */}
        <div className="exec-filter">
          <div className="exec-chips">
            <button onClick={thisMonth}>เดือนนี้</button>
            <button onClick={() => quick(7)}>7 วัน</button>
            <button onClick={() => quick(30)}>30 วัน</button>
            <button onClick={() => quick(90)}>90 วัน</button>
          </div>
          <div className="exec-dates">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="exec-pill">ช่วง {fmtDate(from)} – {fmtDate(to)} · รวมทุกสาขา</div>

        {!data ? <div className="exec-empty" style={{ padding: 40 }}>กำลังโหลด…</div> : (
          <>
            {/* KPI ใหญ่ */}
            <div className="exec-kpis">
              <div className="exec-card">
                <div className="exec-card-lbl"><span>รายรับสำเร็จ</span><span className="exec-tx">{t.tx} รายการ</span></div>
                <div className="exec-card-num">{num(t.income)} <small>THB</small></div>
              </div>
              <div className="exec-card">
                <div className="exec-card-lbl"><span>กำไรสุทธิ ⓘ</span><span className="exec-tx">margin {t.income > 0 ? Math.round((t.net / t.income) * 100) : 0}%</span></div>
                <div className="exec-card-num" style={{ color: t.net >= 0 ? C.green : C.red }}>{num(t.net)} <small>THB</small></div>
              </div>
              <div className="exec-card">
                <div className="exec-card-lbl"><span>เฉลี่ยต่อรายการ</span></div>
                <div className="exec-card-num">{num(t.avg_tx)} <small>THB</small></div>
              </div>
              <div className="exec-card">
                <div className="exec-card-lbl"><span>คอร์สค้างชำระ</span><span className="exec-tx">{t.courses_sold} คอร์สที่ขาย</span></div>
                <div className="exec-card-num" style={{ color: C.red }}>{num(t.receivables)} <small>THB</small></div>
              </div>
            </div>

            {/* ต้นทุนแยก */}
            <div className="exec-mini">
              <div className="exec-minicard"><span>ต้นทุนสินค้า</span><b>{num(t.cogs)}</b></div>
              <div className="exec-minicard"><span>ค่ามือหมอ/BT</span><b>{num(t.fee)}</b></div>
              <div className="exec-minicard"><span>คอมมิชชั่น</span><b>{num(t.commission)}</b></div>
              <div className="exec-minicard"><span>รายจ่ายอื่น</span><b>{num(t.expense)}</b></div>
              <div className="exec-minicard"><span>เคสที่ปิด</span><b>{t.cases}</b></div>
            </div>

            {/* donut ช่องทาง + ตาราง */}
            <div className="exec-panel">
              <h3>รายรับแยกช่องทาง</h3>
              <div className="exec-donutwrap">
                <Donut items={methodItems} size={210} />
                <div className="exec-methodtable">
                  <div className="exec-methodhead"><span>ช่องทาง</span><span>ยอด (THB)</span><span>%</span></div>
                  {methodItems.length === 0 && <div className="exec-empty">ไม่มีรายรับ</div>}
                  {methodItems.sort((a, b) => b.value - a.value).map((m) => (
                    <div className="exec-methodrow" key={m.key}>
                      <span className="exec-mname"><i style={{ background: m.color }} /> {m.label}</span>
                      <span className="exec-mval">{num(m.value)}</span>
                      <span className="exec-mpct">{Math.round((m.value / methodTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* เปรียบเทียบสาขา */}
            <div className="exec-panel">
              <h3>เปรียบเทียบสาขา</h3>
              <div className="exec-bars">
                {branches.map((b) => (
                  <div className="exec-barrow" key={b.branch_ID}>
                    <div className="exec-bname">{b.name}</div>
                    <div className="exec-bartrack">
                      <div className="exec-barfill" style={{ width: `${Math.max(3, (b.income / maxIncome) * 100)}%`, background: C.green }} />
                    </div>
                    <div className="exec-bval">{num(b.income)}</div>
                    <div className="exec-bnet" style={{ color: b.net >= 0 ? C.green : C.red }}>กำไร {num(b.net)}</div>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table className="exec-tbl">
                  <thead><tr><th>สาขา</th><th>รายรับ</th><th>ต้นทุน</th><th>ค่ามือ</th><th>คอม</th><th>รายจ่าย</th><th>กำไรสุทธิ</th><th>margin</th><th>เคส</th></tr></thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr key={b.branch_ID}>
                        <td className="exec-b">{b.name}</td>
                        <td>{num(b.income)}</td><td className="exec-mut">{num(b.cogs)}</td><td className="exec-mut">{num(b.fee)}</td>
                        <td className="exec-mut">{num(b.commission)}</td><td className="exec-mut">{num(b.expense)}</td>
                        <td style={{ fontWeight: 700, color: b.net >= 0 ? C.green : C.red }}>{num(b.net)}</td>
                        <td>{b.income > 0 ? Math.round((b.net / b.income) * 100) : 0}%</td><td>{b.cases}</td>
                      </tr>
                    ))}
                    <tr className="exec-total">
                      <td>รวมทุกสาขา</td><td>{num(t.income)}</td><td>{num(t.cogs)}</td><td>{num(t.fee)}</td><td>{num(t.commission)}</td>
                      <td>{num(t.expense)}</td><td style={{ color: t.net >= 0 ? C.green : C.red }}>{num(t.net)}</td>
                      <td>{t.income > 0 ? Math.round((t.net / t.income) * 100) : 0}%</td><td>{t.cases}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* แนวโน้ม */}
            <div className="exec-panel">
              <h3>แนวโน้มรายวัน (รวมทุกสาขา)</h3>
              <LineChart data={data.series} series={[
                { key: "income", label: "รายรับ", color: C.green },
                { key: "net", label: "กำไรสุทธิ", color: C.accent },
                { key: "cogs", label: "ต้นทุน", color: C.red },
                { key: "labor", label: "ค่าแรง", color: C.navy },
              ]} height={260} />
            </div>

            {/* ท็อปพนักงาน */}
            <div className="exec-panel">
              <h3>ท็อปพนักงาน — ค่ามือ + คอมมิชชั่น</h3>
              {data.top_staff.length === 0 ? <div className="exec-empty">ไม่มีข้อมูล</div> : (
                <table className="exec-tbl">
                  <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>สาขา</th><th>ค่ามือ</th><th>คอม</th><th>รวม</th></tr></thead>
                  <tbody>
                    {data.top_staff.map((s, i) => (
                      <tr key={s.user_ID}>
                        <td className="exec-b">{i + 1}. {s.name}</td>
                        <td><span className="exec-tag">{ROLE[s.role] || s.role}</span></td>
                        <td className="exec-mut">{s.branch_ID}</td>
                        <td className="exec-mut">{num(s.fee)}</td><td className="exec-mut">{num(s.commission)}</td>
                        <td style={{ fontWeight: 700, color: C.accent }}>{num(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ height: 30 }} />
          </>
        )}
      </main>
    </div>
  );
}
