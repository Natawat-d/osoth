"use client";
// คอมมิชชั่น — รายงานคอม sale/หมอ ต่อเดือน + ตั้งค่า tier & ตาราง add-on (ต่อสาขา)
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { AsyncButton, useToast, money } from "@/components/ui";
import { useBranches } from "@/components/useBranches";
import { api } from "@/lib/client";

export default function CommissionPage() {
  const auth = useSelector((s) => s.auth);
  const branch_ID = auth.branch_ID;
  const { branchName } = useBranches();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [products, setProducts] = useState([]);
  const [setting, setSetting] = useState(null);

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/commission/report?branch_ID=${branch_ID}&month=${month}`).then(setReport);
    api(`/commission-settings?branch_ID=${branch_ID}`).then(setSetting);
    api(`/products?branch_ID=${branch_ID}`).then((p) => setProducts(p.filter((x) => x.active)));
  }, [branch_ID, month]);
  useEffect(load, [load]);

  if (!branch_ID) return <div className="card"><div className="empty-state">กำลังโหลด…</div></div>;

  const setTiers = (fn) => setSetting((s) => ({ ...s, sale_tiers: fn(s.sale_tiers || []) }));
  const setRates = (fn) => setSetting((s) => ({ ...s, addon_rates: fn(s.addon_rates || []) }));
  const save = async () => {
    await api(`/commission-settings`, { method: "PUT", body: { ...setting, branch_ID } });
    toast.success("บันทึกตั้งค่าคอมแล้ว");
    load();
  };

  return (
    <div>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}>
          <label>เดือน</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="grow" />
      </div>

      {/* รายงานคอม */}
      <div className="card">
        <h2><span className="h2-ico">📈</span> คอม sale · เดือน {month}</h2>
        <table className="tbl">
          <thead><tr><th>Sale</th><th>ยอดคอร์ส</th><th>+add-on แรก</th><th>ฐานยอด</th><th>ขั้น %</th><th>คอมขั้นบันได</th><th>คอม add-on</th><th>รวม</th></tr></thead>
          <tbody>
            {(report?.rows || []).map((r) => (
              <tr key={r.user_ID}>
                <td>{r.name}</td>
                <td>{money(r.course_sales)}฿</td>
                <td>{money(r.first_addon_bill)}฿</td>
                <td><b>{money(r.sales_base)}฿</b></td>
                <td>{r.tier_percent}%</td>
                <td>{money(r.tier_commission)}฿</td>
                <td>{money(r.addon_commission)}฿</td>
                <td><b>{money(r.total)}฿</b></td>
              </tr>
            ))}
            {!(report?.rows || []).length && <tr><td colSpan={8} className="muted">— ไม่มีข้อมูล —</td></tr>}
          </tbody>
        </table>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>โหมด tier: {report?.tier_mode === "marginal" ? "คิดเป็นชั้น (marginal)" : "ถึงขั้นไหนได้ทั้งยอด (whole)"}</div>
        {(report?.doctor_rows || []).length > 0 && (
          <>
            <h2 style={{ marginTop: 16 }}><span className="h2-ico">🩺</span> คอม add-on ของหมอ</h2>
            <table className="tbl">
              <thead><tr><th>หมอ</th><th>คอม add-on</th></tr></thead>
              <tbody>{report.doctor_rows.map((r) => <tr key={r.user_ID}><td>{r.name}</td><td>{money(r.addon_commission)}฿</td></tr>)}</tbody>
            </table>
          </>
        )}
      </div>

      {/* ตั้งค่า tier */}
      {setting && (
        <div className="card">
          <h2><span className="h2-ico">⚙️</span> ตั้งค่าขั้นบันไดคอม sale</h2>
          <div className="field" style={{ maxWidth: 300 }}>
            <label>วิธีคิด</label>
            <select value={setting.tier_mode} onChange={(e) => setSetting((s) => ({ ...s, tier_mode: e.target.value }))}>
              <option value="whole">ถึงขั้นไหน ได้ % ขั้นนั้นทั้งยอด (whole)</option>
              <option value="marginal">คิดเป็นชั้นๆ (marginal)</option>
            </select>
          </div>
          <table className="tbl">
            <thead><tr><th>ยอดขายตั้งแต่ (บาท)</th><th>คอม %</th><th></th></tr></thead>
            <tbody>
              {(setting.sale_tiers || []).map((t, i) => (
                <tr key={i}>
                  <td><input type="number" value={t.min_sales} onChange={(e) => setTiers((ts) => ts.map((x, j) => j === i ? { ...x, min_sales: e.target.value } : x))} /></td>
                  <td><input type="number" value={t.percent} onChange={(e) => setTiers((ts) => ts.map((x, j) => j === i ? { ...x, percent: e.target.value } : x))} /></td>
                  <td><button className="btn ghost small" onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn ghost small" onClick={() => setTiers((ts) => [...ts, { min_sales: 0, percent: 0 }])}>+ เพิ่มขั้น</button>

          <h2 style={{ marginTop: 16 }}><span className="h2-ico">🎁</span> ตารางคอม add-on (sale / หมอ)</h2>
          <table className="tbl">
            <thead><tr><th>สินค้า</th><th>Sale แบบ</th><th>Sale ค่า</th><th>หมอ แบบ</th><th>หมอ ค่า</th><th></th></tr></thead>
            <tbody>
              {(setting.addon_rates || []).map((r, i) => (
                <tr key={i}>
                  <td>
                    <select value={r.product_ID} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, product_ID: e.target.value } : x))}>
                      <option value="">—</option>
                      {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name}</option>)}
                    </select>
                  </td>
                  <td><select value={r.sale_type} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, sale_type: e.target.value } : x))}><option value="baht">บาท</option><option value="percent">%</option></select></td>
                  <td><input type="number" value={r.sale_value} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, sale_value: e.target.value } : x))} /></td>
                  <td><select value={r.doctor_type} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, doctor_type: e.target.value } : x))}><option value="baht">บาท</option><option value="percent">%</option></select></td>
                  <td><input type="number" value={r.doctor_value} onChange={(e) => setRates((rs) => rs.map((x, j) => j === i ? { ...x, doctor_value: e.target.value } : x))} /></td>
                  <td><button className="btn ghost small" onClick={() => setRates((rs) => rs.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn ghost small" onClick={() => setRates((rs) => [...rs, { product_ID: "", sale_type: "baht", sale_value: 0, doctor_type: "baht", doctor_value: 0 }])}>+ เพิ่มสินค้า</button>

          <div style={{ marginTop: 14 }}>
            <AsyncButton className="btn primary" ok="บันทึกแล้ว" onClick={save}>บันทึกตั้งค่าคอม</AsyncButton>
          </div>
        </div>
      )}
    </div>
  );
}
