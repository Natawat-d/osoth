"use client";
// คลังสินค้า: สรุปต่อสินค้า + คำเตือน / รับของเข้า (lot → gen ขวดรายชิ้น) / ดูขวดรายชิ้น
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";
import { money } from "@/components/ui";

export default function StockPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const t = useT();
  const [summary, setSummary] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState(null); // ขวดรายชิ้นของ product ที่เลือก
  const [pickedProduct, setPickedProduct] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    product_ID: "", lot_number: "", supplier: "",
    cost_price_per_unit: "", quantity_received: 1, expiry_date: "",
  });

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/stock/summary?branch_ID=${branch_ID}`).then(setSummary).catch((e) => setError(e.message));
    api(`/products`).then((p) => setProducts(p.filter((x) => x.active)));
  }, [branch_ID]);
  useEffect(load, [load]);

  const receive = async () => {
    setError("");
    try {
      await api("/stock/receive", {
        method: "POST",
        body: {
          ...form,
          branch_ID,
          cost_price_per_unit: +form.cost_price_per_unit,
          quantity_received: +form.quantity_received,
        },
      });
      setForm({ product_ID: "", lot_number: "", supplier: "", cost_price_per_unit: "", quantity_received: 1, expiry_date: "" });
      load();
    } catch (e) { setError(e.message); }
  };

  const showItems = async (product_ID) => {
    setPickedProduct(product_ID);
    setItems(await api(`/stock/items?branch_ID=${branch_ID}&product_ID=${product_ID}`));
  };

  const discard = async (item_ID) => {
    if (!confirm("ยืนยันทิ้งขวดนี้?")) return;
    await api(`/stock/items/${item_ID}/discard`, { method: "POST" });
    showItems(pickedProduct);
    load();
  };

  return (
    <div>
      {error && <div className="err">{error}</div>}
      <div className="card">
        <h2>{t("receive_stock")}</h2>
        <div className="row">
          <div className="field">
            <label>สินค้า</label>
            <select value={form.product_ID} onChange={(e) => setForm((f) => ({ ...f, product_ID: e.target.value }))}>
              <option value="">—</option>
              {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name}</option>)}
            </select>
          </div>
          <div className="field"><label>เลข lot</label>
            <input value={form.lot_number} onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))} /></div>
          <div className="field"><label>supplier</label>
            <input value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} /></div>
          <div className="field"><label>ทุน/หน่วย (บาท)</label>
            <input type="number" value={form.cost_price_per_unit} onChange={(e) => setForm((f) => ({ ...f, cost_price_per_unit: e.target.value }))} /></div>
          <div className="field"><label>จำนวน (unit)</label>
            <input type="number" min={1} value={form.quantity_received} onChange={(e) => setForm((f) => ({ ...f, quantity_received: e.target.value }))} /></div>
          <div className="field"><label>หมดอายุ</label>
            <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} /></div>
          <button className="btn primary" disabled={!form.product_ID || !form.cost_price_per_unit} onClick={receive}>
            {t("receive_stock")}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>สรุปคลัง ({branch_ID})</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>สินค้า</th><th>{t("state_unused")}</th><th>{t("state_in_use")}</th>
              <th>รวม {`sub-unit`} เหลือ</th><th>รวมครั้งเหลือ</th><th>คำเตือน</th><th></th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.product.product_ID}>
                <td><b>{s.product.name}</b><div className="muted">{s.product.product_ID}</div></td>
                <td>{s.unused} {s.product.unit}</td>
                <td>{s.in_use} {s.product.unit}</td>
                <td>{s.total_cc_remaining} {s.product.sub_unit || "-"}</td>
                <td>{s.total_uses_remaining}</td>
                <td>
                  {s.warnings.map((w, i) => (
                    <span key={i} className={`badge ${w.type === "low_stock" ? "red" : "orange"}`} style={{ marginRight: 4 }}>
                      {t(`warn_${w.type}`)}
                    </span>
                  ))}
                </td>
                <td><button className="btn small" onClick={() => showItems(s.product.product_ID)}>ดูรายขวด</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items && (
        <div className="card">
          <h2>ขวดรายชิ้น — {pickedProduct}</h2>
          <table className="tbl">
            <thead>
              <tr><th>item</th><th>lot</th><th>{t("status")}</th><th>ครั้งเหลือ</th><th>ปริมาณเหลือ</th><th>เปิดเมื่อ</th><th>ควรใช้ก่อน</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.item_ID}>
                  <td>{it.item_ID}</td>
                  <td>{it.lot_ID}</td>
                  <td><span className={`badge ${{ unused: "gray", in_use: "gold", empty: "green", discarded: "red" }[it.state]}`}>{t(`state_${it.state}`)}</span></td>
                  <td>{it.uses_remaining}</td>
                  <td>{it.cc_remaining}</td>
                  <td>{it.opened_at ? String(it.opened_at).slice(0, 10) : "-"}</td>
                  <td>
                    {it.open_expiry_at ? (
                      <span className={new Date(it.open_expiry_at) < new Date() ? "badge orange" : ""}>
                        {String(it.open_expiry_at).slice(0, 10)}
                      </span>
                    ) : "-"}
                  </td>
                  <td>
                    {["unused", "in_use"].includes(it.state) && (
                      <button className="btn small" onClick={() => discard(it.item_ID)}>ทิ้ง</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
