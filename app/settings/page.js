"use client";
// ตั้งค่า: สาขา / ห้อง (config ได้) / format HN
import { useEffect, useState } from "react";
import CrudPage from "@/components/CrudPage";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

export default function SettingsPage() {
  const [branches, setBranches] = useState([]);
  useEffect(() => { api("/branches").then(setBranches); }, []);
  const branchOptions = branches.map((b) => ({ value: b.branch_ID, label: b.name }));

  return (
    <div>
      <CrudPage
        title="สาขา"
        endpoint="/branches"
        idField="branch_ID"
        fields={[
          { key: "name", label: "ชื่อสาขา" },
          { key: "address", label: "ที่อยู่" },
          { key: "phone", label: "โทร" },
        ]}
      />
      <CrudPage
        title="ห้องทำหัตถการ (แกน x ของปฏิทิน)"
        endpoint="/rooms"
        idField="room_ID"
        transform={(s) => ({ ...s, order: +s.order || 1 })}
        fields={[
          { key: "name", label: "ชื่อห้อง" },
          { key: "branch_ID", label: "สาขา", type: "select", options: () => branchOptions },
          { key: "order", label: "ลำดับ", type: "number" },
          { key: "active", label: "เปิดใช้", type: "checkbox", render: (v) => (v === false ? "ปิด" : "เปิด") },
        ]}
      />
      <HnConfig />
    </div>
  );
}

function HnConfig() {
  const t = useT();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/config").then(setConfig).catch((e) => setError(e.message)); }, []);
  if (!config) return null;
  const hn = config.hn_format || {};

  const save = async () => {
    setError("");
    try {
      await api("/config", { method: "PUT", body: { hn_format: hn } });
      alert("บันทึกแล้ว ✓");
    } catch (e) { setError(e.message); }
  };
  const set = (k, v) => setConfig((c) => ({ ...c, hn_format: { ...c.hn_format, [k]: v } }));

  return (
    <div className="card">
      <h2>รูปแบบเลข HN (config ได้)</h2>
      {error && <div className="err">{error}</div>}
      <div className="row">
        <div className="field"><label>prefix</label>
          <input value={hn.prefix || "HN"} onChange={(e) => set("prefix", e.target.value)} /></div>
        <div className="field"><label>จำนวนหลักเลขรัน</label>
          <input type="number" value={hn.digits || 4} onChange={(e) => set("digits", +e.target.value)} /></div>
        <div className="field">
          <label>ใส่ปี พ.ศ.</label>
          <input type="checkbox" checked={!!hn.include_year} onChange={(e) => set("include_year", e.target.checked)} />
        </div>
        <div className="field">
          <label>รีเซ็ตเลขทุกปี</label>
          <input type="checkbox" checked={!!hn.reset_yearly} onChange={(e) => set("reset_yearly", e.target.checked)} />
        </div>
        <button className="btn primary" onClick={save}>{t("save")}</button>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        ตัวอย่าง: {[hn.prefix, hn.include_year ? new Date().getFullYear() + 543 : null, "1".padStart(hn.digits || 4, "0")].filter(Boolean).join("-")}
      </div>
    </div>
  );
}
