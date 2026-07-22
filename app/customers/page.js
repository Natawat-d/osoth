"use client";
// ลูกค้า (HN): ค้นหา → โปรไฟล์ + แก้ไข(แพ้ยา/โรค) + course ค้าง (จ่ายงวด) + ประวัติ + export
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, AsyncButton, useToast, fmtThaiDate } from "@/components/ui";
import { exportCsv } from "@/lib/exportCsv";

export default function CustomersPage() {
  const t = useT();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [profile, setProfile] = useState(null);
  const [pay, setPay] = useState({ customer_course_ID: "", amount: "", method: "cash" });
  const [editing, setEditing] = useState(null); // ฟอร์มแก้ไขลูกค้า (F-16)

  const open = useCallback(async (hn) => {
    setProfile(await api(`/customers/${hn}`));
    setEditing(null);
  }, []);

  // global search deep link (?hn=...) — เปิดโปรไฟล์อัตโนมัติ
  useEffect(() => {
    const hn = new URLSearchParams(window.location.search).get("hn");
    if (hn) open(hn);
  }, [open]);

  const search = async () => {
    setProfile(null);
    const r = await api(`/customers?q=${encodeURIComponent(q)}`);
    setRows(r);
    if (r.length === 0) toast.info("ไม่พบลูกค้า");
  };

  // ชำระค่าคอร์สเต็มจำนวน (ไม่มีผ่อน) — จ่ายยอดค้างทั้งหมดครั้งเดียว
  const payFull = async () => {
    const cc = profile.courses.find((c) => c.customer_course_ID === pay.customer_course_ID);
    if (!cc) return;
    await api(`/customer-courses/${pay.customer_course_ID}/pay`, {
      method: "POST", body: { amount: cc.balance_due, method: pay.method },
    });
    setPay({ customer_course_ID: "", method: "cash" });
    open(profile.customer.HN_number);
  };

  const startEdit = () => {
    const c = profile.customer;
    setEditing({
      full_name: c.full_name || "", sure_name: c.sure_name || "", nick_name: c.nick_name || "",
      phone: c.phone || "", birth_date: c.birth_date || "", gender: c.gender || "",
      drug_allergies: (c.drug_allergies || []).join(", "),
      chronic_diseases: (c.chronic_diseases || []).join(", "),
      note: c.note || "",
    });
  };
  const saveEdit = async () => {
    const body = {
      ...editing,
      drug_allergies: editing.drug_allergies ? editing.drug_allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
      chronic_diseases: editing.chronic_diseases ? editing.chronic_diseases.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    await api(`/customers/${profile.customer.HN_number}`, { method: "PUT", body });
    setEditing(null);
    open(profile.customer.HN_number);
  };

  const exportHistory = () => {
    exportCsv(`ประวัติ_${profile.customer.HN_number}`, [
      { label: "วันที่", value: (o) => fmtThaiDate(o.date) },
      { label: "เคส", key: "opd_ID" }, { label: "ครั้งที่", key: "session_no" },
      { label: "สถานะ", key: "status" },
      { label: "หัตถการ", value: (o) => (o.procedures_done || []).map((p) => p.name).join("; ") },
      { label: "add-on", value: (o) => (o.add_ons || []).map((a) => a.name).join("; ") },
    ], profile.history);
  };

  return (
    <div>
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
            <h2>
              {profile.customer.HN_number} — {profile.customer.full_name} {profile.customer.sure_name}
              {!editing && <button className="btn small" style={{ marginLeft: "auto" }} onClick={startEdit}>✎ แก้ไข</button>}
            </h2>
            {!editing ? (
              <div className="muted">
                เบอร์ {profile.customer.phone || "-"} ·{" "}
                <b style={{ color: profile.customer.drug_allergies?.length ? "var(--seal)" : "inherit" }}>
                  แพ้ยา: {profile.customer.drug_allergies?.join(", ") || "—"}
                </b>{" "}
                · โรคประจำตัว: {profile.customer.chronic_diseases?.join(", ") || "—"}
                {profile.customer.note && <> · {profile.customer.note}</>}
              </div>
            ) : (
              <div>
                <div className="row">
                  {[["full_name", "ชื่อ"], ["sure_name", "นามสกุล"], ["nick_name", "ชื่อเล่น"], ["phone", "เบอร์โทร"]].map(([k, lb]) => (
                    <div className="field" key={k}><label>{lb}</label>
                      <input value={editing[k]} onChange={(e) => setEditing((s) => ({ ...s, [k]: e.target.value }))} /></div>
                  ))}
                </div>
                <div className="field"><label>แพ้ยา (คั่นด้วย ,)</label>
                  <input value={editing.drug_allergies} onChange={(e) => setEditing((s) => ({ ...s, drug_allergies: e.target.value }))} placeholder="เช่น Penicillin, Aspirin" /></div>
                <div className="field"><label>โรคประจำตัว (คั่นด้วย ,)</label>
                  <input value={editing.chronic_diseases} onChange={(e) => setEditing((s) => ({ ...s, chronic_diseases: e.target.value }))} /></div>
                <div className="field"><label>หมายเหตุ</label>
                  <input value={editing.note} onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))} /></div>
                <div style={{ marginTop: 8 }}>
                  <AsyncButton className="btn primary" ok="บันทึกข้อมูลลูกค้าแล้ว" onClick={saveEdit}>{t("save")}</AsyncButton>{" "}
                  <button className="btn" onClick={() => setEditing(null)}>{t("cancel")}</button>
                </div>
              </div>
            )}
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
                    <td>{cc.expires_at ? fmtThaiDate(cc.expires_at) : "—"}</td>
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
                <label>ชำระค่าคอร์ส (เต็มจำนวน · ไม่มีผ่อน)</label>
                <select value={pay.customer_course_ID} onChange={(e) => setPay((p) => ({ ...p, customer_course_ID: e.target.value }))}>
                  <option value="">— เลือก course ที่ยังไม่ชำระ —</option>
                  {profile.courses.filter((c) => c.balance_due > 0).map((c) => (
                    <option key={c.customer_course_ID} value={c.customer_course_ID}>{c.course_snapshot?.name} (ค้าง {money(c.balance_due)}฿)</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>ช่องทาง</label>
                <select value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))}>
                  <option value="cash">เงินสด</option><option value="transfer">โอน</option><option value="card">บัตร</option>
                </select></div>
              <AsyncButton className="btn gold" disabled={!pay.customer_course_ID} ok="รับชำระเต็มจำนวนแล้ว" onClick={payFull}>
                ชำระเต็มจำนวน
              </AsyncButton>
            </div>
          </div>

          <div className="card">
            <h2>ประวัติหัตถการ
              <button className="btn small" style={{ marginLeft: "auto" }} onClick={exportHistory}>⬇ ส่งออก CSV</button>
            </h2>
            <table className="tbl">
              <thead><tr><th>{t("date")}</th><th>เคส</th><th>ครั้งที่</th><th>{t("status")}</th><th>หัตถการ</th><th>add-on</th></tr></thead>
              <tbody>
                {profile.history.map((o) => (
                  <tr key={o.opd_ID}>
                    <td>{fmtThaiDate(o.date)}</td>
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
