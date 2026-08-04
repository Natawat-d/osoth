"use client";
// OPD / หน้าห้อง — V3 เขียนใหม่ทั้งหน้าเป็น Bootstrap/AdminLTE แท้ (ref: mailbox inbox + info-box)
// flow เดิมทุกอย่าง (API เดิม): เปิดเคส → วัดตัว → (ปรึกษาหมอ) → คอร์ส+ชำระ → BT → หมอ → ปิดเคส
// V3 เพิ่ม: ใบยินยอม (อัปโหลด/เซ็นบนจอ — บังคับก่อนปิดเคส) + timeline เคส
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { pushToast } from "@/store/uiSlice";
import { api } from "@/lib/client";
import InfoBox from "@/components/InfoBox";
import SignaturePad from "@/components/SignaturePad";
import ConsentAgreement from "@/components/ConsentAgreement";

const money = (n) => Number(n || 0).toLocaleString("th-TH");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const PAY_METHODS = [{ value: "cash", label: "เงินสด" }, { value: "transfer", label: "โอน" }, { value: "card", label: "บัตร" }];
const STATUS_TH = {
  booked: ["จองแล้ว", "secondary"], arrived: ["มาถึง", "info"], ready: ["พร้อมทำ", "primary"],
  consulting: ["ปรึกษาหมอ", "warning"], bt_stage: ["BT ทำ", "warning"], doctor_stage: ["หมอทำ", "danger"],
  done: ["เสร็จ", "success"], cancelled: ["ยกเลิก", "dark"], no_show: ["ไม่มา", "dark"],
};
const SBadge = ({ s }) => { const [l, c] = STATUS_TH[s] || [s, "light"]; return <span className={`badge text-bg-${c}`}>{l}</span>; };

export default function OpdPage() {
  const auth = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const toast = {
    success: (m) => dispatch(pushToast({ type: "success", message: m })),
    error: (m) => dispatch(pushToast({ type: "error", message: m })),
  };
  const branch_ID = auth.branch_ID;
  const [date, setDate] = useState(todayStr());
  const [reserves, setReserves] = useState([]);
  const [opds, setOpds] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then(setReserves).catch(() => {});
    api(`/opd?branch_ID=${branch_ID}&date=${date}`).then(setOpds).catch(() => {});
    api(`/rooms?branch_ID=${branch_ID}`).then(setRooms).catch(() => {});
  }, [branch_ID, date]);
  useEffect(load, [load]);

  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;
  const myRole = auth.user?.role;
  const isStaffOnly = ["doctor", "BT"].includes(myRole);
  const visible = reserves.filter((r) => {
    if (["cancelled", "no_show"].includes(r.status)) return false;
    if (myRole === "doctor") return r.doctor_ID === auth.user.user_ID;
    if (myRole === "BT") return !r.BT_ID || r.BT_ID === auth.user.user_ID;
    return true;
  }).sort((a, b) => (a.time_start || "").localeCompare(b.time_start || ""));

  const FILTERS = [
    { key: "all", label: "ทั้งหมด", ico: "bi-collection", color: "primary", match: () => true },
    { key: "waiting", label: "รอทำ", ico: "bi-hourglass-split", color: "secondary", match: (s) => ["booked", "arrived", "ready"].includes(s) },
    { key: "consulting", label: "ปรึกษาหมอ", ico: "bi-chat-square-dots", color: "warning", match: (s) => s === "consulting" },
    { key: "bt", label: "BT ทำ", ico: "bi-person-heart", color: "info", match: (s) => s === "bt_stage" },
    { key: "doctor", label: "หมอทำ", ico: "bi-heart-pulse", color: "danger", match: (s) => s === "doctor_stage" },
    { key: "done", label: "เสร็จ", ico: "bi-check2-circle", color: "success", match: (s) => s === "done" },
  ];
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, visible.filter((r) => f.match(r.status)).length]));
  const q = search.trim().toLowerCase();
  const rows = visible.filter((r) => {
    if (!FILTERS.find((f) => f.key === filter).match(r.status)) return false;
    if (q && !`${r.contact?.nick_name || ""} ${r.HN_number || ""} ${roomName(r.room_ID)}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const openCase = async (r) => {
    try {
      const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: r.HN_number } });
      toast.success("เปิดเคสแล้ว");
      load(); setActive(o);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        {/* หัว + info-box (คลิก = filter) */}
        <div className="d-flex align-items-center mb-2 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">OPD / หน้าห้อง</h4>
          <input type="date" className="form-control form-control-sm ms-auto" style={{ width: 150 }}
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row g-2 mb-3">
          {FILTERS.map((f) => (
            <div className="col-xl-2 col-md-4 col-6" key={f.key}>
              <InfoBox ico={f.ico} label={f.label} value={counts[f.key]} color={f.color}
                       active={filter === f.key} onClick={() => setFilter(f.key)} />
            </div>
          ))}
        </div>

        <div className="row g-3">
          {/* ซ้าย: inbox คิว */}
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header py-2">
                <input className="form-control form-control-sm" placeholder="🔎 ค้นหา HN / ชื่อ / ห้อง"
                       value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="list-group list-group-flush" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                {rows.length === 0 && <div className="list-group-item text-center text-muted py-4">— ไม่มีคิว —</div>}
                {rows.map((r) => {
                  const opd = opds.find((o) => o.opd_ID === r.opd_ID);
                  const sel = active?.opd_ID && active.opd_ID === r.opd_ID;
                  return (
                    <div key={r.reserve_ID}
                         className={`list-group-item list-group-item-action d-flex gap-2 align-items-center ${sel ? "active" : ""}`}
                         style={{ cursor: r.opd_ID ? "pointer" : "default" }}
                         onClick={() => r.opd_ID && setActive(opd)}>
                      <div className="text-center" style={{ minWidth: 46 }}>
                        <b>{r.time_start}</b>
                        <div style={{ fontSize: 10 }} className={sel ? "" : "text-muted"}>{roomName(r.room_ID)}</div>
                      </div>
                      <div className="min-w-0 flex-grow-1">
                        <div className="fw-semibold text-truncate">
                          {r.contact?.nick_name || "ลูกค้าใหม่"}
                          {r.is_walk_in && <span className={`ms-1 small ${sel ? "" : "text-muted"}`}>· Walk-in</span>}
                        </div>
                        <div className={`small ${sel ? "" : "text-muted"}`} style={{ fontSize: 11 }}>{r.HN_number || "ยังไม่มี HN"}</div>
                        <SBadge s={r.status} />
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        {r.opd_ID ? (
                          <button className={`btn btn-sm ${sel ? "btn-light" : "btn-outline-primary"}`} onClick={() => setActive(opd)}>
                            {opd?.status === "closed" ? "ดู" : "ทำต่อ"}
                          </button>
                        ) : isStaffOnly ? <span className="small text-muted">รอเปิด</span>
                          : r.HN_number ? (
                            <button className="btn btn-primary btn-sm" onClick={() => openCase(r)}>เปิดเคส</button>
                          ) : <a className="btn btn-outline-secondary btn-sm" href="/app/reception">+HN</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ขวา: เคส */}
          <div className="col-lg-8">
            {active ? (
              <CaseEditor opd_ID={active.opd_ID} auth={auth} toast={toast}
                          onChanged={load} onClose={() => { setActive(null); load(); }} />
            ) : (
              <div className="card shadow-sm"><div className="card-body text-center text-muted py-5">
                <i className="bi bi-clipboard2-pulse fs-1 d-block mb-2" />เลือกคิวจากด้านซ้ายเพื่อดู/ทำเคส
              </div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ปุ่มกดแล้วรอ (กันกดซ้ำ + toast error) ──
function ABtn({ className = "btn btn-primary", disabled, onClick, ok, toast, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className={className} disabled={disabled || busy} onClick={async () => {
      setBusy(true);
      try { await onClick(); if (ok) toast.success(ok); }
      catch (e) { toast.error(e.message || "ไม่สำเร็จ"); }
      finally { setBusy(false); }
    }}>
      {busy ? <span className="spinner-border spinner-border-sm me-1" /> : null}{children}
    </button>
  );
}

// ── รับชำระเต็มจำนวน แยกหลายช่องทาง ──
function SplitPay({ due, confirmLabel, ok, toast, onConfirm }) {
  const [lines, setLines] = useState([{ method: "cash", amount: String(due || "") }]);
  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remain = due - sum;
  const ready = due > 0 && sum === due;
  return (
    <div className="border-top pt-2 mt-2">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted small">ชำระ (เต็มจำนวน)</span>
        <b className="fs-5">{money(due)}฿</b>
      </div>
      {lines.map((l, i) => (
        <div className="d-flex gap-2 mb-1" key={i}>
          <select className="form-select form-select-sm" value={l.method}
                  onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}>
            {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input type="number" className="form-control form-control-sm" value={l.amount} placeholder="0"
                 onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
          {lines.length > 1
            ? <button className="btn btn-outline-danger btn-sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button>
            : <span style={{ width: 32 }} />}
        </div>
      ))}
      <div className="d-flex align-items-center">
        <button className="btn btn-link btn-sm p-0" onClick={() => setLines((ls) => [...ls, { method: "cash", amount: remain > 0 ? String(remain) : "" }])}>+ เพิ่มช่องทาง</button>
        <span className={`badge ms-auto ${sum === due ? "text-bg-success" : "text-bg-warning"}`}>
          รับ {money(sum)} / {money(due)}฿{sum === due ? " ✓" : ` · เหลือ ${money(remain)}`}
        </span>
      </div>
      <ABtn className="btn btn-primary d-block ms-auto px-4 mt-2" disabled={!ready} ok={ok} toast={toast}
            onClick={() => onConfirm(lines.map((l) => ({ amount: Number(l.amount) || 0, method: l.method })).filter((l) => l.amount > 0))}>
        {confirmLabel}
      </ABtn>
    </div>
  );
}

// ── การ์ดขั้นตอน (หัวข้อ + สถานะ + dim เมื่อยังไม่ถึง) ──
function StepCard({ ico, title, badge, dim, borderColor, children }) {
  return (
    <div className={`card shadow-sm mb-3 ${borderColor ? "border-" + borderColor : ""}`} style={{ opacity: dim ? 0.6 : 1 }}>
      <div className="card-header py-2 d-flex align-items-center">
        <span className="fw-semibold"><i className={`bi ${ico} me-1 text-primary`} />{title}</span>
        <span className="ms-auto">{badge}</span>
      </div>
      <div className="card-body py-3">{children}</div>
    </div>
  );
}

function CaseEditor({ opd_ID, auth, toast, onChanged, onClose }) {
  const [opd, setOpd] = useState(null);
  const [cc, setCc] = useState(null);
  const [bts, setBts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [products, setProducts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [custCourses, setCustCourses] = useState([]);
  const [sales, setSales] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [vitals, setVitals] = useState({ blood_pressure: "", heart_rate: "", weight_kg: "", height_cm: "", fat_mass: "", muscle_mass: "", other: "" });
  const [addon, setAddon] = useState({ product_ID: "", medical_procedure_ID: "", qty: 1, method: "cash", recommended_by: "" });
  const [sell, setSell] = useState({ mode: "new", course_ID: "", existing_id: "" });
  const [priceOv, setPriceOv] = useState("");
  const [signMode, setSignMode] = useState(false);
  const [viewConsent, setViewConsent] = useState(null);
  const [customer, setCustomer] = useState(null); // ใช้เติมข้อมูลในหนังสือยินยอม
  const [company, setCompany] = useState(null);

  const reload = useCallback(async () => {
    const o = await api(`/opd/${opd_ID}`);
    setOpd(o);
    if (o.opd_data?.measured_at) setVitals((v) => ({ ...v, ...o.opd_data }));
    const list = await api(`/customer-courses?HN=${o.HN_number}`);
    setCc(list.find((x) => x.customer_course_ID === o.customer_course_ID) || null);
    setCustCourses(list.filter((x) => x.status === "active"));
  }, [opd_ID]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!opd?.HN_number) return;
    api(`/customers/${encodeURIComponent(opd.HN_number)}`).then((r) => setCustomer(r.customer)).catch(() => {});
    api("/setup/state").then((s) => setCompany(s.company)).catch(() => {});
  }, [opd?.HN_number]);

  useEffect(() => {
    if (!opd?.branch_ID) return;
    const b = opd.branch_ID;
    api(`/stock/summary?branch_ID=${b}`).then(setStockRows).catch(() => setStockRows([]));
    api(`/users?role=BT&branch_ID=${b}`).then(setBts).catch(() => {});
    api(`/users?role=doctor&branch_ID=${b}`).then(setDoctors).catch(() => {});
    api(`/users?role=sale&branch_ID=${b}`).then(setSales).catch(() => {});
    api(`/procedures?branch_ID=${b}`).then(setProcedures).catch(() => {});
    api(`/products?branch_ID=${b}`).then((p) => setProducts(p.filter((x) => x.active))).catch(() => {});
    api(`/courses?branch_ID=${b}`).then((c) => setCourses(c.filter((x) => x.active))).catch(() => {});
  }, [opd?.branch_ID]);

  if (!opd) return <div className="card shadow-sm"><div className="card-body text-center py-5"><span className="spinner-border text-primary" /></div></div>;

  const snap = cc?.course_snapshot;
  const canManage = ["super_admin", "admin"].includes(auth.user.role); // V3: admin ทำ OPD ครบ
  const isClosed = opd.status === "closed";
  const measured = !!opd.opd_data?.measured_at;
  const hasCourse = !!cc;
  const paid = hasCourse && (cc.balance_due || 0) <= 0;
  const paidReady = hasCourse && paid;
  const hasConsent = (opd.consents || []).length > 0;

  const stockNeed = (snap?.products || []).map((p) => {
    const row = stockRows.find((r) => r.product?.product_ID === p.product_ID);
    const need = p.sub_unit_per_use || 0;
    const have = row?.total_cc_remaining || 0;
    return { product_ID: p.product_ID, name: row?.product?.name || p.product_ID, need, have, ok: have >= need };
  });
  const stockOk = stockNeed.every((s) => s.ok);
  const canTreat = paidReady && stockOk;
  const hasBT = (snap?.BT_procedures || []).length > 0;
  const hasDr = (snap?.doctor_procedures || []).length > 0;
  const btDone = (opd.procedures_done || []).some((p) => p.type === "BT");
  const drDone = (opd.procedures_done || []).some((p) => p.type === "doctor");
  const firstVisit = opd.session_no === 1;
  const isAdmin = canManage;
  const userMap = Object.fromEntries([...bts, ...doctors, ...sales].map((u) => [u.user_ID, u.full_name]));

  const sellCourse = sell.mode === "new" ? courses.find((c) => c.course_ID === sell.course_ID) : null;
  const sellExisting = sell.mode === "existing" ? custCourses.find((c) => c.customer_course_ID === sell.existing_id) : null;
  const dueAmount = sell.mode === "new"
    ? (priceOv !== "" ? Number(priceOv) || 0 : (sellCourse?.price || 0))
    : (sellExisting?.balance_due || 0);
  const courseChosen = sell.mode === "new" ? !!sell.course_ID : !!sell.existing_id;

  // ---- actions (API เดิมทั้งหมด) ----
  const setSaleId = async (id) => { await api(`/opd/${opd_ID}`, { method: "PUT", body: { sale_ID: id || null } }); reload(); };
  const assign = async (field, value) => { await api(`/opd/${opd_ID}`, { method: "PUT", body: { [field]: value } }); reload(); };
  const startConsult = async () => { await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "start", doctor_ID: opd.doctor_ID || null } }); reload(); };
  const consultOk = async () => { await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "ok" } }); reload(); };
  const consultNoSale = async () => { await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "no_sale" } }); toast.success("ปิดเคส: ปรึกษาแล้วไม่ซื้อ"); onClose(); };
  const attachCourse = async (payments) => {
    const body = sell.mode === "existing"
      ? { existing_customer_course_ID: sell.existing_id, payments }
      : { course_ID: sell.course_ID, payments, ...(priceOv !== "" ? { price_override: Number(priceOv) } : {}) };
    await api(`/opd/${opd_ID}/course`, { method: "POST", body });
    setSell({ mode: "new", course_ID: "", existing_id: "" }); setPriceOv("");
    reload(); onChanged();
  };
  const payLinked = async (payments) => { await api(`/customer-courses/${cc.customer_course_ID}/pay`, { method: "POST", body: { payments } }); reload(); };
  const saveVitals = async () => {
    await api(`/opd/${opd_ID}`, { method: "PUT", body: { opd_data: { ...vitals, heart_rate: +vitals.heart_rate || 0, weight_kg: +vitals.weight_kg || 0, height_cm: +vitals.height_cm || 0, fat_mass: +vitals.fat_mass || 0, muscle_mass: +vitals.muscle_mass || 0 } } });
    reload(); onChanged();
  };
  const recordStage = async (type) => {
    const list = type === "BT" ? snap?.BT_procedures : snap?.doctor_procedures;
    const performer = type === "BT" ? opd.BT_ID : opd.doctor_ID;
    const done = (opd.procedures_done || []).filter((p) => p.type !== type);
    for (const p of list || []) {
      const mp = procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID);
      if (mp && performer) done.push({ medical_procedure_ID: mp.medical_procedure_ID, name: mp.name, type, performed_by: performer, cost: mp.cost });
    }
    await api(`/opd/${opd_ID}`, { method: "PUT", body: { procedures_done: done, status: type === "BT" ? "bt_stage" : "doctor_stage" } });
    reload(); onChanged();
  };
  const doAddon = async () => {
    const p = products.find((x) => x.product_ID === addon.product_ID);
    const mp = procedures.find((x) => x.medical_procedure_ID === addon.medical_procedure_ID);
    if (!p && !mp) return toast.error("เลือกสินค้าหรือหัตถการก่อน");
    const price = (p?.selling_price || 0) * (addon.qty || 1);
    const items = [p && `${p.name} ×${addon.qty}`, mp && `หัตถการ ${mp.name}`].filter(Boolean).join(" + ");
    const bill = firstVisit ? `บวกเข้ายอดคอร์ส ${price > 0 ? `+${money(price)}฿` : ""}` : (price > 0 ? `เก็บเงินทันที ${money(price)}฿` : "");
    if (!window.confirm(`Add-on: ${items}\n${bill}\nยืนยัน?`)) return;
    await api(`/opd/${opd_ID}/addon`, { method: "POST", body: addon });
    setAddon({ product_ID: "", medical_procedure_ID: "", qty: 1, method: "cash", recommended_by: "" });
    reload();
  };
  const doClose = async () => {
    const res = await api(`/opd/${opd_ID}/close`, { method: "POST" });
    toast.success(`ปิดเคสสำเร็จ · ตัด stock ${res.stock_used.length} รายการ · เหลือ ${res.uses_remaining} ครั้ง`);
    onClose();
  };
  // consent
  const uploadConsent = (file) => new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error("ไฟล์ใหญ่เกิน 5MB"));
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api(`/opd/${opd_ID}/consent`, { method: "POST", body: { kind: "upload", file: reader.result, filename: file.name, mime: file.type } });
        toast.success("แนบใบยินยอมแล้ว"); reload(); resolve();
      } catch (e) { toast.error(e.message); reject(e); }
    };
    reader.readAsDataURL(file);
  });
  const signConsent = async (dataURL) => {
    await api(`/opd/${opd_ID}/consent`, { method: "POST", body: { kind: "signature", file: dataURL, filename: `signature-${opd.HN_number}.png`, mime: "image/png" } });
    toast.success("บันทึกลายเซ็นแล้ว"); setSignMode(false); reload();
  };

  // vitals validation
  const vErr = {};
  if (vitals.weight_kg && (+vitals.weight_kg < 20 || +vitals.weight_kg > 300)) vErr.weight_kg = "20–300";
  if (vitals.height_cm && (+vitals.height_cm < 80 || +vitals.height_cm > 250)) vErr.height_cm = "80–250";
  if (vitals.heart_rate && (+vitals.heart_rate < 30 || +vitals.heart_rate > 220)) vErr.heart_rate = "30–220";
  if (vitals.blood_pressure && !/^\d{2,3}\/\d{2,3}$/.test(vitals.blood_pressure)) vErr.blood_pressure = "เช่น 120/80";
  const hasVErr = Object.keys(vErr).length > 0;

  // timeline เหตุการณ์เคส
  const timeline = [
    { at: opd.created_at, ico: "bi-folder-plus", color: "primary", label: `เปิดเคส · ครั้งที่ ${opd.session_no}` },
    opd.opd_data?.measured_at && { at: opd.opd_data.measured_at, ico: "bi-rulers", color: "info", label: `วัดตัว (โดย ${userMap[opd.opd_data.measured_by] || opd.opd_data.measured_by || "-"})` },
    ...(opd.consents || []).map((c) => ({ at: c.uploaded_at, ico: c.kind === "signature" ? "bi-pen" : "bi-file-earmark-check", color: "success", label: c.kind === "signature" ? "เซ็นใบยินยอมบนจอ" : `แนบใบยินยอม (${c.filename || "ไฟล์"})` })),
    opd.closed_at && { at: opd.closed_at, ico: "bi-lock", color: "dark", label: "ปิดเคส" },
  ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));

  // step-chip แสดง flow
  const steps = [
    { k: "open", l: "เปิดเคส", on: true },
    { k: "measure", l: "วัดตัว", on: measured },
    { k: "pay", l: "คอร์ส+ชำระ", on: paidReady },
    { k: "consent", l: "ใบยินยอม", on: hasConsent },
    ...(hasBT ? [{ k: "bt", l: "BT", on: btDone }] : []),
    ...(hasDr ? [{ k: "dr", l: "หมอ", on: drDone }] : []),
    { k: "close", l: "ปิดเคส", on: isClosed },
  ];

  const addonCard = (
    <StepCard ico="bi-plus-circle" title={`Add-on ${firstVisit ? "(ครั้งแรก = รวมบิลคอร์ส)" : "(แยกบิลเก็บทันที)"}`}
              badge={opd.add_ons?.length ? <span className="badge text-bg-info">{opd.add_ons.length} รายการ</span> : null}>
      {!isClosed && (
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">สินค้า (ตัด stock + คิดเงิน)</label>
            <select className="form-select form-select-sm" value={addon.product_ID} onChange={(e) => setAddon((f) => ({ ...f, product_ID: e.target.value }))}>
              <option value="">— ไม่มี —</option>
              {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name} · {money(p.selling_price)}฿</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">จำนวน</label>
            <input type="number" min={1} className="form-control form-control-sm" value={addon.qty} onChange={(e) => setAddon((f) => ({ ...f, qty: +e.target.value }))} />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">หัตถการ (ค่ามือ→BT/หมอ)</label>
            <select className="form-select form-select-sm" value={addon.medical_procedure_ID} onChange={(e) => setAddon((f) => ({ ...f, medical_procedure_ID: e.target.value }))}>
              <option value="">— ไม่มี —</option>
              {procedures.map((mp) => <option key={mp.medical_procedure_ID} value={mp.medical_procedure_ID}>{mp.name} · {money(mp.cost)}฿</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">คนแนะ (คิดคอม)</label>
            <select className="form-select form-select-sm" value={addon.recommended_by} onChange={(e) => setAddon((f) => ({ ...f, recommended_by: e.target.value }))}>
              <option value="">— ไม่ระบุ —</option>
              {sales.map((s) => <option key={s.user_ID} value={s.user_ID}>Sale: {s.full_name}</option>)}
              {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>หมอ: {d.full_name}</option>)}
            </select>
          </div>
          {!firstVisit && (
            <div className="col-md-3">
              <label className="form-label small mb-1">ช่องทางเก็บเงิน</label>
              <select className="form-select form-select-sm" value={addon.method} onChange={(e) => setAddon((f) => ({ ...f, method: e.target.value }))}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-3">
            <ABtn className="btn btn-outline-primary btn-sm d-block ms-auto px-4" disabled={!addon.product_ID && !addon.medical_procedure_ID}
                  toast={toast} onClick={doAddon}>
              {firstVisit ? "+ เพิ่มลงบิลคอร์ส" : "+ add-on (เก็บเงิน)"}
            </ABtn>
          </div>
        </div>
      )}
      {opd.add_ons?.length > 0 && (
        <ul className="list-group list-group-flush mt-2">
          {opd.add_ons.map((a, i) => (
            <li className="list-group-item px-0 py-2 d-flex align-items-center gap-2 flex-wrap" key={i}>
              <span>{a.product_ID ? `${a.name} ×${a.qty}` : a.name}</span>
              {a.medical_procedure_ID && <span className="badge text-bg-info">💉 {a.proc_name} · {money(a.proc_cost)}฿</span>}
              {a.first_visit && <span className="badge text-bg-light border">รวมบิลคอร์ส</span>}
              {a.recommended_by && <span className="text-muted small">แนะโดย {userMap[a.recommended_by] || a.recommended_by}</span>}
              <b className="ms-auto">{a.price > 0 ? `${money(a.price)}฿` : "—"}</b>
            </li>
          ))}
        </ul>
      )}
    </StepCard>
  );

  return (
    <div>
      {/* หัวเคส + step chips */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <h5 className="fw-bold mb-0">{snap?.name || "เคส"}</h5>
            <span className="badge text-bg-primary">{opd.HN_number}</span>
            <span className="badge text-bg-light border">ครั้งที่ {opd.session_no}</span>
            <span className="ms-auto"><SBadge s={opd.status} /></span>
          </div>
          {cc && (
            <div className="text-muted small mb-2">
              เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง
              {cc.balance_due > 0 && <span className="text-danger"> · ค้างชำระ {money(cc.balance_due)}฿</span>}
              {cc.expires_at && <> · หมดอายุ {String(cc.expires_at).slice(0, 10)}</>}
            </div>
          )}
          <div className="d-flex flex-wrap gap-1">
            {steps.map((s, i) => (
              <span key={s.k} className={`badge rounded-pill ${s.on ? "text-bg-success" : "text-bg-light border text-muted"}`}>
                {s.on ? "✓ " : `${i + 1}. `}{s.l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 1. วัดตัว + sale ดูแลเคส */}
      {!isClosed && (
        <StepCard ico="bi-rulers" title="วัดตัว + Sale ดูแลเคส"
                  badge={measured ? <span className="badge text-bg-success">วัดแล้ว ✓</span> : <span className="badge text-bg-warning">บังคับก่อนทำหัตถการ</span>}>
          {!paid ? (
            <div className="mb-2" style={{ maxWidth: 360 }}>
              <label className="form-label small mb-1">Sale ที่คุย/ดูแลเคส (คิดคอม)</label>
              <select className="form-select form-select-sm" value={opd.sale_ID || ""} onChange={(e) => setSaleId(e.target.value)}>
                <option value="">— ยังไม่ระบุ —</option>
                {sales.map((s) => <option key={s.user_ID} value={s.user_ID}>{s.full_name}</option>)}
              </select>
            </div>
          ) : opd.sale_ID ? <div className="text-muted small mb-2">Sale ดูแลเคส: <b>{userMap[opd.sale_ID] || opd.sale_ID}</b></div> : null}
          <div className="row g-2">
            {[["blood_pressure", "ความดัน", "text"], ["heart_rate", "ชีพจร", "number"], ["weight_kg", "น้ำหนัก (kg)", "number"], ["height_cm", "ส่วนสูง (cm)", "number"], ["fat_mass", "มวลไขมัน", "number"], ["muscle_mass", "มวลกล้ามเนื้อ", "number"]].map(([k, lb, type]) => (
              <div className="col-md-4 col-6" key={k}>
                <label className="form-label small mb-1">{lb}</label>
                <input type={type} className={`form-control form-control-sm ${vErr[k] ? "is-invalid" : ""}`} disabled={isClosed}
                       value={vitals[k]} onChange={(e) => setVitals((v) => ({ ...v, [k]: e.target.value }))} />
                {vErr[k] && <div className="invalid-feedback">{vErr[k]}</div>}
              </div>
            ))}
          </div>
          <ABtn className="btn btn-primary btn-sm mt-3" disabled={hasVErr} ok="บันทึกการวัดตัวแล้ว" toast={toast} onClick={saveVitals}>
            บันทึกการวัดตัว {measured && "✓"}
          </ABtn>
        </StepCard>
      )}

      {/* 2. ปรึกษาหมอ (ครั้งแรก ก่อนจ่าย) */}
      {!isClosed && !paid && opd.session_no <= 1 && (
        <StepCard ico="bi-chat-square-dots" title="ปรึกษาหมอก่อนชำระ (เลือกได้)"
                  badge={<span className={`badge ${opd.status === "consulting" ? "text-bg-warning" : "text-bg-light border text-muted"}`}>{opd.status === "consulting" ? "กำลังปรึกษา" : "ครั้งแรก"}</span>}>
          {opd.status === "consulting" ? (
            <div className="alert alert-warning py-2 mb-0">
              <b>กำลังปรึกษาหมอ{opd.consult_doctor_ID ? ` (${userMap[opd.consult_doctor_ID] || ""})` : ""}</b>
              <div className="d-flex gap-2 mt-2">
                <ABtn className="btn btn-primary btn-sm" ok="ลูกค้าตกลงซื้อ" toast={toast} onClick={consultOk}>✓ ตกลงซื้อ (ไปชำระ)</ABtn>
                <ABtn className="btn btn-outline-secondary btn-sm" toast={toast} onClick={consultNoSale}>✕ ไม่ซื้อ — ปิดเคส</ABtn>
              </div>
            </div>
          ) : opd.consulted ? (
            <div className="text-success small">✓ ปรึกษาแล้ว — ลูกค้าตกลงซื้อ ชำระเงินการ์ดถัดไป</div>
          ) : (
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div style={{ minWidth: 220 }}>
                <label className="form-label small mb-1">หมอที่ปรึกษา</label>
                <select className="form-select form-select-sm" value={opd.doctor_ID || ""} onChange={(e) => assign("doctor_ID", e.target.value || null)}>
                  <option value="">— เลือกหมอ —</option>
                  {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
                </select>
              </div>
              <ABtn className="btn btn-outline-primary btn-sm" disabled={!opd.doctor_ID} ok="ส่งปรึกษาหมอแล้ว" toast={toast} onClick={startConsult}>ส่งปรึกษาหมอ</ABtn>
              <span className="text-muted small">ไม่ต้องปรึกษาก็ชำระเงินได้เลย</span>
            </div>
          )}
        </StepCard>
      )}

      {/* 3. คอร์ส + ชำระเงิน */}
      {!isClosed && opd.status !== "consulting" && (
        <StepCard ico="bi-credit-card" title="คอร์ส + ชำระเงิน"
                  borderColor={!paidReady ? "danger" : undefined}
                  badge={paidReady ? <span className="badge text-bg-success">ชำระครบ ✓</span> : <span className="badge text-bg-danger">ต้องเลือกคอร์ส + รับเงิน</span>}>
          {!hasCourse ? (
            <>
              <div className="btn-group btn-group-sm mb-2">
                <button className={`btn ${sell.mode === "new" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setSell({ mode: "new", course_ID: "", existing_id: "" })}>ขายคอร์สใหม่</button>
                <button className={`btn ${sell.mode === "existing" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setSell({ mode: "existing", course_ID: "", existing_id: "" })}>คอร์สเดิม ({custCourses.length})</button>
              </div>
              {sell.mode === "new" ? (
                <select className="form-select form-select-sm mb-2" value={sell.course_ID} onChange={(e) => setSell((s) => ({ ...s, course_ID: e.target.value }))}>
                  <option value="">— เลือกคอร์ส —</option>
                  {courses.map((c) => <option key={c.course_ID} value={c.course_ID}>{c.name} · {money(c.price)}฿ · {c.quantity_used} ครั้ง</option>)}
                </select>
              ) : (
                <select className="form-select form-select-sm mb-2" value={sell.existing_id} onChange={(e) => setSell((s) => ({ ...s, existing_id: e.target.value }))}>
                  <option value="">— เลือกคอร์สเดิม —</option>
                  {custCourses.map((c) => <option key={c.customer_course_ID} value={c.customer_course_ID}>{c.course_snapshot?.name} · เหลือ {c.uses_remaining}/{c.uses_total}{c.balance_due > 0 ? ` · ค้าง ${money(c.balance_due)}฿` : " · จ่ายครบ"}</option>)}
                </select>
              )}
              {sell.mode === "new" && sell.course_ID && isAdmin && (
                <div className="mb-2" style={{ maxWidth: 280 }}>
                  <label className="form-label small mb-1">ปรับราคาหน้างาน (ว่าง = {money(sellCourse?.price || 0)}฿)</label>
                  <input type="number" className="form-control form-control-sm" value={priceOv} placeholder={String(sellCourse?.price || 0)} onChange={(e) => setPriceOv(e.target.value)} />
                </div>
              )}
              {sell.mode === "new" && courseChosen && dueAmount > 0 && (
                <>
                  <ABtn className="btn btn-outline-primary d-block ms-auto px-4 btn-sm" ok="เลือกคอร์สแล้ว — เพิ่ม add-on แล้วจ่ายรวม" toast={toast} onClick={() => attachCourse([])}>
                    เลือกคอร์สนี้ (ยังไม่จ่าย · เพิ่ม add-on ก่อน แล้วจ่ายรวม)
                  </ABtn>
                  <div className="text-center text-muted small my-1">— หรือจ่ายเต็มทันที —</div>
                  <SplitPay key={`new:${sell.course_ID}:${dueAmount}`} due={dueAmount} toast={toast}
                            confirmLabel="จ่ายเต็มทันที" ok="เลือกคอร์ส + รับเงินครบแล้ว" onConfirm={attachCourse} />
                </>
              )}
              {sell.mode === "existing" && courseChosen && dueAmount > 0 && (
                <SplitPay key={`ex:${sell.existing_id}:${dueAmount}`} due={dueAmount} toast={toast}
                          confirmLabel="ยืนยัน (จ่ายเต็มจำนวน)" ok="รับเงินครบแล้ว" onConfirm={attachCourse} />
              )}
              {courseChosen && dueAmount === 0 && (
                <ABtn className="btn btn-primary d-block ms-auto px-4 btn-sm" ok="เลือกคอร์สแล้ว" toast={toast} onClick={() => attachCourse([])}>ยืนยันเลือกคอร์ส (จ่ายครบแล้ว)</ABtn>
              )}
            </>
          ) : cc.balance_due > 0 ? (
            <>
              <div><b>{cc.course_snapshot?.name}</b> · เหลือ {cc.uses_remaining}/{cc.uses_total} · จ่ายแล้ว {money(cc.paid_amount)}/{money(cc.total_price)}฿
                <span className="badge text-bg-danger ms-2">ค้าง {money(cc.balance_due)}฿</span></div>
              <SplitPay key={cc.customer_course_ID} due={cc.balance_due} toast={toast}
                        confirmLabel="รับชำระ (เต็มจำนวน)" ok="รับชำระครบแล้ว" onConfirm={payLinked} />
            </>
          ) : (
            <div><b>{cc.course_snapshot?.name}</b> · เหลือ {cc.uses_remaining}/{cc.uses_total} · จ่ายแล้ว {money(cc.paid_amount)}฿
              <span className="badge text-bg-success ms-2">ชำระครบ ✓</span></div>
          )}
        </StepCard>
      )}

      {/* add-on ครั้งแรก ติดใต้ชำระเงิน */}
      {firstVisit && !isClosed && hasCourse && addonCard}

      {/* 4. ใบยินยอม (V3 — บังคับก่อนปิดเคส ทุกเคส) */}
      <StepCard ico="bi-file-earmark-medical" title="ใบยินยอมการทำหัตถการ"
                borderColor={!hasConsent && !isClosed ? "warning" : undefined}
                badge={hasConsent ? <span className="badge text-bg-success">แนบแล้ว {opd.consents.length} ใบ ✓</span> : <span className="badge text-bg-warning">ยังไม่แนบ — บังคับก่อนปิดเคส</span>}>
        {!isClosed && (
          <div className="d-flex gap-2 flex-wrap mb-2">
            <label className="btn btn-outline-primary btn-sm mb-0">
              <i className="bi bi-upload me-1" /> อัปโหลดสแกน/รูป (≤5MB)
              <input type="file" accept="application/pdf,image/*" hidden
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadConsent(f).catch(() => {}); e.target.value = ""; }} />
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => setSignMode(true)}>
              <i className="bi bi-pen me-1" /> ให้ลูกค้าอ่าน + เซ็นบนจอ (iPad)
            </button>
            <a className="btn btn-outline-secondary btn-sm"
               href={`/app/consent-form?hn=${encodeURIComponent(opd.HN_number)}&course=${encodeURIComponent(snap?.name || "")}`}
               target="_blank" rel="noreferrer">
              <i className="bi bi-printer me-1" /> พิมพ์กระดาษ
            </a>
          </div>
        )}
        {signMode && !isClosed && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)" }}>
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <b><i className="bi bi-file-earmark-medical me-2 text-primary" />หนังสือยินยอมทำหัตถการ — ให้ลูกค้าอ่านแล้วเซ็นด้านล่าง</b>
                  <button className="btn-close" onClick={() => setSignMode(false)} />
                </div>
                <div className="modal-body">
                  <ConsentAgreement customer={customer} procedure={snap?.name || ""} company={company} />
                  <div className="border-top pt-3 mt-3" style={{ maxWidth: 560, margin: "0 auto" }}>
                    <div className="text-muted small mb-1"><i className="bi bi-pen me-1" />ลูกค้าเซ็นชื่อ (ผู้ให้ความยินยอม/ผู้ใช้บริการ) ในกรอบ แล้วกด "ใช้ลายเซ็นนี้"</div>
                    <SignaturePad height={170} onConfirm={signConsent} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {(opd.consents || []).length > 0 ? (
          <ul className="list-group list-group-flush">
            {opd.consents.map((c, i) => (
              <li className="list-group-item px-0 py-2 d-flex align-items-center gap-2" key={i}>
                <i className={`bi ${c.kind === "signature" ? "bi-pen" : "bi-file-earmark-check"} text-success`} />
                <span className="small">{c.kind === "signature" ? "ลายเซ็นบนจอ" : (c.filename || "ไฟล์แนบ")}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>{new Date(c.uploaded_at).toLocaleString("th-TH")} · {(c.size / 1024).toFixed(0)}KB</span>
                <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setViewConsent(c)}>ดู</button>
                {!isClosed && (
                  <ABtn className="btn btn-outline-danger btn-sm" toast={toast}
                        onClick={async () => { if (confirm("ลบใบยินยอมนี้?")) { await api(`/opd/${opd_ID}/consent?index=${i}`, { method: "DELETE" }); reload(); } }}>×</ABtn>
                )}
              </li>
            ))}
          </ul>
        ) : <div className="text-muted small">— ยังไม่มีใบยินยอม — แนบทุกครั้งที่เปิดเคส แม้เป็นคอร์สเดิม</div>}
      </StepCard>

      {/* ดูไฟล์ consent */}
      {viewConsent && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,.5)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setViewConsent(null); }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <b>{viewConsent.filename || "ใบยินยอม"}</b>
                <a className="btn btn-outline-primary btn-sm ms-auto me-2" href={viewConsent.file} download={viewConsent.filename || "consent"}>
                  <i className="bi bi-download me-1" /> ดาวน์โหลด
                </a>
                <button className="btn-close" onClick={() => setViewConsent(null)} />
              </div>
              <div className="modal-body text-center" style={{ maxHeight: "75vh", overflow: "auto" }}>
                {viewConsent.mime === "application/pdf"
                  ? <iframe src={viewConsent.file} title="consent" style={{ width: "100%", height: "70vh", border: 0 }} />
                  : <img src={viewConsent.file} alt="consent" style={{ maxWidth: "100%" }} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. สต๊อกของคอร์ส */}
      {!isClosed && hasCourse && stockNeed.length > 0 && (
        <StepCard ico="bi-box-seam" title="สต๊อกสำหรับคอร์สนี้"
                  borderColor={stockOk ? undefined : "danger"}
                  badge={stockOk ? <span className="badge text-bg-success">พอ ✓</span> : <span className="badge text-bg-danger">ไม่พอ</span>}>
          <table className="table table-sm mb-0">
            <thead className="table-light"><tr><th>สินค้า</th><th className="text-end">ต้องใช้</th><th className="text-end">คงเหลือ</th><th /></tr></thead>
            <tbody>
              {stockNeed.map((s) => (
                <tr key={s.product_ID}>
                  <td>{s.name}</td><td className="text-end">{s.need}</td><td className="text-end">{s.have}</td>
                  <td>{s.ok ? <span className="badge text-bg-success">✓</span> : <span className="badge text-bg-danger">ขาด {s.need - s.have}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StepCard>
      )}

      {/* 6. ขั้น BT */}
      {!isClosed && (
        <StepCard ico="bi-person-heart" title="ขั้น BT (pre-procedure)" dim={!measured}
                  badge={!hasBT ? <span className="badge text-bg-light border text-muted">คอร์สนี้ไม่มี</span> : btDone ? <span className="badge text-bg-success">เสร็จ ✓</span> : <span className="badge text-bg-warning">รอทำ</span>}>
          {hasBT ? (
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div style={{ minWidth: 220 }}>
                <label className="form-label small mb-1">ผู้ทำ (BT)</label>
                <select className="form-select form-select-sm" value={opd.BT_ID || ""} disabled={btDone} onChange={(e) => assign("BT_ID", e.target.value || null)}>
                  <option value="">— เลือก BT —</option>
                  {bts.map((b) => <option key={b.user_ID} value={b.user_ID}>{b.full_name}</option>)}
                </select>
              </div>
              <ABtn className="btn btn-primary btn-sm" disabled={!measured || !canTreat || !opd.BT_ID || btDone}
                    ok="บันทึกขั้น BT แล้ว" toast={toast} onClick={() => recordStage("BT")}>
                {btDone ? "บันทึกแล้ว ✓" : "บันทึก + เสร็จขั้น BT"}
              </ABtn>
              {!canTreat && <span className="text-danger small">{!paidReady ? "ต้องชำระเงินก่อน" : "สต๊อกไม่พอ"}</span>}
            </div>
          ) : <div className="text-muted small">— ข้ามอัตโนมัติ —</div>}
        </StepCard>
      )}

      {/* 7. ขั้นแพทย์ */}
      {!isClosed && (
        <StepCard ico="bi-heart-pulse" title="ขั้นแพทย์" dim={!measured || (hasBT && !btDone)}
                  badge={!hasDr ? <span className="badge text-bg-light border text-muted">คอร์สนี้ไม่มี</span> : drDone ? <span className="badge text-bg-success">เสร็จ ✓</span> : <span className="badge text-bg-danger">รอทำ</span>}>
          {hasDr ? (
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div style={{ minWidth: 220 }}>
                <label className="form-label small mb-1">ผู้ทำ (แพทย์)</label>
                <select className="form-select form-select-sm" value={opd.doctor_ID || ""} disabled={drDone} onChange={(e) => assign("doctor_ID", e.target.value || null)}>
                  <option value="">— เลือกแพทย์ —</option>
                  {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
                </select>
              </div>
              <ABtn className="btn btn-primary btn-sm" disabled={!measured || !canTreat || !opd.doctor_ID || drDone || (hasBT && !btDone)}
                    ok="บันทึกขั้นแพทย์แล้ว" toast={toast} onClick={() => recordStage("doctor")}>
                {drDone ? "บันทึกแล้ว ✓" : "บันทึก + เสร็จขั้นแพทย์"}
              </ABtn>
              {hasBT && !btDone && <span className="text-warning small">ทำขั้น BT ก่อน</span>}
            </div>
          ) : <div className="text-muted small">— ข้ามอัตโนมัติ —</div>}
        </StepCard>
      )}

      {/* หัตถการที่บันทึก */}
      {opd.procedures_done?.length > 0 && (
        <StepCard ico="bi-clipboard-check" title="หัตถการที่บันทึก">
          <table className="table table-sm mb-0">
            <thead className="table-light"><tr><th>หัตถการ</th><th>ประเภท</th><th>ผู้ทำ</th><th className="text-end">ค่ามือ</th></tr></thead>
            <tbody>
              {opd.procedures_done.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.type === "doctor" ? "text-bg-danger" : "text-bg-info"}`}>{p.type === "doctor" ? "แพทย์" : "BT"}</span></td>
                  <td>{userMap[p.performed_by] || p.performed_by}</td>
                  <td className="text-end">{money(p.cost)}฿</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StepCard>
      )}

      {/* add-on ครั้งถัดไป */}
      {(!firstVisit || isClosed) && addonCard}

      {/* ผลเคสปิดแล้ว */}
      {isClosed && (
        <div className={`alert ${opd.outcome === "consult_no_sale" ? "alert-secondary" : "alert-success"}`}>
          {opd.outcome === "consult_no_sale"
            ? <><b>⊘ ปิดเคส — ปรึกษาแล้วไม่ซื้อ</b><div className="small">ไม่ตัด stock ไม่มีค่ามือ</div></>
            : <><b>✓ ปิดเคสเรียบร้อย</b><div className="small">ตัด stock {opd.stock_used?.length || 0} รายการ · ต้นทุน {money((opd.stock_used || []).reduce((s, u) => s + (u.cost_of_goods || 0), 0))}฿</div></>}
        </div>
      )}

      {/* 8. ปิดเคส */}
      {canManage && !isClosed && (
        <StepCard ico="bi-lock" title="ปิดเคส" borderColor={measured && canTreat && hasConsent ? "primary" : undefined}>
          <div className="text-muted small mb-2">
            ปิดเคส = ตัด stock (FIFO) → นับครั้งคอร์ส → สร้างค่ามือหมอ/BT + คอม → คิวเป็น "เสร็จ"
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <ABtn className="btn btn-primary" disabled={!measured || !canTreat || !hasConsent} toast={toast} onClick={doClose}>
              <i className="bi bi-lock me-1" /> ปิดเคส
            </ABtn>
            {!measured && <span className="text-danger small">ต้องวัดตัวก่อน</span>}
            {measured && !paidReady && <span className="text-danger small">ต้องชำระเงินให้ครบก่อน</span>}
            {measured && paidReady && !stockOk && <span className="text-danger small">สต๊อกไม่พอ</span>}
            {measured && paidReady && stockOk && !hasConsent && <span className="text-warning small"><i className="bi bi-exclamation-triangle me-1" />ต้องแนบใบยินยอมก่อนปิดเคส</span>}
          </div>
        </StepCard>
      )}

      {/* timeline เคส */}
      <StepCard ico="bi-clock-history" title="Timeline เคส">
        <ul className="list-unstyled mb-0">
          {timeline.map((t, i) => (
            <li key={i} className="d-flex gap-2 pb-2 position-relative">
              <span className={`d-inline-flex align-items-center justify-content-center rounded-circle text-bg-${t.color}`}
                    style={{ width: 28, height: 28, fontSize: 13, zIndex: 1 }}>
                <i className={`bi ${t.ico}`} />
              </span>
              {i < timeline.length - 1 && <span className="position-absolute bg-secondary-subtle" style={{ left: 13, top: 28, width: 2, bottom: -4 }} />}
              <span className="small pt-1">
                <b>{t.label}</b>
                <span className="text-muted ms-2">{t.at ? new Date(t.at).toLocaleString("th-TH") : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      </StepCard>
    </div>
  );
}
