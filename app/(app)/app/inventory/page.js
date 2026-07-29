"use client";
// Inventory (คลังสินค้า) V2 — สรุปสต๊อก · สั่งซื้อ (PO) · รับเข้า · นับสต๊อก · รายงาน
// data ผ่าน RTK Query — รับของ/ปรับยอด → invalidate Stock/PO/Journal อัตโนมัติ
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  useGetStockSummaryQuery, useReceiveStockMutation, useAdjustStockMutation,
  useGetPOsQuery, useCreatePOMutation, useReceivePOMutation,
  useGetListQuery, useGetSuppliersQuery,
} from "@/store/apiSlice";

const money = (n) => Number(n || 0).toLocaleString("th-TH");

const TABS = [
  { key: "summary", label: "สรุปสต๊อก", ico: "bi-boxes" },
  { key: "po", label: "สั่งซื้อ (PO)", ico: "bi-cart-plus" },
  { key: "receive", label: "รับเข้า", ico: "bi-box-arrow-in-down" },
  { key: "count", label: "นับสต๊อก", ico: "bi-clipboard-check" },
  { key: "report", label: "รายงาน", ico: "bi-file-earmark-bar-graph" },
];

export default function InventoryPage() {
  const role = useSelector((s) => s.auth.user?.role);
  const [tab, setTab] = useState("summary");

  if (role && role !== "super_admin")
    return <div className="app-content"><div className="container-fluid pt-3"><div className="alert alert-warning">เฉพาะเจ้าของระบบ</div></div></div>;

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3">
          <h4 className="mb-0 fw-bold">คลังสินค้า (Inventory)</h4>
        </div>
        <ul className="nav nav-tabs mb-3">
          {TABS.map((t) => (
            <li className="nav-item" key={t.key}>
              <button className={`nav-link ${tab === t.key ? "active fw-semibold" : ""}`} onClick={() => setTab(t.key)}>
                <i className={`bi ${t.ico} me-1`} />{t.label}
              </button>
            </li>
          ))}
        </ul>

        {tab === "summary" && <SummaryTab />}
        {tab === "po" && <PoTab />}
        {tab === "receive" && <ReceiveTab />}
        {tab === "count" && <CountTab />}
        {tab === "report" && <ReportTab />}
      </div>
    </div>
  );
}

function warnBadge(w) {
  if (w.type === "low_stock") return <span className="badge text-bg-danger me-1">ต่ำกว่าจุดสั่งซื้อ</span>;
  if (w.type === "lot_expiry") return <span className="badge text-bg-warning me-1">ใกล้หมดอายุ {w.expiry_date}</span>;
  if (w.type === "open_expired") return <span className="badge text-bg-secondary me-1">เปิดใช้เกินกำหนด</span>;
  return null;
}

// ── สรุปสต๊อก ──
function SummaryTab() {
  const { data: rows = [], isFetching } = useGetStockSummaryQuery();
  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center">
        <span className="fw-semibold">สต๊อกคงเหลือต่อสินค้า</span>
        {isFetching && <div className="spinner-border spinner-border-sm text-primary ms-2" />}
      </div>
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light"><tr><th>สินค้า</th><th className="text-end">ยังไม่เปิด</th><th className="text-end">กำลังใช้</th><th className="text-end">cc คงเหลือ</th><th>คำเตือน</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.product_ID}>
                <td><b>{r.product.name}</b> <span className="text-muted small">{r.product.product_ID}</span></td>
                <td className="text-end">{r.unused}</td>
                <td className="text-end">{r.in_use}</td>
                <td className="text-end">{money(r.total_cc_remaining)}</td>
                <td>{[...new Map(r.warnings.map((w) => [w.type, w])).values()].map((w, i) => <span key={i}>{warnBadge(w)}</span>)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-center text-muted py-4">— ยังไม่มีสินค้า — เพิ่มสินค้าที่ Setup แล้วรับของเข้า</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── สั่งซื้อ (PO) ──
function PoTab() {
  const { data: pos = [] } = useGetPOsQuery();
  const { data: products = [] } = useGetListQuery({ res: "products", tag: "Products" });
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: stock = [] } = useGetStockSummaryQuery();
  const [createPO] = useCreatePOMutation();
  const [receivePO] = useReceivePOMutation();
  const [items, setItems] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [err, setErr] = useState("");

  // สินค้าต่ำกว่าจุดสั่งซื้อ → แนะนำใส่ PO
  const low = stock.filter((r) => r.warnings.some((w) => w.type === "low_stock"));

  const addItem = (p) => setItems((s) => [...s, { product_ID: p.product_ID, name: p.name, qty: 1, cost_price_per_unit: 0 }]);
  const setItem = (i, k, v) => setItems((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function submit() {
    setErr("");
    try {
      await createPO({
        supplier,
        items: items.map((i) => ({ ...i, qty: Number(i.qty) || 1, cost_price_per_unit: Number(i.cost_price_per_unit) || 0 })),
        status: "ordered",
      }).unwrap();
      setItems([]); setSupplier("");
    } catch (e) { setErr(e.message); }
  }
  async function receive(po) {
    if (!confirm(`รับของตาม ${po.po_ID} ทั้งใบ? (สร้าง lot + ตั้งหนี้ AP)`)) return;
    try { await receivePO(po.po_ID).unwrap(); } catch (e) { setErr(e.message); }
  }

  const STATUS_TH = { draft: ["ร่าง", "text-bg-light"], ordered: ["สั่งแล้ว", "text-bg-info"], received: ["รับแล้ว", "text-bg-success"], cancelled: ["ยกเลิก", "text-bg-secondary"] };

  return (
    <div className="row g-3">
      <div className="col-lg-7">
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">ใบสั่งซื้อทั้งหมด</div>
          <div className="card-body p-0" style={{ overflowX: "auto" }}>
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead className="table-light"><tr><th>เลขที่</th><th>ผู้ขาย</th><th>รายการ</th><th className="text-end">มูลค่า</th><th>สถานะ</th><th /></tr></thead>
              <tbody>
                {pos.map((po) => {
                  const total = po.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0);
                  const [label, cls] = STATUS_TH[po.status] || [po.status, "text-bg-light"];
                  return (
                    <tr key={po.po_ID}>
                      <td className="font-monospace small">{po.po_ID}</td>
                      <td>{po.supplier || "-"}</td>
                      <td className="small">{po.items.map((i) => `${i.name}×${i.qty}`).join(", ")}</td>
                      <td className="text-end">{money(total)}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td className="text-end pe-2">
                        {po.status === "ordered" && <button className="btn btn-primary btn-sm" onClick={() => receive(po)}>รับของ</button>}
                      </td>
                    </tr>
                  );
                })}
                {!pos.length && <tr><td colSpan={6} className="text-center text-muted py-4">— ยังไม่มีใบสั่งซื้อ —</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        {low.length > 0 && (
          <div className="alert alert-danger py-2 small">
            <b>ต่ำกว่าจุดสั่งซื้อ:</b> {low.map((r) => r.product.name).join(", ")}
          </div>
        )}
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">สร้างใบสั่งซื้อ</div>
          <div className="card-body">
            <div className="mb-2">
              <input className="form-control form-control-sm" list="supplier-list" placeholder="ผู้ขาย (พิมพ์หรือเลือก)" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              <datalist id="supplier-list">{suppliers.map((s) => <option key={s.supplier_ID} value={s.name} />)}</datalist>
            </div>
            <div className="mb-2">
              <select className="form-select form-select-sm" value="" onChange={(e) => { const p = products.find((x) => x.product_ID === e.target.value); if (p) addItem(p); }}>
                <option value="">+ เพิ่มสินค้าเข้าใบสั่งซื้อ…</option>
                {products.filter((p) => p.active !== false).map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name}</option>)}
              </select>
            </div>
            {items.map((it, i) => (
              <div className="row g-1 mb-1 align-items-center" key={i}>
                <div className="col-5 small">{it.name}</div>
                <div className="col-3"><input type="number" className="form-control form-control-sm" placeholder="จำนวน" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} /></div>
                <div className="col-3"><input type="number" className="form-control form-control-sm" placeholder="ทุน/unit" value={it.cost_price_per_unit || ""} onChange={(e) => setItem(i, "cost_price_per_unit", e.target.value)} /></div>
                <div className="col-1"><button className="btn btn-outline-danger btn-sm" onClick={() => setItems((s) => s.filter((_, j) => j !== i))}>×</button></div>
              </div>
            ))}
            <button className="btn btn-primary btn-sm d-block ms-auto px-4 mt-2" disabled={!items.length} onClick={submit}>สั่งซื้อ ({items.length} รายการ)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── รับเข้า (ไม่ผ่าน PO) ──
function ReceiveTab() {
  const { data: products = [] } = useGetListQuery({ res: "products", tag: "Products" });
  const [receiveStock, { isLoading }] = useReceiveStockMutation();
  const [f, setF] = useState({ product_ID: "", quantity_received: 1, cost_price_per_unit: 0, lot_number: "", supplier: "", expiry_date: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      const r = await receiveStock({ ...f, quantity_received: Number(f.quantity_received), cost_price_per_unit: Number(f.cost_price_per_unit) }).unwrap();
      setMsg(`รับเข้าแล้ว lot ${r.lot.lot_ID} (${r.items_created} ชิ้น) — ลงบัญชีอัตโนมัติ`);
      setF({ product_ID: "", quantity_received: 1, cost_price_per_unit: 0, lot_number: "", supplier: "", expiry_date: "" });
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <div className="card shadow-sm" style={{ maxWidth: 620 }}>
      <div className="card-header fw-semibold">รับของเข้า (สร้าง lot + ลงบัญชี Dr คลัง)</div>
      <form className="card-body" onSubmit={submit}>
        {msg && <div className="alert alert-success py-2">{msg}</div>}
        {err && <div className="alert alert-danger py-2">{err}</div>}
        <div className="row g-2">
          <div className="col-12">
            <label className="form-label small">สินค้า</label>
            <select className="form-select form-select-sm" value={f.product_ID} onChange={set("product_ID")} required>
              <option value="">— เลือกสินค้า —</option>
              {products.filter((p) => p.active !== false).map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-4"><label className="form-label small">จำนวน (unit)</label><input type="number" min={1} className="form-control form-control-sm" value={f.quantity_received} onChange={set("quantity_received")} /></div>
          <div className="col-4"><label className="form-label small">ทุนต่อ unit (บาท)</label><input type="number" className="form-control form-control-sm" value={f.cost_price_per_unit} onChange={set("cost_price_per_unit")} /></div>
          <div className="col-4"><label className="form-label small">lot number</label><input className="form-control form-control-sm" value={f.lot_number} onChange={set("lot_number")} /></div>
          <div className="col-6"><label className="form-label small">ผู้ขาย (มี = ตั้งหนี้ AP, ว่าง = ซื้อสด)</label><input className="form-control form-control-sm" value={f.supplier} onChange={set("supplier")} /></div>
          <div className="col-6"><label className="form-label small">วันหมดอายุ</label><input type="date" className="form-control form-control-sm" value={f.expiry_date} onChange={set("expiry_date")} /></div>
        </div>
        <button type="submit" className="btn btn-primary btn-sm d-block ms-auto px-4 mt-3" disabled={isLoading || !f.product_ID}>
          {isLoading ? "กำลังบันทึก…" : "รับเข้า"}
        </button>
      </form>
    </div>
  );
}

// ── นับสต๊อก ──
function CountTab() {
  const { data: rows = [] } = useGetStockSummaryQuery();
  const [adjustStock] = useAdjustStockMutation();
  const [counts, setCounts] = useState({}); // product_ID → counted
  const [note, setNote] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function adjust(r) {
    setErr(""); setResult(null);
    const counted = Number(counts[r.product.product_ID]);
    if (Number.isNaN(counted)) return setErr("กรอกจำนวนที่นับได้ก่อน");
    try {
      const res = await adjustStock({ product_ID: r.product.product_ID, counted, note }).unwrap();
      setResult(res);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header fw-semibold">นับสต๊อก — กรอกยอดที่นับได้จริง แล้วปรับ (ตัดของขาด + ลงบัญชี)</div>
      <div className="card-body">
        {err && <div className="alert alert-danger py-2">{err}</div>}
        {result && (
          <div className="alert alert-success py-2">
            ปรับแล้ว: ตัด {result.adjusted} ชิ้น มูลค่า {money(result.value)} บาท (JE: ปรับสต๊อก) — ระบบ {result.system} → {result.counted}
          </div>
        )}
        <div className="mb-2" style={{ maxWidth: 420 }}>
          <input className="form-control form-control-sm" placeholder="หมายเหตุรอบนับ (เช่น นับประจำเดือน ก.ค.)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light"><tr><th>สินค้า</th><th className="text-end">ระบบ (unit)</th><th style={{ width: 140 }}>นับได้จริง</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.product_ID}>
                  <td>{r.product.name}</td>
                  <td className="text-end">{r.unused + r.in_use}</td>
                  <td><input type="number" className="form-control form-control-sm" value={counts[r.product.product_ID] ?? ""} onChange={(e) => setCounts((s) => ({ ...s, [r.product.product_ID]: e.target.value }))} /></td>
                  <td><button className="btn btn-outline-primary btn-sm" onClick={() => adjust(r)}>ปรับยอด</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="text-center text-muted py-4">— ยังไม่มีสินค้า —</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-muted small">นับได้มากกว่าระบบ → ใช้แท็บ "รับเข้า" เพิ่มพร้อมระบุทุน · นับได้น้อยกว่า → ระบบตัดชิ้นเก่าสุด (FIFO) เป็น discarded + ลงบัญชีค่าใช้จ่าย</div>
      </div>
    </div>
  );
}

// ── รายงาน ──
function ReportTab() {
  const { data: rows = [] } = useGetStockSummaryQuery();
  const { data: pos = [] } = useGetPOsQuery();
  const totalUnits = rows.reduce((s, r) => s + r.unused + r.in_use, 0);
  const expiring = rows.flatMap((r) => r.warnings.filter((w) => w.type === "lot_expiry").map((w) => ({ name: r.product.name, ...w })));
  const low = rows.filter((r) => r.warnings.some((w) => w.type === "low_stock"));
  const openPo = pos.filter((p) => p.status === "ordered");

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="card text-bg-primary shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{money(totalUnits)}</div><div>ชิ้นในคลัง (unused + in use)</div></div></div>
      </div>
      <div className="col-md-4">
        <div className="card text-bg-warning shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{expiring.length}</div><div>ชิ้นใกล้หมดอายุ (30 วัน)</div></div></div>
      </div>
      <div className="col-md-4">
        <div className="card text-bg-danger shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{low.length}</div><div>สินค้าต่ำกว่าจุดสั่งซื้อ</div></div></div>
      </div>
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">ใกล้หมดอายุ</div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <tbody>
                {expiring.slice(0, 12).map((e, i) => <tr key={i}><td>{e.name}</td><td className="text-end text-warning">{e.expiry_date}</td></tr>)}
                {!expiring.length && <tr><td className="text-center text-muted py-3">— ไม่มี —</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">PO ค้างรับ ({openPo.length})</div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <tbody>
                {openPo.map((p) => <tr key={p.po_ID}><td className="font-monospace small">{p.po_ID}</td><td>{p.supplier || "-"}</td><td className="text-end">{money(p.items.reduce((s, i) => s + i.qty * i.cost_price_per_unit, 0))}</td></tr>)}
                {!openPo.length && <tr><td className="text-center text-muted py-3">— ไม่มี —</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
