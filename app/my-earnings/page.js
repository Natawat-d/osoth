"use client";
// รายได้ของฉัน — หมอ/BT/sale เห็นเฉพาะของตัวเอง (บังคับที่ API)
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, todayStr, fmtThaiDate } from "@/components/ui";
import { exportCsv } from "@/lib/exportCsv";

export default function MyEarningsPage() {
  const t = useT();
  const first = todayStr().slice(0, 8) + "01";
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api(`/earnings?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }, [from, to]);
  useEffect(load, [load]);

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}><label>จาก</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="date-hint">{fmtThaiDate(from)}</span></div>
        <div className="field" style={{ margin: 0 }}><label>ถึง</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="date-hint">{fmtThaiDate(to)}</span></div>
        <div className="grow" />
        {data?.rows?.length > 0 && (
          <button className="btn small" onClick={() => exportCsv(`รายได้ของฉัน_${from}_${to}`, [
            { label: "วันที่", value: (r) => fmtThaiDate(r.date) },
            { label: "ชนิด", value: (r) => (r.type === "commission" ? "คอมมิชชั่น" : "ค่ามือ") },
            { label: "อ้างอิง", value: (r) => r.ref?.opd_ID || r.ref?.customer_course_ID || "" },
            { label: "จำนวน(บาท)", key: "amount" },
          ], data.rows)}>⬇ ส่งออก CSV</button>
        )}
      </div>
      {data && (
        <>
          <div className="stats" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="num">{money(data.total)}฿</div><div className="lbl">รายได้รวม</div></div>
            <div className="stat"><div className="num">{data.cases}</div><div className="lbl">จำนวนรายการ</div></div>
          </div>
          <div className="card">
            <h2>รายละเอียด</h2>
            <table className="tbl">
              <thead><tr><th>{t("date")}</th><th>ชนิด</th><th>อ้างอิง</th><th>จำนวน</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.earning_ID}>
                    <td>{fmtThaiDate(r.date)}</td>
                    <td>{r.type === "commission" ? "คอมมิชชั่น" : "ค่ามือ"}</td>
                    <td className="muted">{r.ref?.opd_ID || r.ref?.customer_course_ID}</td>
                    <td>{money(r.amount)}฿</td>
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
