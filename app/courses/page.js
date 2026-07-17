"use client";
// จัดการ course: ผูกสินค้า (โดสต่อครั้ง ตายตัว) + หัตถการ BT/หมอ + อายุ course
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money } from "@/components/ui";
import ImageInput from "@/components/ImageInput";

const EMPTY = {
  name: "", quantity_used: 5, validity_days: 365, price: 0,
  duration_minutes: 60, image: "", products: [], BT_procedures: [], doctor_procedures: [],
};

export default function CoursesPage() {
  const t = useT();
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("/courses").then(setRows).catch((e) => setError(e.message));
    api("/products").then((p) => setProducts(p.filter((x) => x.active)));
    api("/procedures").then(setProcedures);
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setError("");
    try {
      const body = {
        ...editing,
        quantity_used: +editing.quantity_used,
        validity_days: +editing.validity_days || 0,
        price: +editing.price,
        duration_minutes: +editing.duration_minutes || 60,
        products: editing.products.filter((p) => p.product_ID),
        BT_procedures: editing.BT_procedures.filter((p) => p.medical_procedure_ID),
        doctor_procedures: editing.doctor_procedures.filter((p) => p.medical_procedure_ID),
      };
      if (editing.course_ID)
        await api(`/courses/${editing.course_ID}`, { method: "PUT", body });
      else await api("/courses", { method: "POST", body });
      setEditing(null);
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (r) => {
    if (!confirm(t("confirm_delete"))) return;
    await api(`/courses/${r.course_ID}`, { method: "DELETE" });
    load();
  };

  const setArr = (key, i, field, value) =>
    setEditing((s) => {
      const arr = [...s[key]];
      arr[i] = { ...arr[i], [field]: value };
      return { ...s, [key]: arr };
    });

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="card">
        <h2>
          คอร์ส
          <button className="btn small gold" style={{ float: "right" }} onClick={() => setEditing({ ...EMPTY })}>
            + {t("add")}
          </button>
        </h2>
        <table className="tbl">
          <thead>
            <tr><th>ID</th><th>ชื่อ</th><th>ครั้ง</th><th>อายุ (วัน)</th><th>{t("price")}</th><th>สินค้า/ครั้ง</th><th>{t("actions")}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.course_ID} style={{ opacity: r.active === false ? 0.45 : 1 }}>
                <td>{r.course_ID}</td>
                <td><b>{r.name}</b>{r.is_promotion_course && <span className="badge red" style={{ marginLeft: 6 }}>โปร</span>}</td>
                <td>{r.quantity_used}</td>
                <td>{r.validity_days || "ไม่หมดอายุ"}</td>
                <td>{money(r.price)}฿</td>
                <td className="muted">
                  {(r.products || []).map((p) => `${p.product_ID}×${p.sub_unit_per_use}`).join(", ") || "-"}
                </td>
                <td>
                  <button className="btn small" onClick={() => setEditing(JSON.parse(JSON.stringify(r)))}>{t("edit")}</button>{" "}
                  {r.active !== false && <button className="btn small" onClick={() => remove(r)}>{t("delete")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card">
          <h2>{editing.course_ID ? `${t("edit")} ${editing.course_ID}` : t("add")}</h2>
          <div className="row">
            <div className="field"><label>ชื่อ course</label>
              <input value={editing.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} /></div>
            <div className="field"><label>จำนวนครั้ง</label>
              <input type="number" value={editing.quantity_used} onChange={(e) => setEditing((s) => ({ ...s, quantity_used: e.target.value }))} /></div>
            <div className="field"><label>อายุ (วัน, 0=ไม่หมดอายุ)</label>
              <input type="number" value={editing.validity_days} onChange={(e) => setEditing((s) => ({ ...s, validity_days: e.target.value }))} /></div>
            <div className="field"><label>{t("price")}</label>
              <input type="number" value={editing.price} onChange={(e) => setEditing((s) => ({ ...s, price: e.target.value }))} /></div>
            <div className="field"><label>เวลา/ครั้ง (นาที)</label>
              <input type="number" value={editing.duration_minutes} onChange={(e) => setEditing((s) => ({ ...s, duration_minutes: e.target.value }))} /></div>
          </div>

          <ImageInput
            label="รูปคอร์ส (โชว์ carousel หน้าร้าน)"
            value={editing.image}
            onChange={(v) => setEditing((s) => ({ ...s, image: v }))}
          />

          <h2 style={{ marginTop: 14 }}>สินค้าที่ใช้ต่อ 1 ครั้ง (โดสตายตัว)</h2>
          {editing.products.map((p, i) => (
            <div className="row" key={i} style={{ marginBottom: 6 }}>
              <div className="field">
                <label>สินค้า</label>
                <select value={p.product_ID} onChange={(e) => setArr("products", i, "product_ID", e.target.value)}>
                  <option value="">—</option>
                  {products.map((x) => <option key={x.product_ID} value={x.product_ID}>{x.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>จำนวนหน่วยย่อย/ครั้ง</label>
                <input type="number" value={p.sub_unit_per_use} onChange={(e) => setArr("products", i, "sub_unit_per_use", +e.target.value)} />
              </div>
              <button className="btn small" onClick={() => setEditing((s) => ({ ...s, products: s.products.filter((_, j) => j !== i) }))}>✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => setEditing((s) => ({ ...s, products: [...s.products, { product_ID: "", sub_unit_per_use: 1 }] }))}>
            + สินค้า
          </button>

          {["BT_procedures", "doctor_procedures"].map((key) => (
            <div key={key}>
              <h2 style={{ marginTop: 14 }}>
                {key === "BT_procedures" ? "ขั้น BT (ว่าง = ข้ามขั้น)" : "ขั้นหมอ (ว่าง = ข้ามขั้น)"}
              </h2>
              {editing[key].map((p, i) => (
                <div className="row" key={i} style={{ marginBottom: 6 }}>
                  <div className="field">
                    <label>หัตถการ</label>
                    <select value={p.medical_procedure_ID} onChange={(e) => setArr(key, i, "medical_procedure_ID", e.target.value)}>
                      <option value="">—</option>
                      {procedures
                        .filter((x) => x.type === (key === "BT_procedures" ? "BT" : "doctor"))
                        .map((x) => <option key={x.medical_procedure_ID} value={x.medical_procedure_ID}>{x.name} ({money(x.cost)}฿)</option>)}
                    </select>
                  </div>
                  <button className="btn small" onClick={() => setEditing((s) => ({ ...s, [key]: s[key].filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button className="btn small" onClick={() => setEditing((s) => ({ ...s, [key]: [...s[key], { medical_procedure_ID: "" }] }))}>
                + หัตถการ
              </button>
            </div>
          ))}

          <div style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={save}>{t("save")}</button>{" "}
            <button className="btn" onClick={() => setEditing(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
