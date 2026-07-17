"use client";
// ลูกค้า (HN): ค้นหา → โปรไฟล์ + course ค้าง (จ่ายงวดได้) + ประวัติหัตถการ
import { useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money } from "@/components/ui";

export default function CustomersPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ customer_course_ID: "", amount: "", method: "cash" });

  const search = async () => {
    setError("");
    setProfile(null);
    setRows(await api(`/customers?q=${encodeURIComponent(q)}`));
  };

  const open = async (hn) => {
    setError("");
    setProfile(await api(`/customers/${hn}`));
  };

  const payInstallment = async () => {
    setError("");
    try {
      await api(`/customer-courses/${pay.customer_course_ID}/pay`, {
        method: "POST",
        body: { amount: +pay.amount, method: pay.method },
      });
      setPay({ customer_course_ID: "", amount: "", method: "cash" });
      open(profile.customer.HN_number);
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="card">
        <h2>{t("search")}ลูกค้า</h2>
        <div className="row">
          <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()} placeholder="HN / ชื่อ / เบอร์โทร" />
          <button className="btn primary" onClick={search}>{t("search")}</button>
        </div>
        {rows.length > 0 && (
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>HN</th><th>ชื่อ</th><th>เบอร์</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.HN_number}>
                  <td>{c.HN_number}</td>
                  <td>{c.full_name} ({c.nick_name})</td>
                  <td>{c.phone}</td>
                  <td><button className="btn small" onClick={() => open(c.HN_number)}>เปิด</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {profile && (
        <>
          <div className="card">
            <h2>{profile.customer.HN_number} — {profile.customer.full_name} {profile.customer.sure_name}</h2>
            <div className="muted">
              เบอร์ {profile.customer.phone || "-"} · แพ้ยา: {profile.customer.drug_allergies?.join(", ") || "—"} ·
              โรคประจำตัว: {profile.customer.chronic_diseases?.join(", ") || "—"}
            </div>
          </div>
          <div className="card">
            <h2>course ที่ถือ</h2>
            <table className="tbl">
              <thead><tr><th>ID</th><th>course</th><th>{t("remaining_uses")}</th><th>หมดอายุ</th><th>ชำระ</th><th>{t("status")}</th></tr></thead>
              <tbody>
                {profile.courses.map((cc) => (
                  <tr key={cc.customer_course_ID}>
                    <td>{cc.customer_course_ID}</td>
                    <td>{cc.course_snapshot?.name}</td>
                    <td>{cc.uses_remaining}/{cc.uses_total}</td>
                    <td>{cc.expires_at ? String(cc.expires_at).slice(0, 10) : "—"}</td>
                    <td>
                      {money(cc.paid_amount)}/{money(cc.total_price)}฿
                      {cc.balance_due > 0 && <span className="badge orange" style={{ marginLeft: 4 }}>ค้าง {money(cc.balance_due)}฿</span>}
                    </td>
                    <td><span className={`badge ${{ active: "green", completed: "blue", expired: "orange", cancelled: "gray" }[cc.status]}`}>{cc.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field">
                <label>{t("pay_installment")}</label>
                <select value={pay.customer_course_ID} onChange={(e) => setPay((p) => ({ ...p, customer_course_ID: e.target.value }))}>
                  <option value="">— เลือก course ที่ค้าง —</option>
                  {profile.courses.filter((c) => c.balance_due > 0).map((c) => (
                    <option key={c.customer_course_ID} value={c.customer_course_ID}>
                      {c.course_snapshot?.name} (ค้าง {money(c.balance_due)}฿)
                    </option>
                  ))}
                </select>
              </div>
              <div className="field"><label>จำนวน</label>
                <input type="number" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} /></div>
              <div className="field"><label>ช่องทาง</label>
                <select value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))}>
                  <option value="cash">เงินสด</option><option value="transfer">โอน</option><option value="card">บัตร</option>
                </select></div>
              <button className="btn gold" disabled={!pay.customer_course_ID || !pay.amount} onClick={payInstallment}>
                {t("pay_installment")}
              </button>
            </div>
          </div>
          <div className="card">
            <h2>ประวัติหัตถการ</h2>
            <table className="tbl">
              <thead><tr><th>{t("date")}</th><th>เคส</th><th>ครั้งที่</th><th>{t("status")}</th><th>หัตถการ</th><th>add-on</th></tr></thead>
              <tbody>
                {profile.history.map((o) => (
                  <tr key={o.opd_ID}>
                    <td>{o.date}</td>
                    <td>{o.opd_ID}</td>
                    <td>{o.session_no}</td>
                    <td><span className={`badge ${o.status === "closed" ? "green" : "gold"}`}>{o.status}</span></td>
                    <td className="muted">{o.procedures_done?.map((p) => p.name).join(", ") || "-"}</td>
                    <td className="muted">{o.add_ons?.map((a) => a.name).join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
