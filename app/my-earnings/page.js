"use client";
// รายได้ของฉัน — หมอ/BT/sale เห็นเฉพาะของตัวเอง (บังคับที่ API)
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money, todayStr } from "@/components/ui";

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
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="field"><label>จาก</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>ถึง</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
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
                    <td>{r.date}</td>
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
