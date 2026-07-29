"use client";
// Setup (ตั้งค่าธุรกิจ) V2 — Company/Brand · บริการ(หัตถการ) · สินค้า · คอร์ส · ค่าตัว BT/หมอ · Sale incentive
// ทุกอย่างผ่าน RTK Query (generic getList/createItem/updateItem ต่อ resource + tag)
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import SystemSettings from "@/components/lgc/SystemSettings";
import {
  useGetCompanyQuery, useUpdateCompanyMutation,
  useGetListQuery, useCreateItemMutation, useUpdateItemMutation, useDeleteItemMutation,
  useGetUsersQuery, useUpdateUserMutation,
} from "@/store/apiSlice";

const money = (n) => Number(n || 0).toLocaleString("th-TH");

const TABS = [
  { key: "company", label: "บริษัท & แบรนด์", ico: "bi-building" },
  { key: "services", label: "บริการ (หัตถการ)", ico: "bi-stars" },
  { key: "products", label: "สินค้า", ico: "bi-box" },
  { key: "courses", label: "คอร์ส", ico: "bi-grid-3x3-gap" },
  { key: "bt", label: "BT — ค่าตัว/ค่ามือ", ico: "bi-person-heart" },
  { key: "doctor", label: "หมอ — ค่าตัว/DF", ico: "bi-heart-pulse" },
  { key: "incentive", label: "Sale incentive", ico: "bi-cash-coin" },
  { key: "promotions", label: "โปรโมชั่น", ico: "bi-tags" },
  { key: "system", label: "ระบบ/ห้อง", ico: "bi-gear" },
];

export default function SetupPage() {
  const role = useSelector((s) => s.auth.user?.role);
  const [tab, setTab] = useState("company");

  if (role && role !== "super_admin")
    return <div className="app-content"><div className="container-fluid pt-3"><div className="alert alert-warning">เฉพาะเจ้าของระบบ</div></div></div>;

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3">
          <h4 className="mb-0 fw-bold">ตั้งค่าธุรกิจ (Setup)</h4>
        </div>
        <ul className="nav nav-tabs mb-3 flex-nowrap" style={{ overflowX: "auto" }}>
          {TABS.map((t) => (
            <li className="nav-item" key={t.key}>
              <button className={`nav-link text-nowrap ${tab === t.key ? "active fw-semibold" : ""}`} onClick={() => setTab(t.key)}>
                <i className={`bi ${t.ico} me-1`} />{t.label}
              </button>
            </li>
          ))}
        </ul>

        {tab === "company" && <CompanyTab />}
        {tab === "services" && <CatalogTab res="procedures" tag="Procedures" idField="medical_procedure_ID"
          title="บริการ / หัตถการ + ค่ามือ"
          fields={[
            { key: "name", label: "ชื่อหัตถการ", type: "text", required: true },
            { key: "type", label: "ผู้ทำ", type: "select", options: [{ v: "BT", l: "BT" }, { v: "doctor", l: "หมอ" }] },
            { key: "cost", label: "ค่ามือ (บาท/ครั้ง)", type: "number" },
          ]}
          cols={[["name", "ชื่อ"], ["type", "ผู้ทำ"], ["cost", "ค่ามือ", money]]} />}
        {tab === "products" && <CatalogTab res="products" tag="Products" idField="product_ID"
          title="สินค้า (ยา/เวชภัณฑ์ — ทุนจริงอยู่ที่ lot ตอนรับเข้า)"
          fields={[
            { key: "name", label: "ชื่อสินค้า", type: "text", required: true },
            { key: "type", label: "ประเภท", type: "select", options: [{ v: "injection", l: "ยาฉีด (injection)" }, { v: "consumable", l: "ของใช้สิ้นเปลือง" }, { v: "other", l: "อื่นๆ" }] },
            { key: "unit", label: "หน่วยใหญ่ (เช่น ขวด)", type: "text" },
            { key: "sub_unit", label: "หน่วยย่อย (เช่น cc)", type: "text" },
            { key: "sub_unit_size", label: "1 unit = กี่หน่วยย่อย", type: "number" },
            { key: "default_uses_per_unit", label: "ใช้ได้ (ครั้ง/unit)", type: "number" },
            { key: "selling_price", label: "ราคาขาย add-on (บาท)", type: "number" },
            { key: "addon_sub_unit_per_use", label: "add-on ตัดกี่หน่วยย่อย/ครั้ง (0=ทั้ง unit)", type: "number" },
            { key: "reorder_point", label: "จุดสั่งซื้อ (units)", type: "number" },
            { key: "shelf_life_after_open_days", label: "อายุหลังเปิด (วัน · 0=ไม่เตือน)", type: "number" },
          ]}
          cols={[["name", "ชื่อ"], ["type", "ประเภท"], ["unit", "หน่วย"], ["selling_price", "ราคาขาย", money], ["reorder_point", "reorder"]]} />}
        {tab === "courses" && <CourseTab />}
        {tab === "bt" && <RatesTab role="BT" title="BT — ค่าตัวต่อชั่วโมง + ค่ามือ (default)"
          fields={[["rate_per_hour", "ค่าตัว (บาท/ชม.)"], ["hand_fee", "ค่ามือ default (บาท/หัตถการ)"]]} />}
        {tab === "doctor" && <RatesTab role="doctor" title="หมอ — ค่าตัวต่อชั่วโมง + DF (ค่ามือหมอ default)"
          fields={[["rate_per_hour", "ค่าตัว (บาท/ชม.)"], ["doctor_fee", "DF ค่ามือหมอ default (บาท)"]]} />}
        {tab === "incentive" && <IncentiveTab />}
        {tab === "promotions" && <CatalogTab res="promotions" tag="Promotions" idField="promotion_ID"
          title="โปรโมชั่น (แสดงหน้า about_me + ปฏิทินลูกค้า)"
          fields={[
            { key: "name", label: "ชื่อโปรโมชั่น", type: "text", required: true },
            { key: "type", label: "ประเภท", type: "select", options: [{ v: "discount", l: "ส่วนลดคอร์ส" }, { v: "new_course", l: "คอร์สโปรพิเศษ" }] },
            { key: "discount_type", label: "ลดแบบ (discount)", type: "select", options: [{ v: "percent", l: "%" }, { v: "baht", l: "บาท" }] },
            { key: "discount_value", label: "มูลค่าส่วนลด", type: "number" },
            { key: "date_start", label: "เริ่ม", type: "date" },
            { key: "date_end", label: "สิ้นสุด", type: "date" },
            { key: "banner_image", label: "แบนเนอร์", type: "image" },
          ]}
          cols={[["name", "ชื่อ"], ["type", "ประเภท"], ["date_start", "เริ่ม"], ["date_end", "ถึง"]]} />}
        {tab === "system" && <div className="lgc"><SystemSettings /></div>}
      </div>
    </div>
  );
}

// ── บริษัท & แบรนด์ ──
function CompanyTab() {
  const { data: company } = useGetCompanyQuery();
  const [updateCompany, { isLoading }] = useUpdateCompanyMutation();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  const cur = f ?? {
    name: company?.name || "", address: company?.address || "", tax_id: company?.tax_id || "",
    phone: company?.phone || "", email: company?.email || "",
    display_name: company?.brand?.display_name || "", tagline: company?.brand?.tagline || "",
    about: company?.brand?.about || "", logo: company?.brand?.logo || "/brand/logo.jpg",
  };
  const set = (k) => (e) => setF({ ...cur, [k]: e.target.value });

  function pickLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setF({ ...cur, logo: reader.result });
    reader.readAsDataURL(file);
  }

  async function save() {
    await updateCompany({
      name: cur.name, address: cur.address, tax_id: cur.tax_id, phone: cur.phone, email: cur.email,
      brand: { display_name: cur.display_name, tagline: cur.tagline, about: cur.about, logo: cur.logo },
    }).unwrap().catch(() => {});
    setMsg("บันทึกแล้ว — หน้า about_me / sidebar อัปเดตตาม");
    setTimeout(() => setMsg(""), 4000);
  }

  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold"><i className="bi bi-building me-1" /> ข้อมูลบริษัท</div>
          <div className="card-body">
            {msg && <div className="alert alert-success py-2">{msg}</div>}
            <div className="row g-3">
              <div className="col-12"><label className="form-label">ชื่อบริษัท / คลินิก</label><input className="form-control" value={cur.name} onChange={set("name")} /></div>
              <div className="col-md-8"><label className="form-label">ที่อยู่</label><input className="form-control" value={cur.address} onChange={set("address")} /></div>
              <div className="col-md-4"><label className="form-label">เลขผู้เสียภาษี</label><input className="form-control" value={cur.tax_id} onChange={set("tax_id")} /></div>
              <div className="col-md-6"><label className="form-label">เบอร์โทร</label><input className="form-control" value={cur.phone} onChange={set("phone")} /></div>
              <div className="col-md-6"><label className="form-label">อีเมล</label><input className="form-control" value={cur.email} onChange={set("email")} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold"><i className="bi bi-palette me-1" /> แบรนด์</div>
          <div className="card-body">
            <div className="d-flex align-items-center gap-3 mb-3">
              <img src={cur.logo?.startsWith("data:") ? cur.logo : `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${cur.logo}`} alt="logo" width={64} height={64} style={{ borderRadius: 12, objectFit: "cover" }} />
              <label className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-image me-1" /> เปลี่ยนโลโก้
                <input type="file" accept="image/*" hidden onChange={pickLogo} />
              </label>
            </div>
            <div className="mb-2"><label className="form-label">ชื่อแบรนด์ (แสดงบนเมนู/หน้าเว็บ)</label><input className="form-control" value={cur.display_name} onChange={set("display_name")} /></div>
            <div className="mb-2"><label className="form-label">สโลแกน (tagline)</label><input className="form-control" value={cur.tagline} onChange={set("tagline")} /></div>
            <div className="mb-2"><label className="form-label">แนะนำร้าน (แสดงหน้า about_me)</label><textarea className="form-control" rows={3} value={cur.about} onChange={set("about")} /></div>
          </div>
        </div>
        <button className="btn btn-primary d-block ms-auto px-4 mt-3 fw-semibold" disabled={isLoading} onClick={save}>
          {isLoading ? "กำลังบันทึก…" : "บันทึกทั้งหมด"}
        </button>
      </div>
    </div>
  );
}

// ── catalog ทั่วไป (บริการ/สินค้า/คอร์ส) — CRUD ผ่าน RTK generic endpoints ──
function CatalogTab({ res, tag, idField, title, fields, cols }) {
  const { data: rows = [] } = useGetListQuery({ res, tag });
  const [createItem] = useCreateItemMutation();
  const [updateItem] = useUpdateItemMutation();
  const [deleteItem] = useDeleteItemMutation();
  const [editing, setEditing] = useState(null); // null | {} | {row}
  const [err, setErr] = useState("");
  const isEdit = editing && editing[idField];

  async function save() {
    setErr("");
    const body = {};
    for (const f of fields) body[f.key] = f.type === "number" ? Number(editing[f.key]) || 0 : editing[f.key] || "";
    if (!isEdit && res === "promotions") body.active = true;
    try {
      if (isEdit) await updateItem({ res, tag, id: editing[idField], body }).unwrap();
      else await createItem({ res, tag, body }).unwrap();
      setEditing(null);
    } catch (e) { setErr(e.message); }
  }
  async function remove(row) {
    if (!confirm(`ปิดการใช้งาน "${row.name}"?`)) return;
    await deleteItem({ res, tag, id: row[idField] }).unwrap().catch((e) => setErr(e.message));
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center">
        <span className="fw-semibold">{title}</span>
        <button className="btn btn-primary btn-sm ms-auto" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" /> เพิ่ม</button>
      </div>
      {err && <div className="alert alert-danger py-2 m-2 mb-0">{err}</div>}
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr><th>ID</th>{cols.map(([k, l]) => <th key={k}>{l}</th>)}<th className="text-center">สถานะ</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[idField]} className={r.active === false ? "opacity-50" : ""}>
                <td className="font-monospace small">{r[idField]}</td>
                {cols.map(([k, _l, fmt]) => <td key={k}>{fmt ? fmt(r[k]) : String(r[k] ?? "-")}</td>)}
                <td className="text-center">{r.active !== false ? <span className="badge text-bg-success">ใช้งาน</span> : <span className="badge text-bg-secondary">ปิด</span>}</td>
                <td className="text-end pe-2 text-nowrap">
                  <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => setEditing(r)}><i className="bi bi-pencil" /></button>
                  {r.active !== false && <button className="btn btn-outline-danger btn-sm" onClick={() => remove(r)}><i className="bi bi-x-lg" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 3} className="text-center text-muted py-4">— ยังไม่มีข้อมูล —</td></tr>}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.4)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title fw-bold">{isEdit ? `แก้ไข: ${editing.name}` : "เพิ่มรายการ"}</h5><button className="btn-close" onClick={() => setEditing(null)} /></div>
              <div className="modal-body">
                {fields.map((f) => (
                  <div className="mb-2" key={f.key}>
                    <label className="form-label small">{f.label}</label>
                    {f.type === "select" ? (
                      <select className="form-select form-select-sm" value={editing[f.key] ?? f.options[0].v} onChange={(e) => setEditing((s) => ({ ...s, [f.key]: e.target.value }))}>
                        {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : f.type === "image" ? (
                      <div className="d-flex align-items-center gap-2">
                        {editing[f.key] && <img src={editing[f.key]} alt="" width={80} height={50} className="rounded object-fit-cover border" />}
                        <label className="btn btn-outline-secondary btn-sm mb-0">
                          <i className="bi bi-image me-1" /> เลือกรูป
                          <input type="file" accept="image/*" hidden onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setEditing((s) => ({ ...s, [f.key]: reader.result }));
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        {editing[f.key] && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setEditing((s) => ({ ...s, [f.key]: "" }))}>ลบ</button>}
                      </div>
                    ) : (
                      <input type={f.type} className="form-control form-control-sm" value={editing[f.key] ?? ""} onChange={(e) => setEditing((s) => ({ ...s, [f.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(null)}>ยกเลิก</button>
                <button className="btn btn-primary btn-sm" onClick={save}>บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── คอร์ส (editor เต็ม — รายละเอียดเท่าหน้า admin): ราคา/ครั้ง/อายุ + สินค้าที่ใช้ต่อครั้ง + หัตถการ BT/หมอ + รูป ──
function CourseTab() {
  const { data: rows = [] } = useGetListQuery({ res: "courses", tag: "Courses" });
  const { data: products = [] } = useGetListQuery({ res: "products", tag: "Products" });
  const { data: procs = [] } = useGetListQuery({ res: "procedures", tag: "Procedures" });
  const [createItem] = useCreateItemMutation();
  const [updateItem] = useUpdateItemMutation();
  const [deleteItem] = useDeleteItemMutation();
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const isEdit = editing && editing.course_ID;
  const pname = (id) => products.find((p) => p.product_ID === id)?.name || id;
  const procName = (id) => procs.find((p) => p.medical_procedure_ID === id)?.name || id;

  function open(row) {
    setEditing(row ? {
      ...row,
      products: (row.products || []).map((x) => ({ ...x })),
      BT_procedures: (row.BT_procedures || []).map((x) => ({ ...x })),
      doctor_procedures: (row.doctor_procedures || []).map((x) => ({ ...x })),
    } : { name: "", price: 0, quantity_used: 5, validity_days: 365, duration_minutes: 60, image: "", products: [], BT_procedures: [], doctor_procedures: [], is_promotion_course: false });
  }
  const set = (k) => (e) => setEditing((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing((s) => ({ ...s, image: reader.result }));
    reader.readAsDataURL(file);
  }

  async function save() {
    setErr("");
    const body = {
      name: editing.name, price: Number(editing.price) || 0,
      quantity_used: Number(editing.quantity_used) || 1,
      validity_days: Number(editing.validity_days) || 0,
      duration_minutes: Number(editing.duration_minutes) || 60,
      image: editing.image || "",
      is_promotion_course: !!editing.is_promotion_course,
      products: editing.products.filter((x) => x.product_ID).map((x) => ({ product_ID: x.product_ID, sub_unit_per_use: Number(x.sub_unit_per_use) || 1 })),
      BT_procedures: editing.BT_procedures.filter((x) => x.medical_procedure_ID),
      doctor_procedures: editing.doctor_procedures.filter((x) => x.medical_procedure_ID),
    };
    if (!body.name.trim()) return setErr("กรุณากรอกชื่อคอร์ส");
    try {
      if (isEdit) await updateItem({ res: "courses", tag: "Courses", id: editing.course_ID, body }).unwrap();
      else await createItem({ res: "courses", tag: "Courses", body }).unwrap();
      setEditing(null);
    } catch (e) { setErr(e.message); }
  }
  async function remove(row) {
    if (!confirm(`ปิดการใช้งานคอร์ส "${row.name}"?`)) return;
    await deleteItem({ res: "courses", tag: "Courses", id: row.course_ID }).unwrap().catch((e) => setErr(e.message));
  }

  const listEditor = (key, options, labelOf, extra) => (
    <div className="border rounded p-2 mb-2 bg-light">
      {(editing[key] || []).map((row, i) => (
        <div className="d-flex gap-2 mb-1 align-items-center" key={i}>
          <select className="form-select form-select-sm" value={row.product_ID ?? row.medical_procedure_ID ?? ""}
            onChange={(e) => setEditing((s) => ({ ...s, [key]: s[key].map((x, j) => j === i ? { ...x, [extra ? "product_ID" : "medical_procedure_ID"]: e.target.value } : x) }))}>
            <option value="">— เลือก —</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {extra && (
            <input type="number" className="form-control form-control-sm" style={{ maxWidth: 120 }} placeholder="หน่วยย่อย/ครั้ง"
              value={row.sub_unit_per_use ?? 1}
              onChange={(e) => setEditing((s) => ({ ...s, [key]: s[key].map((x, j) => j === i ? { ...x, sub_unit_per_use: e.target.value } : x) }))} />
          )}
          <button className="btn btn-outline-danger btn-sm" onClick={() => setEditing((s) => ({ ...s, [key]: s[key].filter((_, j) => j !== i) }))}>×</button>
        </div>
      ))}
      <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing((s) => ({ ...s, [key]: [...(s[key] || []), extra ? { product_ID: "", sub_unit_per_use: 1 } : { medical_procedure_ID: "" }] }))}>
        + เพิ่ม
      </button>
    </div>
  );

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center">
        <span className="fw-semibold">คอร์ส (รายละเอียดเต็ม: สินค้า/ครั้ง · หัตถการ BT/หมอ · รูปหน้าร้าน)</span>
        <button className="btn btn-primary btn-sm ms-auto" onClick={() => open(null)}><i className="bi bi-plus-lg me-1" /> เพิ่มคอร์ส</button>
      </div>
      {err && <div className="alert alert-danger py-2 m-2 mb-0">{err}</div>}
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr><th></th><th>ID</th><th>ชื่อ</th><th className="text-end">ราคา</th><th className="text-end">ครั้ง</th><th className="text-end">นาที/ครั้ง</th><th>ส่วนประกอบ</th><th className="text-center">สถานะ</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.course_ID} className={r.active === false ? "opacity-50" : ""}>
                <td>{r.image ? <img src={r.image} alt="" width={40} height={30} className="rounded object-fit-cover" /> : <span className="text-muted">—</span>}</td>
                <td className="font-monospace small">{r.course_ID}</td>
                <td><b>{r.name}</b>{r.is_promotion_course && <span className="badge text-bg-danger ms-1">โปร</span>}</td>
                <td className="text-end">{money(r.price)}</td>
                <td className="text-end">{r.quantity_used}</td>
                <td className="text-end">{r.duration_minutes}</td>
                <td className="small text-muted" style={{ maxWidth: 260 }}>
                  {(r.products || []).map((x) => `${pname(x.product_ID)}×${x.sub_unit_per_use}`).join(", ") || "—"}
                  {(r.BT_procedures?.length || r.doctor_procedures?.length) ? (
                    <div>BT: {(r.BT_procedures || []).map((x) => procName(x.medical_procedure_ID)).join(", ") || "—"} · หมอ: {(r.doctor_procedures || []).map((x) => procName(x.medical_procedure_ID)).join(", ") || "—"}</div>
                  ) : null}
                </td>
                <td className="text-center">{r.active !== false ? <span className="badge text-bg-success">ใช้งาน</span> : <span className="badge text-bg-secondary">ปิด</span>}</td>
                <td className="text-end pe-2 text-nowrap">
                  <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => open(r)}><i className="bi bi-pencil" /></button>
                  {r.active !== false && <button className="btn btn-outline-danger btn-sm" onClick={() => remove(r)}><i className="bi bi-x-lg" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="text-center text-muted py-4">— ยังไม่มีคอร์ส —</td></tr>}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.4)", overflowY: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">{isEdit ? `แก้ไข: ${editing.name}` : "เพิ่มคอร์สใหม่"}</h5>
                <button className="btn-close" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-2">
                  <div className="col-md-8"><label className="form-label small">ชื่อคอร์ส *</label><input className="form-control form-control-sm" value={editing.name} onChange={set("name")} /></div>
                  <div className="col-md-4"><label className="form-label small">ราคา (บาท)</label><input type="number" className="form-control form-control-sm" value={editing.price} onChange={set("price")} /></div>
                  <div className="col-md-3"><label className="form-label small">จำนวนครั้ง</label><input type="number" className="form-control form-control-sm" value={editing.quantity_used} onChange={set("quantity_used")} /></div>
                  <div className="col-md-3"><label className="form-label small">อายุ (วัน · 0=ไม่หมด)</label><input type="number" className="form-control form-control-sm" value={editing.validity_days} onChange={set("validity_days")} /></div>
                  <div className="col-md-3"><label className="form-label small">เวลา/ครั้ง (นาที)</label><input type="number" className="form-control form-control-sm" value={editing.duration_minutes} onChange={set("duration_minutes")} /></div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="cPromo" checked={!!editing.is_promotion_course} onChange={set("is_promotion_course")} />
                      <label className="form-check-label small" htmlFor="cPromo">คอร์สโปรโมชั่น</label>
                    </div>
                  </div>
                </div>

                <label className="form-label small fw-bold">สินค้าที่ใช้ต่อครั้ง (ตัด stock ตอนปิดเคส)</label>
                {listEditor("products", products.filter((p) => p.active !== false).map((p) => ({ id: p.product_ID, label: `${p.name} (${p.sub_unit || p.unit})` })), null, true)}

                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">หัตถการขั้น BT (ว่าง = ข้ามขั้น BT)</label>
                    {listEditor("BT_procedures", procs.filter((p) => p.type === "BT" && p.active !== false).map((p) => ({ id: p.medical_procedure_ID, label: `${p.name} (${money(p.cost)}฿)` })))}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">หัตถการขั้นหมอ (ว่าง = ข้ามขั้นหมอ)</label>
                    {listEditor("doctor_procedures", procs.filter((p) => p.type === "doctor" && p.active !== false).map((p) => ({ id: p.medical_procedure_ID, label: `${p.name} (${money(p.cost)}฿)` })))}
                  </div>
                </div>

                <label className="form-label small fw-bold mt-2">รูปหน้าร้าน (โชว์ about_me / ปฏิทินลูกค้า)</label>
                <div className="d-flex align-items-center gap-2">
                  {editing.image && <img src={editing.image} alt="" width={90} height={60} className="rounded object-fit-cover border" />}
                  <label className="btn btn-outline-secondary btn-sm">
                    <i className="bi bi-image me-1" /> เลือกรูป
                    <input type="file" accept="image/*" hidden onChange={pickImage} />
                  </label>
                  {editing.image && <button className="btn btn-outline-danger btn-sm" onClick={() => setEditing((s) => ({ ...s, image: "" }))}>ลบรูป</button>}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(null)}>ยกเลิก</button>
                <button className="btn btn-primary btn-sm" onClick={save}>บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ค่าตัว/ค่ามือ ต่อคน (BT / หมอ) — แก้ inline บันทึกทีละคน ──
function RatesTab({ role, title, fields }) {
  const { data: users = [] } = useGetUsersQuery();
  const [updateUser] = useUpdateUserMutation();
  const list = useMemo(() => users.filter((u) => u.role === role), [users, role]);
  const [draft, setDraft] = useState({}); // { user_ID: {field: value} }
  const [saved, setSaved] = useState("");

  const val = (u, k) => draft[u.user_ID]?.[k] ?? u[k] ?? 0;
  const setVal = (u, k, v) => setDraft((s) => ({ ...s, [u.user_ID]: { ...s[u.user_ID], [k]: v } }));

  async function save(u) {
    const body = { user_ID: u.user_ID };
    for (const [k] of fields) body[k] = Number(val(u, k)) || 0;
    await updateUser(body).unwrap().catch(() => {});
    setSaved(u.user_ID);
    setTimeout(() => setSaved(""), 2500);
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header fw-semibold">{title}</div>
      <div className="card-body p-0" style={{ overflowX: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr><th>ชื่อ</th>{fields.map(([k, l]) => <th key={k} className="text-end">{l}</th>)}<th style={{ width: 110 }} /></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.user_ID}>
                <td><b>{u.nick_name || u.full_name}</b> <span className="text-muted small">{u.full_name}</span></td>
                {fields.map(([k]) => (
                  <td key={k} className="text-end" style={{ maxWidth: 140 }}>
                    <input type="number" className="form-control form-control-sm text-end" value={val(u, k)} onChange={(e) => setVal(u, k, e.target.value)} />
                  </td>
                ))}
                <td className="text-end pe-2">
                  <button className="btn btn-primary btn-sm" onClick={() => save(u)}>
                    {saved === u.user_ID ? "✓ บันทึกแล้ว" : "บันทึก"}
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={fields.length + 2} className="text-center text-muted py-4">— ยังไม่มีพนักงาน role นี้ — เพิ่มที่เมนู บุคคล (HR)</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sale incentive: ต่อคน + ขั้นบันไดตามยอด ──
function IncentiveTab() {
  const { data: users = [] } = useGetUsersQuery();
  const [updateUser] = useUpdateUserMutation();
  const sales = useMemo(() => users.filter((u) => u.role === "sale"), [users]);
  const [sel, setSel] = useState(null); // user_ID ที่กำลังแก้
  const [tiers, setTiers] = useState([]);
  const [saved, setSaved] = useState(false);

  const current = sales.find((u) => u.user_ID === sel);

  function openUser(u) {
    setSel(u.user_ID);
    setTiers(u.incentive_tiers?.length ? u.incentive_tiers.map((t) => ({ ...t })) : [{ min_sales: 0, rate: 0 }]);
    setSaved(false);
  }
  async function save() {
    const clean = tiers
      .map((t) => ({ min_sales: Number(t.min_sales) || 0, rate: Number(t.rate) || 0 }))
      .sort((a, b) => a.min_sales - b.min_sales);
    await updateUser({ user_ID: sel, incentive_tiers: clean }).unwrap().catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">พนักงานขาย (sale)</div>
          <div className="list-group list-group-flush">
            {sales.map((u) => (
              <button key={u.user_ID} className={`list-group-item list-group-item-action d-flex align-items-center ${sel === u.user_ID ? "active" : ""}`} onClick={() => openUser(u)}>
                <div>
                  <div className="fw-semibold">{u.nick_name || u.full_name}</div>
                  <small className={sel === u.user_ID ? "" : "text-muted"}>
                    {u.incentive_tiers?.length ? `${u.incentive_tiers.length} ขั้น` : "ยังไม่ตั้ง incentive"}
                  </small>
                </div>
                <i className="bi bi-chevron-right ms-auto" />
              </button>
            ))}
            {!sales.length && <div className="list-group-item text-muted">— ยังไม่มีพนักงานขาย —</div>}
          </div>
        </div>
      </div>
      <div className="col-lg-7">
        {current ? (
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">ขั้นบันได incentive — {current.nick_name || current.full_name} <span className="text-muted small">(แต่ละคนตั้งไม่เท่ากันได้)</span></div>
            <div className="card-body">
              <table className="table table-sm align-middle">
                <thead className="table-light"><tr><th>ยอดขายขั้นต่ำ/เดือน (บาท)</th><th>ได้คอม (%)</th><th /></tr></thead>
                <tbody>
                  {tiers.map((t, i) => (
                    <tr key={i}>
                      <td><input type="number" className="form-control form-control-sm" value={t.min_sales} onChange={(e) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, min_sales: e.target.value } : x)))} /></td>
                      <td style={{ maxWidth: 120 }}><input type="number" className="form-control form-control-sm" value={t.rate} onChange={(e) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} /></td>
                      <td className="text-end"><button className="btn btn-outline-danger btn-sm" onClick={() => setTiers((s) => s.filter((_, j) => j !== i))}><i className="bi bi-x" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setTiers((s) => [...s, { min_sales: 0, rate: 0 }])}>+ เพิ่มขั้น</button>
                <button className="btn btn-primary btn-sm ms-auto" onClick={save}>{saved ? "✓ บันทึกแล้ว" : "บันทึก"}</button>
              </div>
              <div className="text-muted small mt-2">ตัวอย่าง: 0→2%, 100,000→3%, 300,000→5% — ยอดเดือนถึงขั้นไหน ใช้ % ขั้นนั้นทั้งเดือน</div>
            </div>
          </div>
        ) : (
          <div className="card shadow-sm"><div className="card-body text-center text-muted py-5">← เลือกพนักงานขายเพื่อตั้งขั้นบันได</div></div>
        )}
      </div>
    </div>
  );
}
