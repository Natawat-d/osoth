"use client";
// จัดซื้อ/สั่งของ (GAP-05): แนะนำสินค้าต่ำกว่าจุดสั่งซื้อ → สร้างใบสั่งซื้อ (PO) → กดรับของเข้า
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { api } from "@/lib/client";
import { money, AsyncButton, fmtThaiDate } from "@/components/ui";
import { exportCsv } from "@/lib/exportCsv";

const PO_STATUS = { draft: "ร่าง", ordered: "สั่งแล้ว", received: "รับของแล้ว", cancelled: "ยกเลิก" };
const PO_CLS = { draft: "gray", ordered: "gold", received: "green", cancelled: "red" };

export default function PurchasingPage() {
  const branch_ID = useSelector((s) => s.auth.branch_ID);
  const [summary, setSummary] = useState([]);
  const [products, setProducts] = useState([]);
  const [pos, setPos] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([]); // { product_ID, qty, cost_price_per_unit }

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/stock/summary?branch_ID=${branch_ID}`).then(setSummary).catch(() => {});
    api(`/products`).then((p) => setProducts(p.filter((x) => x.active)));
    api(`/purchase-orders?branch_ID=${branch_ID}`).then(setPos).catch(() => {});
  }, [branch_ID]);
  useEffect(load, [load]);

  const low = summary.filter((s) => s.warnings?.some((w) => w.type === "low_stock"));
  const productName = (id) => products.find((p) => p.product_ID === id)?.name || id;

  const addItem = (product_ID) => {
    if (!product_ID || items.some((i) => i.product_ID === product_ID)) return;
    const p = products.find((x) => x.product_ID === product_ID);
    setItems((s) => [...s, { product_ID, qty: 1, cost_price_per_unit: 0, name: p?.name }]);
  };
  const setItem = (i, field, val) => setItems((s) => s.map((it, j) => (j === i ? { ...it, [field]: val } : it)));
  const removeItem = (i) => setItems((s) => s.filter((_, j) => j !== i));

  const createPO = async () => {
    await api("/purchase-orders", {
      method: "POST",
      body: {
        branch_ID, supplier, status: "ordered",
        items: items.map((it) => ({ product_ID: it.product_ID, name: productName(it.product_ID), qty: +it.qty, cost_price_per_unit: +it.cost_price_per_unit })),
      },
    });
    setItems([]); setSupplier("");
    load();
  };

  const receivePO = async (po_ID) => {
    await api(`/purchase-orders/${po_ID}/receive`, { method: "POST" });
    load();
  };

  return (
    <div>
      <div className="card">
        <h2><span className="h2-ico">⚠️</span> แนะนำสั่งซื้อ (ต่ำกว่าจุดสั่งซื้อ)</h2>
        {low.length === 0 && <div className="muted">— สต๊อกเพียงพอ ไม่มีรายการที่ต้องสั่ง —</div>}
        {low.map((s) => (
          <div key={s.product.product_ID} className="roster-item">
            <span className="roster-swatch" style={{ background: "var(--amber)" }} />
            <div style={{ flex: 1 }}>
              <div className="roster-name">{s.product.name}</div>
              <div className="roster-meta">เหลือ {s.unused + s.in_use} {s.product.unit} · จุดสั่งซื้อ {s.product.reorder_point}</div>
            </div>
            <button className="btn small" onClick={() => addItem(s.product.product_ID)}>+ เพิ่มลงใบสั่งซื้อ</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2><span className="h2-ico">🧾</span> สร้างใบสั่งซื้อ (PO)</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="field"><label>ผู้ขาย/supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
          <div className="field"><label>เพิ่มสินค้า</label>
            <select value="" onChange={(e) => addItem(e.target.value)}>
              <option value="">— เลือกสินค้า —</option>
              {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name}</option>)}
            </select></div>
        </div>
        {items.length > 0 && (
          <table className="tbl">
            <thead><tr><th>สินค้า</th><th>จำนวน (unit)</th><th>ทุน/หน่วย</th><th>รวม</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.product_ID}>
                  <td>{productName(it.product_ID)}</td>
                  <td><input type="number" min={1} value={it.qty} style={{ width: 80 }} onChange={(e) => setItem(i, "qty", e.target.value)} /></td>
                  <td><input type="number" value={it.cost_price_per_unit} style={{ width: 100 }} onChange={(e) => setItem(i, "cost_price_per_unit", e.target.value)} /></td>
                  <td>{money((+it.qty || 0) * (+it.cost_price_per_unit || 0))}฿</td>
                  <td><button className="btn small ghost" onClick={() => removeItem(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AsyncButton className="btn primary" style={{ marginTop: 10 }} disabled={items.length === 0} ok="สร้างใบสั่งซื้อแล้ว" onClick={createPO}>
          สร้างใบสั่งซื้อ
        </AsyncButton>
      </div>

      <div className="card">
        <h2><span className="h2-ico">📋</span> ใบสั่งซื้อ
          {pos.length > 0 && (
            <button className="btn small" style={{ marginLeft: "auto" }} onClick={() => exportCsv("ใบสั่งซื้อ", [
              { label: "PO", key: "po_ID" }, { label: "ผู้ขาย", key: "supplier" },
              { label: "รายการ", value: (p) => p.items.map((i) => `${i.name} x${i.qty}`).join("; ") },
              { label: "มูลค่า", value: (p) => p.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0) },
              { label: "สถานะ", value: (p) => PO_STATUS[p.status] },
            ], pos)}>⬇ ส่งออก CSV</button>
          )}
        </h2>
        <table className="tbl">
          <thead><tr><th>PO</th><th>ผู้ขาย</th><th>รายการ</th><th>มูลค่า</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {pos.length === 0 && <tr><td colSpan={6} className="muted">ยังไม่มีใบสั่งซื้อ</td></tr>}
            {pos.map((p) => (
              <tr key={p.po_ID}>
                <td>{p.po_ID}</td>
                <td>{p.supplier || "—"}</td>
                <td className="muted">{p.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
                <td>{money(p.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0))}฿</td>
                <td><span className={`badge ${PO_CLS[p.status]}`}>{PO_STATUS[p.status]}</span></td>
                <td>
                  {p.status === "ordered" && (
                    <AsyncButton className="btn small primary" ok="รับของเข้าคลังแล้ว" onClick={() => receivePO(p.po_ID)}>รับของเข้า</AsyncButton>
                  )}
                  {p.status === "received" && <span className="muted">{fmtThaiDate(String(p.received_at).slice(0, 10))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
