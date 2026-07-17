"use client";
// ตาราง + ฟอร์ม CRUD ทั่วไป — ใช้กับ products/procedures/courses/promotions/rooms/branches/users
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import ImageInput from "@/components/ImageInput";

// fields: [{ key, label, type: "text"|"number"|"select"|"date"|"checkbox"|"image", options, show(ตาราง), render }]
export default function CrudPage({ title, endpoint, idField, fields, transform }) {
  const t = useT();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // null=ปิดฟอร์ม, {}=เพิ่มใหม่, {..}=แก้ไข
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api(endpoint).then(setRows).catch((e) => setError(e.message));
  }, [endpoint]);
  useEffect(load, [load]);

  const save = async () => {
    setError("");
    try {
      const body = transform ? transform(editing) : editing;
      if (editing[idField]) {
        await api(`${endpoint}/${editing[idField]}`, { method: "PUT", body });
      } else {
        await api(endpoint, { method: "POST", body });
      }
      setEditing(null);
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (row) => {
    if (!confirm(t("confirm_delete"))) return;
    setError("");
    try {
      await api(`${endpoint}/${row[idField]}`, { method: "DELETE" });
      load();
    } catch (e) { setError(e.message); }
  };

  const visibleFields = fields.filter((f) => f.show !== false);

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="card">
        <h2>
          {title}
          <button className="btn small gold" style={{ float: "right" }} onClick={() => setEditing({})}>
            + {t("add")}
          </button>
        </h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              {visibleFields.map((f) => <th key={f.key}>{f.label}</th>)}
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[idField]} style={{ opacity: r.active === false ? 0.45 : 1 }}>
                <td>{r[idField]}</td>
                {visibleFields.map((f) => (
                  <td key={f.key}>
                    {f.render ? f.render(r[f.key], r) : String(r[f.key] ?? "-")}
                  </td>
                ))}
                <td>
                  <button className="btn small" onClick={() => setEditing({ ...r })}>{t("edit")}</button>{" "}
                  {r.active !== false && (
                    <button className="btn small" onClick={() => remove(r)}>{t("delete")}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card">
          <h2>{editing[idField] ? `${t("edit")} ${editing[idField]}` : t("add")}</h2>
          <div className="row" style={{ alignItems: "flex-start" }}>
            {fields.filter((f) => !f.readonly && f.type !== "image").map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                {f.type === "select" ? (
                  <select
                    value={editing[f.key] ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(typeof f.options === "function" ? f.options() : f.options).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!editing[f.key]}
                    onChange={(e) => setEditing((s) => ({ ...s, [f.key]: e.target.checked }))}
                  />
                ) : (
                  <input
                    type={f.type || "text"}
                    value={editing[f.key] ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({
                        ...s,
                        [f.key]: f.type === "number" ? e.target.value : e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {fields.filter((f) => !f.readonly && f.type === "image").map((f) => (
            <ImageInput
              key={f.key}
              label={f.label}
              value={editing[f.key]}
              onChange={(v) => setEditing((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={save}>{t("save")}</button>{" "}
            <button className="btn" onClick={() => setEditing(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
