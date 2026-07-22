"use client";
// หน้า OPD / หน้าห้อง: คิวที่มาถึง → เปิดเคส (สร้าง HN ถ้าลูกค้าใหม่) → วัดตัว (บังคับ)
// → มอบหมาย BT/หมอ → บันทึกหัตถการ → add-on → ปิดเคส (ตัด stock + นับครั้ง + ค่ามือ)
import { useEffect, useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { StatusBadge, StatusLegend, Stepper, AsyncButton, useToast, todayStr, money, ROLE_LABEL, PAY_METHODS } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

// ขั้นเคส (ตาม flow): เปิดเคส → คุย/ปรึกษาหมอ → ชำระเงิน → วัดตัว → BT → หมอ → ปิดเคส
// ข้ามขั้น BT/แพทย์ที่คอร์สไม่มีอัตโนมัติ
function buildCaseSteps(snap) {
  const hasBT = (snap?.BT_procedures || []).length > 0;
  const hasDr = (snap?.doctor_procedures || []).length > 0;
  return [
    { key: "open", label: "เปิดเคส" },
    { key: "measuring", label: "วัดตัว/คุย" },
    { key: "consult", label: "ปรึกษาหมอ" },
    { key: "payment", label: "ชำระเงิน" },
    ...(hasBT ? [{ key: "bt", label: "BT ทำ" }] : []),
    ...(hasDr ? [{ key: "doctor", label: "หมอทำ" }] : []),
    { key: "closing", label: "ปิดเคส" },
  ];
}
function caseStage(opd, snap, paid) {
  if (opd.status === "closed") return "__complete__";
  if (opd.status === "consulting") return "consult";
  if (!opd.opd_data?.measured_at && !paid) return "measuring"; // เริ่ม: วัดตัว/คุย
  if (!paid) return "payment";
  if (!opd.opd_data?.measured_at) return "measuring";
  const done = opd.procedures_done || [];
  const hasBT = (snap?.BT_procedures || []).length > 0;
  const hasDr = (snap?.doctor_procedures || []).length > 0;
  if (hasBT && !done.some((p) => p.type === "BT")) return "bt";
  if (hasDr && !done.some((p) => p.type === "doctor")) return "doctor";
  return "closing";
}

// รับชำระ "เต็มจำนวน" แต่แยกได้หลายช่องทาง (สด/โอน/บัตร) — รวมต้องเท่ายอดที่ต้องจ่าย
// remount ด้วย key เมื่อ due เปลี่ยน เพื่อรีเซ็ตช่องทางเป็นยอดเต็มก้อนเดียว
function SplitPay({ due, confirmLabel, okMsg, onConfirm }) {
  const [lines, setLines] = useState([{ method: "cash", amount: String(due || "") }]);
  const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remain = due - sum;
  const ready = due > 0 && sum === due;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 6px", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <span className="muted">ชำระค่าคอร์ส (เต็มจำนวน)</span>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{money(due)}฿</b>
      </div>
      {lines.map((l, i) => (
        <div className="row" key={i} style={{ alignItems: "flex-end", marginBottom: 6 }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>{i === 0 && <label>ช่องทาง</label>}
            <select value={l.method} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select></div>
          <div className="field" style={{ margin: 0, flex: 1 }}>{i === 0 && <label>จำนวน (บาท)</label>}
            <input type="number" value={l.amount} placeholder="0"
              onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /></div>
          {lines.length > 1
            ? <button className="btn ghost" title="ลบช่องทาง" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
            : <span style={{ width: 34 }} />}
        </div>
      ))}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <button className="btn ghost sm" onClick={() => setLines((ls) => [...ls, { method: "cash", amount: remain > 0 ? String(remain) : "" }])}>+ เพิ่มช่องทาง</button>
        <span className={sum === due ? "badge green" : "badge orange"}>
          รับ {money(sum)} / {money(due)}฿{sum === due ? " · ครบ ✓" : ` · คงเหลือ ${money(remain)}฿`}
        </span>
      </div>
      <AsyncButton className="btn primary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
        ok={okMsg} disabled={!ready}
        onClick={() => onConfirm(lines.map((l) => ({ amount: Number(l.amount) || 0, method: l.method })).filter((l) => l.amount > 0))}>
        {confirmLabel}
      </AsyncButton>
    </>
  );
}

export default function OpdPage() {
  const auth = useSelector((s) => s.auth);
  const branch_ID = auth.branch_ID;
  const t = useT();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [reserves, setReserves] = useState([]);
  const [opds, setOpds] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("all"); // all|waiting|consulting|bt|doctor|done
  const [search, setSearch] = useState("");
  const caseRef = useRef(null);

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then(setReserves);
    api(`/opd?branch_ID=${branch_ID}&date=${date}`).then(setOpds);
    api(`/rooms?branch_ID=${branch_ID}`).then(setRooms);
  }, [branch_ID, date]);
  useEffect(load, [load]);
  useEffect(() => {
    if (active && caseRef.current) caseRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  const roomName = (id) => rooms.find((r) => r.room_ID === id)?.name || id;
  const myRole = auth.user?.role;
  const isStaffOnly = ["doctor", "BT"].includes(myRole);
  const visibleReserves = reserves.filter((r) => {
    if (["cancelled", "no_show"].includes(r.status)) return false;
    if (myRole === "doctor") return r.doctor_ID === auth.user.user_ID;
    if (myRole === "BT") return !r.BT_ID || r.BT_ID === auth.user.user_ID;
    return true;
  }).sort((a, b) => (a.time_start || "").localeCompare(b.time_start || ""));

  const FILTERS = [
    { key: "all", label: "ทั้งหมด", match: () => true },
    { key: "waiting", label: "รอทำ", match: (s) => ["booked", "arrived", "ready"].includes(s) },
    { key: "consulting", label: "ปรึกษาหมอ", match: (s) => s === "consulting" },
    { key: "bt", label: "BT ทำ", match: (s) => s === "bt_stage" },
    { key: "doctor", label: "หมอทำ", match: (s) => s === "doctor_stage" },
    { key: "done", label: "เสร็จ", match: (s) => s === "done" },
  ];
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, visibleReserves.filter((r) => f.match(r.status)).length]));
  const q = search.trim().toLowerCase();
  const activeFilter = FILTERS.find((f) => f.key === filter);
  const rows = visibleReserves.filter((r) => {
    if (!activeFilter.match(r.status)) return false;
    if (q && !`${r.contact?.nick_name || ""} ${r.HN_number || ""} ${roomName(r.room_ID)}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // เปิดเคส (เฉพาะที่มี HN แล้ว) — ลูกค้าใหม่/สร้าง HN ให้ทำที่หน้า "รับลูกค้า"
  const openCase = async (r) => {
    const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: r.HN_number } });
    toast.success("เปิดเคสแล้ว");
    load(); setActive(o);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}>
          <label>{t("date")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grow" />
        <StatusLegend statuses={["ready", "consulting", "bt_stage", "doctor_stage", "done"]} />
      </div>

      <div className="opd-split">
        {/* ซ้าย: คิว + ตัวกรอง */}
        <div className="opd-queue">
          <div className="card" style={{ position: "sticky", top: 64 }}>
            <div className="row" style={{ margin: "0 0 8px" }}>
              <input style={{ flex: 1 }} placeholder="🔎 ค้นหา HN / ชื่อ / ห้อง" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="opd-filter">
              {FILTERS.map((f) => (
                <button key={f.key} className={`opd-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
                  <span>{f.label}</span>
                  <span className="opd-chip-n">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="opd-list">
              <table className="tbl opd-tbl">
                <thead><tr><th>เวลา</th><th>ลูกค้า / สถานะ</th><th></th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={3}><div className="empty-state" style={{ padding: 20 }}><span className="es-ico">🍵</span>— ไม่มีคิว —</div></td></tr>}
                  {rows.map((r) => {
                    const opd = opds.find((o) => o.opd_ID === r.opd_ID);
                    const isSel = active?.opd_ID && active.opd_ID === r.opd_ID;
                    return (
                      <tr key={r.reserve_ID} className={`${isSel ? "sel" : ""} ${r.opd_ID ? "clickable" : ""}`}
                        onClick={() => r.opd_ID && setActive(opd)}>
                        <td className="opd-td-time"><b>{r.time_start}</b></td>
                        <td>
                          <div className="opd-row-name">
                            <b>{r.contact?.nick_name || "ลูกค้าใหม่"}</b>
                            {r.is_walk_in && <span className="muted"> · Walk-in</span>}
                          </div>
                          <div className="muted" style={{ fontSize: 11 }}>{r.HN_number || "ยังไม่มี HN"} · {roomName(r.room_ID)}</div>
                          <div style={{ marginTop: 3 }}><StatusBadge status={r.status} /></div>
                        </td>
                        <td className="opd-td-act" onClick={(e) => e.stopPropagation()}>
                          {r.opd_ID ? (
                            <button className="btn small" onClick={() => setActive(opd)}>{opd?.status === "closed" ? "ดู" : "ทำต่อ"}</button>
                          ) : isStaffOnly ? <span className="muted" style={{ fontSize: 11 }}>รอเปิด</span>
                            : r.HN_number ? (
                              <AsyncButton className="btn small primary" onClick={() => openCase(r)}>เปิดเคส</AsyncButton>
                            ) : <a className="btn small ghost" href="/reception" title="สร้าง HN ที่ รับลูกค้า">+HN</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ขวา: เคส */}
        <div className="opd-case" ref={caseRef}>
          {active ? (
            <CaseEditor opd_ID={active.opd_ID} t={t} auth={auth}
              onChanged={load} onClose={() => { setActive(null); load(); }} />
          ) : (
            <div className="card"><div className="empty-state"><span className="es-ico">🩺</span>เลือกคิวจากด้านซ้ายเพื่อดู/ทำเคส</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueItem({ r, opd, t, roomName, selected, isStaffOnly, onChanged, onOpen }) {
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({
    full_name: "", sure_name: "", nick_name: r.contact?.nick_name || "", phone: r.contact?.phone || "", drug_allergies: "",
  });
  const openCase = async () => {
    if (!r.HN_number) { setShowNew(true); return; }
    const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: r.HN_number } });
    toast.success("เปิดเคสแล้ว");
    onChanged(); onOpen(o);
  };
  const createCustomerAndOpen = async () => {
    const body = {
      ...newCust, branch_ID: r.branch_ID,
      drug_allergies: newCust.drug_allergies ? newCust.drug_allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    const c = await api("/customers", { method: "POST", body });
    await api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { HN_number: c.HN_number } });
    const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: c.HN_number } });
    setShowNew(false); toast.success(`สร้าง HN ${c.HN_number} + เปิดเคสแล้ว`);
    onChanged(); onOpen(o);
  };

  return (
    <div className={`q-item ${selected ? "selected" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span className="q-time">{r.time_start}</span>
        <StatusBadge status={r.status} />
      </div>
      <div style={{ margin: "4px 0 8px" }}>
        <b>{r.contact?.nick_name || r.HN_number || "ลูกค้าใหม่"}</b>
        <span className="muted"> · {roomName(r.room_ID)}{r.is_walk_in ? " · Walk-in" : ""}</span>
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        {!r.opd_ID && !isStaffOnly && ["booked", "arrived", "ready"].includes(r.status) && (
          <AsyncButton className="btn small primary" onClick={openCase}>{t("open_case")}</AsyncButton>
        )}
        {r.opd_ID && opd && (
          <button className="btn small" onClick={() => onOpen(opd)}>
            {opd.status === "closed" ? "ดูเคส" : "ทำเคสต่อ"} · {opd.opd_ID}
          </button>
        )}
      </div>
      {showNew && (
        <div className="hint-box" style={{ marginTop: 10 }}>
          <b style={{ fontFamily: "var(--font-display)" }}>{t("new_customer")} — สร้าง HN</b>
          {[["full_name", "ชื่อ"], ["sure_name", "นามสกุล"], ["nick_name", "ชื่อเล่น"], ["phone", "เบอร์โทร"], ["drug_allergies", "แพ้ยา (คั่นด้วย ,)"]].map(([k, lb]) => (
            <div className="field" key={k} style={{ marginTop: 8 }}>
              <label>{lb}</label>
              <input value={newCust[k]} onChange={(e) => setNewCust((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <AsyncButton className="btn primary small" style={{ marginTop: 8 }} disabled={!newCust.full_name} onClick={createCustomerAndOpen}>
            สร้าง HN + เปิดเคส
          </AsyncButton>
        </div>
      )}
    </div>
  );
}

function CaseEditor({ opd_ID, t, auth, onChanged, onClose }) {
  const toast = useToast();
  const [opd, setOpd] = useState(null);
  const [cc, setCc] = useState(null);
  const [bts, setBts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [products, setProducts] = useState([]);
  const [vitals, setVitals] = useState({ blood_pressure: "", heart_rate: "", weight_kg: "", height_cm: "", fat_mass: "", muscle_mass: "", other: "" });
  const [addon, setAddon] = useState({ product_ID: "", medical_procedure_ID: "", qty: 1, method: "cash", recommended_by: "" });
  const [courses, setCourses] = useState([]);
  const [custCourses, setCustCourses] = useState([]); // คอร์สค้างของลูกค้ารายนี้
  const [sales, setSales] = useState([]); // sale ในสาขา (เลือกดูแลเคส)
  const [sell, setSell] = useState({ mode: "new", course_ID: "", existing_id: "" });
  const [priceOv, setPriceOv] = useState(""); // ปรับราคาหน้างาน (admin)
  const [stockRows, setStockRows] = useState([]); // สรุป stock ต่อสินค้า (เช็คก่อนทำหัตถการ)

  const reload = useCallback(async () => {
    const o = await api(`/opd/${opd_ID}`);
    setOpd(o);
    if (o.opd_data?.measured_at) setVitals((v) => ({ ...v, ...o.opd_data }));
    const list = await api(`/customer-courses?HN=${o.HN_number}`);
    setCc(list.find((x) => x.customer_course_ID === o.customer_course_ID) || null);
    setCustCourses(list.filter((x) => x.status === "active"));
  }, [opd_ID]);
  useEffect(() => { reload(); }, [reload]);

  // catalog + staff + stock — scope ตามสาขาของเคส
  useEffect(() => {
    if (!opd?.branch_ID) return;
    const b = opd.branch_ID;
    api(`/stock/summary?branch_ID=${b}`).then(setStockRows).catch(() => setStockRows([]));
    api(`/users?role=BT&branch_ID=${b}`).then(setBts);
    api(`/users?role=doctor&branch_ID=${b}`).then(setDoctors);
    api(`/users?role=sale&branch_ID=${b}`).then(setSales);
    api(`/procedures?branch_ID=${b}`).then(setProcedures);
    api(`/products?branch_ID=${b}`).then((p) => setProducts(p.filter((x) => x.active)));
    api(`/courses?branch_ID=${b}`).then((c) => setCourses(c.filter((x) => x.active)));
  }, [opd?.branch_ID]);

  if (!opd) return <div className="card"><div className="empty-state">{t("loading")}</div></div>;
  const snap = cc?.course_snapshot;
  const canManage = ["super_admin", "admin", "acception"].includes(auth.user.role);
  const stage = caseStage(opd, snap, !!cc && (cc.balance_due || 0) <= 0);
  const CASE_STEPS = buildCaseSteps(snap);
  const measured = !!opd.opd_data?.measured_at;

  // เช็คสต๊อกสินค้าที่คอร์สนี้จะใช้ (คำนวณก่อนลงมือทำหัตถการ) — เตือนถ้าไม่พอ
  const stockNeed = (snap?.products || []).map((p) => {
    const row = stockRows.find((r) => r.product?.product_ID === p.product_ID);
    const need = p.sub_unit_per_use || 0;
    const have = row?.total_cc_remaining || 0;
    return {
      product_ID: p.product_ID,
      name: row?.product?.name || p.product_ID,
      unit: row?.product?.sub_unit_name || "หน่วยย่อย",
      need, have, ok: have >= need,
    };
  });
  const stockShort = stockNeed.filter((s) => !s.ok);
  const stockOk = stockShort.length === 0;
  const isClosed = opd.status === "closed";
  const hasCourse = !!cc;
  const paid = hasCourse && (cc.balance_due || 0) <= 0; // จ่ายเต็มแล้ว (ไม่มีมัดจำ/ผ่อน)
  const paidReady = hasCourse && paid;                  // มีคอร์ส + จ่ายครบ
  const canTreat = paidReady && stockOk;                // ทำหัตถการ/ปิดเคสได้ (ต้องสต๊อกพอด้วย)
  const userMap = Object.fromEntries([...bts, ...doctors, ...sales].map((u) => [u.user_ID, u.full_name]));

  // ขั้นทำหัตถการ (แยก BT / แพทย์)
  const hasBT = (snap?.BT_procedures || []).length > 0;
  const hasDr = (snap?.doctor_procedures || []).length > 0;
  const btDone = (opd.procedures_done || []).some((p) => p.type === "BT");
  const drDone = (opd.procedures_done || []).some((p) => p.type === "doctor");

  // ยอดที่ต้องรับ = ราคาเต็มคอร์ส (ขายใหม่) หรือยอดคงค้าง (คอร์สเดิม)
  const sellCourse = sell.mode === "new" ? courses.find((c) => c.course_ID === sell.course_ID) : null;
  const sellExisting = sell.mode === "existing" ? custCourses.find((c) => c.customer_course_ID === sell.existing_id) : null;
  const dueAmount = sell.mode === "new"
    ? (priceOv !== "" ? Number(priceOv) || 0 : (sellCourse?.price || 0))
    : (sellExisting?.balance_due || 0);
  const courseChosen = sell.mode === "new" ? !!sell.course_ID : !!sell.existing_id;
  const isAdmin = ["super_admin", "admin"].includes(auth.user.role);

  // เลือก sale ดูแลเคส (เอาไปคิดคอม)
  const setSaleId = async (sale_ID) => { await api(`/opd/${opd_ID}`, { method: "PUT", body: { sale_ID: sale_ID || null } }); reload(); };
  // ปรึกษาหมอก่อนซื้อ
  const startConsult = async () => { await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "start", doctor_ID: opd.doctor_ID || opd.consult_doctor_ID || null } }); reload(); };
  const consultOk = async () => { await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "ok" } }); reload(); };
  const consultNoSale = async () => {
    await api(`/opd/${opd_ID}/consult`, { method: "POST", body: { action: "no_sale" } });
    toast.success("ปิดเคส: ปรึกษาแล้วไม่ซื้อ");
    onClose();
  };

  // แนบคอร์ส + รับเงินเต็มจำนวน (แยกช่องทางแล้ว) — admin ปรับราคาได้
  const attachCourse = async (payments) => {
    const body = sell.mode === "existing"
      ? { existing_customer_course_ID: sell.existing_id, payments }
      : { course_ID: sell.course_ID, payments, ...(priceOv !== "" ? { price_override: Number(priceOv) } : {}) };
    await api(`/opd/${opd_ID}/course`, { method: "POST", body });
    setSell({ mode: "new", course_ID: "", existing_id: "" });
    setPriceOv("");
    reload();
  };
  // รับชำระคอร์สที่ผูกไว้แล้ว (จ่ายเต็มยอดคงค้าง แยกช่องทางได้)
  const payLinked = async (payments) => {
    await api(`/customer-courses/${cc.customer_course_ID}/pay`, { method: "POST", body: { payments } });
    reload();
  };

  // vitals sanity range (F-17)
  const vErr = {};
  if (vitals.weight_kg && (+vitals.weight_kg < 20 || +vitals.weight_kg > 300)) vErr.weight_kg = "ควร 20–300 kg";
  if (vitals.height_cm && (+vitals.height_cm < 80 || +vitals.height_cm > 250)) vErr.height_cm = "ควร 80–250 cm";
  if (vitals.heart_rate && (+vitals.heart_rate < 30 || +vitals.heart_rate > 220)) vErr.heart_rate = "ควร 30–220";
  if (vitals.blood_pressure && !/^\d{2,3}\/\d{2,3}$/.test(vitals.blood_pressure)) vErr.blood_pressure = "เช่น 120/80";
  const hasVErr = Object.keys(vErr).length > 0;

  const saveVitals = async () => {
    await api(`/opd/${opd_ID}`, {
      method: "PUT",
      body: { opd_data: { ...vitals, heart_rate: +vitals.heart_rate || 0, weight_kg: +vitals.weight_kg || 0, height_cm: +vitals.height_cm || 0, fat_mass: +vitals.fat_mass || 0, muscle_mass: +vitals.muscle_mass || 0 } },
    });
    reload();
  };
  const assign = async (field, value) => { await api(`/opd/${opd_ID}`, { method: "PUT", body: { [field]: value } }); reload(); };
  // บันทึกหัตถการทีละขั้น (แยก BT / แพทย์) + เดินสถานะคิว → bt_stage / doctor_stage
  const recordStage = async (type) => {
    const list = type === "BT" ? snap?.BT_procedures : snap?.doctor_procedures;
    const performer = type === "BT" ? opd.BT_ID : opd.doctor_ID;
    const done = (opd.procedures_done || []).filter((p) => p.type !== type);
    for (const p of list || []) {
      const mp = procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID);
      if (mp && performer) done.push({ medical_procedure_ID: mp.medical_procedure_ID, name: mp.name, type, performed_by: performer, cost: mp.cost });
    }
    await api(`/opd/${opd_ID}`, { method: "PUT", body: { procedures_done: done, status: type === "BT" ? "bt_stage" : "doctor_stage" } });
    reload();
  };
  const doAddon = async () => {
    const p = products.find((x) => x.product_ID === addon.product_ID);
    const mp = procedures.find((x) => x.medical_procedure_ID === addon.medical_procedure_ID);
    if (!p && !mp) return toast.error("เลือกสินค้าหรือหัตถการก่อน");
    const price = (p?.selling_price || 0) * (addon.qty || 1);
    const firstVisit = opd.session_no === 1;
    const items = [p && `${p.name} ×${addon.qty}`, mp && `หัตถการ ${mp.name} (ค่ามือ ${money(mp.cost)}฿→${mp.type === "doctor" ? "หมอ" : "BT"})`].filter(Boolean).join(" + ");
    const bill = firstVisit
      ? `บวกเข้ายอดคอร์ส ${price > 0 ? `+${money(price)}฿` : "(ไม่มีค่าสินค้า)"} — จ่ายรวมที่การ์ดชำระเงิน`
      : (price > 0 ? `เก็บเงินแยกบิลทันที ${money(price)}฿` : "บันทึกหัตถการ (ไม่มีค่าสินค้า)");
    if (!window.confirm(`Add-on: ${items}\n${bill}\nยืนยัน?`)) return;
    await api(`/opd/${opd_ID}/addon`, { method: "POST", body: addon });
    setAddon({ product_ID: "", medical_procedure_ID: "", qty: 1, method: "cash", recommended_by: "" });
    reload();
  };
  const doClose = async () => {
    const res = await api(`/opd/${opd_ID}/close`, { method: "POST" });
    toast.success(`ปิดเคสสำเร็จ · ตัด stock ${res.stock_used.length} รายการ · เหลือ ${res.uses_remaining} ครั้ง${res.course_completed ? " (ครบแล้ว)" : ""}`);
    onClose();
  };

  const stepStyle = (on) => ({ opacity: on ? 1 : 0.55, transition: "opacity .15s" });

  // การ์ด add-on — ครั้งแรก(session 1) ย้ายไปติดการ์ดชำระเงิน (บวกเข้ายอดคอร์ส จ่ายรวม) · ครั้งต่อไป = เก็บเงินแยกบิล
  const firstVisit = opd.session_no === 1;
  const addonProc = procedures.find((x) => x.medical_procedure_ID === addon.medical_procedure_ID);
  const addonCard = (
    <div className="card">
      <h2><span className="h2-ico">➕</span> {t("add_on")}
        <span className="muted" style={{ fontWeight: 400 }}>
          ({firstVisit ? "ครั้งแรก = บวกเข้ายอดคอร์ส จ่ายรวม" : "แยกบิลเก็บเงินทันที"} · สินค้าตัด stock ตอนปิดเคส · หัตถการค่ามือ→BT/หมอ)
        </span>
      </h2>
      {!isClosed && (
        <>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>สินค้า (ตัด stock + คิดเงิน)</label>
              <select value={addon.product_ID} onChange={(e) => setAddon((f) => ({ ...f, product_ID: e.target.value }))}>
                <option value="">— ไม่มี —</option>
                {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name} · {money(p.selling_price)}฿</option>)}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 80 }}>
              <label>จำนวน</label>
              <input type="number" min={1} value={addon.qty} onChange={(e) => setAddon((f) => ({ ...f, qty: +e.target.value }))} />
            </div>
            <div className="field">
              <label>หัตถการ (ค่ามือ → BT/หมอ)</label>
              <select value={addon.medical_procedure_ID} onChange={(e) => setAddon((f) => ({ ...f, medical_procedure_ID: e.target.value }))}>
                <option value="">— ไม่มี —</option>
                {procedures.map((mp) => <option key={mp.medical_procedure_ID} value={mp.medical_procedure_ID}>{mp.name} · ค่ามือ {money(mp.cost)}฿ ({mp.type === "doctor" ? "หมอ" : "BT"})</option>)}
              </select>
            </div>
            <div className="field">
              <label>คนแนะ (คิดคอม)</label>
              <select value={addon.recommended_by} onChange={(e) => setAddon((f) => ({ ...f, recommended_by: e.target.value }))}>
                <option value="">— ไม่ระบุ —</option>
                {sales.map((s) => <option key={s.user_ID} value={s.user_ID}>Sale: {s.full_name}</option>)}
                {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>หมอ: {d.full_name}</option>)}
              </select>
            </div>
            {!firstVisit && (
              <div className="field">
                <label>ช่องทาง</label>
                <select value={addon.method} onChange={(e) => setAddon((f) => ({ ...f, method: e.target.value }))}>
                  <option value="cash">เงินสด</option><option value="transfer">โอน</option><option value="card">บัตร</option>
                </select>
              </div>
            )}
            <AsyncButton className="btn gold" disabled={!addon.product_ID && !addon.medical_procedure_ID}
              ok={firstVisit ? "เพิ่มลงบิลคอร์สแล้ว" : "เพิ่ม add-on + เก็บเงินแล้ว"} onClick={doAddon}>
              {firstVisit ? "+ เพิ่มลงบิลคอร์ส" : "+ add-on (เก็บเงิน)"}
            </AsyncButton>
          </div>
          {addonProc && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              * ค่ามือหัตถการ {money(addonProc.cost)}฿ จะจ่ายให้ {addonProc.type === "doctor" ? "หมอ" : "BT"} ของเคสนี้ตอนปิดเคส
            </div>
          )}
        </>
      )}
      {opd.add_ons?.length > 0 && (
        <div style={{ marginTop: isClosed ? 0 : 10 }}>
          {opd.add_ons.map((a, i) => (
            <div key={i} className="roster-item">
              <span style={{ flex: 1 }}>
                {a.product_ID ? `${a.name} ×${a.qty}` : a.name}
                {a.medical_procedure_ID && <span className="badge blue nodot" style={{ marginLeft: 6 }}>💉 {a.proc_name} · ค่ามือ {money(a.proc_cost)}฿</span>}
                {a.first_visit && <span className="badge gray nodot" style={{ marginLeft: 6 }}>รวมบิลคอร์ส</span>}
                {a.recommended_by && <span className="muted" style={{ marginLeft: 6 }}>· แนะโดย {userMap[a.recommended_by] || a.recommended_by}</span>}
              </span>
              <span className="badge gold nodot">{a.price > 0 ? `${money(a.price)}฿` : "—"}</span>
            </div>
          ))}
        </div>
      )}
      {isClosed && !opd.add_ons?.length && <div className="muted">— ไม่มี add-on —</div>}
    </div>
  );

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>{snap?.name || "เคส"}</span>
          <span className="badge gold nodot" title="รหัสผู้ป่วย">{opd.HN_number}</span>
          <span className="badge blue nodot">ครั้งที่ {opd.session_no}</span>
          <span style={{ marginLeft: "auto" }}><StatusBadge status={opd.status} /></span>
        </div>
        {cc && (
          <div className="muted" style={{ marginBottom: 16 }}>
            เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง
            {cc.balance_due > 0 && <> · <span style={{ color: "var(--amber)" }}>ค้างชำระ {money(cc.balance_due)}฿</span></>}
            {cc.expires_at && <> · หมดอายุ {String(cc.expires_at).slice(0, 10)}</>}
          </div>
        )}
        <Stepper steps={CASE_STEPS} current={stage} />
      </div>

      {/* 1. วัดตัว + Sale ดูแลเคส (sale คุย) — ก่อนปรึกษา/ชำระเงิน */}
      {!isClosed && (
        <div className="card" style={stepStyle(stage === "measuring" || measured || !paid)}>
          <h2>
            <span className="h2-ico">📏</span> {t("measure")} + Sale ดูแลเคส
            <span className="muted" style={{ fontWeight: 400 }}>(sale คุย · วัดตัว)</span>
            {measured && <span className="badge green" style={{ marginLeft: "auto" }}>วัดแล้ว</span>}
          </h2>
          {/* ช่อง sale ที่คุย/ดูแลเคส — เลือกก่อนชำระเงิน (เอาไปคิดคอม) */}
          {!paid ? (
            <div className="field">
              <label>Sale ที่คุย/ดูแลเคสนี้ (เอาไปคิดคอม)</label>
              <select value={opd.sale_ID || ""} onChange={(e) => setSaleId(e.target.value)}>
                <option value="">— ยังไม่ระบุ —</option>
                {sales.map((s) => <option key={s.user_ID} value={s.user_ID}>{s.full_name}</option>)}
              </select>
            </div>
          ) : opd.sale_ID ? (
            <div className="muted" style={{ marginBottom: 8 }}>Sale ดูแลเคส: <b>{userMap[opd.sale_ID] || opd.sale_ID}</b></div>
          ) : null}
          <div className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>วัดตัว (บังคับก่อนทำหัตถการ · ถ้าแค่ปรึกษาไม่ต้อง):</div>
          <div className="row">
            {[
              ["blood_pressure", "ความดัน", "text"], ["heart_rate", "ชีพจร", "number"],
              ["weight_kg", "น้ำหนัก (kg)", "number"], ["height_cm", "ส่วนสูง (cm)", "number"],
              ["fat_mass", "มวลไขมัน", "number"], ["muscle_mass", "มวลกล้ามเนื้อ", "number"],
            ].map(([k, lb, type]) => (
              <div className="field" key={k}>
                <label>{lb}</label>
                <input type={type} disabled={isClosed} value={vitals[k]}
                  style={vErr[k] ? { borderColor: "var(--seal)" } : undefined}
                  onChange={(e) => setVitals((v) => ({ ...v, [k]: e.target.value }))} />
                {vErr[k] && <div className="date-hint" style={{ color: "var(--seal)" }}>{vErr[k]}</div>}
              </div>
            ))}
          </div>
          <AsyncButton className="btn primary" style={{ marginTop: 12 }} disabled={hasVErr} ok="บันทึกการวัดตัวแล้ว" onClick={saveVitals}>
            บันทึกการวัดตัว {measured && "✓"}
          </AsyncButton>
          {hasVErr && <span className="muted" style={{ marginLeft: 10, color: "var(--seal)" }}>ตรวจค่าที่กรอกก่อนบันทึก</span>}
        </div>
      )}

      {/* 2. ปรึกษาหมอก่อนชำระ (ครั้งแรก, ก่อนจ่ายค่าคอร์ส) */}
      {!isClosed && !paid && (opd.session_no <= 1) && (
        <div className="card" style={{ borderColor: opd.status === "consulting" ? "var(--info)" : "var(--line)" }}>
          <h2><span className="h2-ico">🔎</span> ปรึกษาหมอก่อนชำระ
            <span className="badge purple" style={{ marginLeft: "auto" }}>{opd.status === "consulting" ? "กำลังปรึกษา" : "ครั้งแรก · เลือกได้"}</span>
          </h2>
          {opd.status === "consulting" ? (
            <div className="hint-box" style={{ borderColor: "var(--info)" }}>
              <b style={{ fontFamily: "var(--font-display)" }}>กำลังปรึกษาหมอ{opd.consult_doctor_ID ? ` (${userMap[opd.consult_doctor_ID] || opd.consult_doctor_ID})` : ""}</b>
              <div className="muted" style={{ margin: "4px 0 10px" }}>หมอประเมินแล้ว ลูกค้าตัดสินใจ:</div>
              <div className="row">
                <AsyncButton className="btn primary" ok="ลูกค้าตกลงซื้อ — ไปชำระเงิน" onClick={consultOk}>✓ ตกลงซื้อ (ไปชำระเงิน)</AsyncButton>
                <AsyncButton className="btn ghost" ok="" onClick={consultNoSale}>✕ ไม่ซื้อ — ปิดเคส</AsyncButton>
              </div>
            </div>
          ) : opd.consulted ? (
            <div className="muted">✓ ปรึกษาหมอแล้ว — ลูกค้าตกลงซื้อ · ไปชำระเงินด้านล่าง</div>
          ) : (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label>หมอที่ปรึกษา</label>
                <select value={opd.doctor_ID || ""} onChange={(e) => assign("doctor_ID", e.target.value || null)}>
                  <option value="">— เลือกหมอ —</option>
                  {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
                </select>
              </div>
              <AsyncButton className="btn" disabled={!opd.doctor_ID} ok="ส่งปรึกษาหมอแล้ว" onClick={startConsult}>🔎 ส่งปรึกษาหมอ</AsyncButton>
              <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>ถ้าไม่ต้องปรึกษา ชำระเงินด้านล่างได้เลย</span>
            </div>
          )}
        </div>
      )}

      {/* 3. เลือก/ขายคอร์ส + รับเงิน (ต้องทำก่อนหัตถการ) */}
      {!isClosed && opd.status !== "consulting" && (
        <div className="card" style={{ borderColor: !paidReady ? "var(--seal)" : "var(--line)" }}>
          <h2>
            <span className="h2-ico">🎴</span> คอร์ส + ชำระเงิน
            {paidReady ? <span className="badge green" style={{ marginLeft: "auto" }}>ชำระครบ · พร้อมต่อไป</span>
              : <span className="badge red" style={{ marginLeft: "auto" }}>ต้องเลือกคอร์ส + รับเงินก่อน</span>}
          </h2>
          {!hasCourse ? (
            <>
              <div className="seg" style={{ marginBottom: 10 }}>
                <button className={sell.mode === "new" ? "on" : ""} onClick={() => setSell({ mode: "new", course_ID: "", existing_id: "" })}>ขายคอร์สใหม่</button>
                <button className={sell.mode === "existing" ? "on" : ""} onClick={() => setSell({ mode: "existing", course_ID: "", existing_id: "" })}>ใช้คอร์สเดิมของลูกค้า ({custCourses.length})</button>
              </div>
              {sell.mode === "new" ? (
                <div className="field">
                  <label>เลือกคอร์ส</label>
                  <select value={sell.course_ID} onChange={(e) => setSell((s) => ({ ...s, course_ID: e.target.value }))}>
                    <option value="">— เลือก —</option>
                    {courses.map((c) => <option key={c.course_ID} value={c.course_ID}>{c.name} · {money(c.price)}฿ · {c.quantity_used} ครั้ง</option>)}
                  </select>
                </div>
              ) : (
                <div className="field">
                  <label>คอร์สเดิมของลูกค้า</label>
                  <select value={sell.existing_id} onChange={(e) => setSell((s) => ({ ...s, existing_id: e.target.value }))}>
                    <option value="">— เลือก —</option>
                    {custCourses.map((c) => <option key={c.customer_course_ID} value={c.customer_course_ID}>{c.course_snapshot?.name} · เหลือ {c.uses_remaining}/{c.uses_total}{c.balance_due > 0 ? ` · ค้าง ${money(c.balance_due)}฿` : " · จ่ายครบแล้ว"}</option>)}
                  </select>
                </div>
              )}

              {/* ปรับราคาหน้างาน — เฉพาะ admin/owner */}
              {sell.mode === "new" && sell.course_ID && isAdmin && (
                <div className="field">
                  <label>ปรับราคาหน้างาน (admin) — ว่าง = ราคาปกติ {money(sellCourse?.price || 0)}฿</label>
                  <input type="number" value={priceOv} placeholder={String(sellCourse?.price || 0)}
                    onChange={(e) => setPriceOv(e.target.value)} />
                </div>
              )}
              {sell.mode === "new" && sell.course_ID && !isAdmin && priceOv === "" && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>* ปรับราคา/ต่อรอง ต้องให้ admin ทำ</div>
              )}

              {/* คอร์สใหม่: แนบก่อน (ยังไม่จ่าย) → เพิ่ม add-on แล้วจ่ายรวมทีเดียว · หรือจ่ายเต็มทันที */}
              {sell.mode === "new" && courseChosen && dueAmount > 0 && (
                <>
                  <AsyncButton className="btn primary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                    ok="เลือกคอร์สแล้ว — เพิ่ม add-on / ชำระด้านล่าง" onClick={() => attachCourse([])}>
                    เลือกคอร์สนี้ (ยังไม่จ่าย · เพิ่ม add-on ก่อน แล้วจ่ายรวม)
                  </AsyncButton>
                  <div className="muted" style={{ margin: "8px 0", textAlign: "center" }}>— หรือ จ่ายเต็มทันที —</div>
                  <SplitPay key={`new:${sell.course_ID}:${dueAmount}`}
                    due={dueAmount} confirmLabel="จ่ายเต็มทันที" okMsg="เลือกคอร์ส + รับเงินครบแล้ว"
                    onConfirm={attachCourse} />
                </>
              )}
              {sell.mode === "existing" && courseChosen && dueAmount > 0 && (
                <SplitPay key={`ex:${sell.existing_id}:${dueAmount}`}
                  due={dueAmount} confirmLabel="ยืนยัน (จ่ายเต็มจำนวน)" okMsg="เลือกคอร์ส + รับเงินครบแล้ว"
                  onConfirm={attachCourse} />
              )}
              {courseChosen && dueAmount === 0 && (
                <>
                  <div className="muted" style={{ marginTop: 6 }}>คอร์สนี้จ่ายครบแล้ว — เลือกใช้ได้เลย</div>
                  <AsyncButton className="btn primary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                    ok="เลือกคอร์สแล้ว" onClick={() => attachCourse([])}>ยืนยันเลือกคอร์ส</AsyncButton>
                </>
              )}
              <div className="muted" style={{ marginTop: 6 }}>* ต้องจ่ายเต็มราคา (คอร์ส + add-on ครั้งแรก) ก่อนเริ่มทำหัตถการ — แยกช่องทางได้ (สด/โอน/บัตร)</div>
            </>
          ) : cc.balance_due > 0 ? (
            <>
              <div className="row" style={{ alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <b>{cc.course_snapshot?.name}</b> · เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง ·
                  จ่ายแล้ว {money(cc.paid_amount)}/{money(cc.total_price)}฿
                  <span className="badge orange" style={{ marginLeft: 6 }}>ค้าง {money(cc.balance_due)}฿</span>
                </div>
              </div>
              <SplitPay key={cc.customer_course_ID} due={cc.balance_due}
                confirmLabel="รับชำระ (จ่ายเต็มจำนวน)" okMsg="รับชำระครบแล้ว" onConfirm={payLinked} />
            </>
          ) : (
            <div className="row" style={{ alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <b>{cc.course_snapshot?.name}</b> · เหลือ {cc.uses_remaining}/{cc.uses_total} ครั้ง ·
                จ่ายแล้ว {money(cc.paid_amount)}/{money(cc.total_price)}฿
                <span className="badge green" style={{ marginLeft: 6 }}>ชำระครบแล้ว ✓</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* add-on ครั้งแรก — ติดใต้การ์ดชำระเงิน (บวกเข้ายอดคอร์ส จ่ายรวม) */}
      {firstVisit && !isClosed && hasCourse && addonCard}

      {isClosed && opd.outcome === "consult_no_sale" && (
        <div className="card" style={{ borderColor: "var(--slate)", background: "var(--slate-tint)" }}>
          <b style={{ color: "var(--slate)", fontFamily: "var(--font-display)" }}>⊘ ปิดเคส — ปรึกษาแล้วไม่ซื้อ</b>
          <div className="muted" style={{ marginTop: 4 }}>ลูกค้าปรึกษาหมอแล้วตัดสินใจไม่ซื้อคอร์ส · ไม่ตัด stock ไม่มีค่ามือ</div>
        </div>
      )}
      {isClosed && opd.outcome !== "consult_no_sale" && (
        <div className="card" style={{ borderColor: "var(--jade)", background: "var(--jade-tint)" }}>
          <b style={{ color: "var(--jade)", fontFamily: "var(--font-display)" }}>✓ ปิดเคสเรียบร้อยแล้ว</b>
          <div className="muted" style={{ marginTop: 4 }}>
            ตัด stock {opd.stock_used?.length || 0} รายการ · ต้นทุนรวม {money((opd.stock_used || []).reduce((s, u) => s + (u.cost_of_goods || 0), 0))}฿
          </div>
        </div>
      )}


      {/* 2. เช็คสต๊อกสินค้าที่คอร์สนี้จะใช้ (คำนวณก่อนทำหัตถการ) */}
      {!isClosed && hasCourse && (
        <div className="card" style={{ borderColor: stockOk ? "var(--line)" : "var(--seal)" }}>
          <h2><span className="h2-ico">🧪</span> สต๊อกสินค้าสำหรับคอร์สนี้
            {stockNeed.length === 0
              ? <span className="badge gray" style={{ marginLeft: "auto" }}>ไม่ใช้สินค้าคลัง</span>
              : stockOk
                ? <span className="badge green" style={{ marginLeft: "auto" }}>สต๊อกพอ ✓</span>
                : <span className="badge red" style={{ marginLeft: "auto" }}>สต๊อกไม่พอ</span>}
          </h2>
          {stockNeed.length === 0 ? (
            <div className="muted">คอร์สนี้ไม่ตัดสินค้าจากคลัง</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>สินค้า</th><th>ต้องใช้/ครั้ง</th><th>คงเหลือ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {stockNeed.map((s) => (
                  <tr key={s.product_ID}>
                    <td>{s.name}</td>
                    <td>{s.need} {s.unit}</td>
                    <td>{s.have} {s.unit}</td>
                    <td>{s.ok
                      ? <span className="badge green nodot">✓ พอ</span>
                      : <span className="badge red nodot">⚠ ขาด {s.need - s.have} {s.unit}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!stockOk && (
            <div className="hint-box" style={{ marginTop: 10, borderColor: "var(--seal)", color: "var(--seal-dark)" }}>
              ⚠️ สต๊อกไม่พอสำหรับคอร์สนี้ — เติมของก่อน (คลังสินค้า/จัดซื้อ) จึงจะทำหัตถการ + ปิดเคสได้
            </div>
          )}
        </div>
      )}

      {/* 3. ขั้น BT (pre-procedure) */}
      {!isClosed && (
        <div className="card" style={stepStyle(measured)}>
          <h2><span className="h2-ico">💆</span> ขั้น BT (pre-procedure)
            {!hasBT ? <span className="badge gray" style={{ marginLeft: "auto" }}>คอร์สนี้ไม่มีขั้น BT</span>
              : btDone ? <span className="badge green" style={{ marginLeft: "auto" }}>เสร็จขั้น BT ✓</span>
                : <span className="badge gold" style={{ marginLeft: "auto" }}>รอทำ</span>}
          </h2>
          {hasBT ? (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                หัตถการ BT ตามคอร์ส: {(snap?.BT_procedures || []).map((p) => procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID)?.name || p.medical_procedure_ID).join(", ")}
              </div>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>ผู้ทำ (BT)</label>
                  <select value={opd.BT_ID || ""} disabled={btDone} onChange={(e) => assign("BT_ID", e.target.value || null)}>
                    <option value="">— เลือก BT —</option>
                    {bts.map((b) => <option key={b.user_ID} value={b.user_ID}>{b.full_name}</option>)}
                  </select>
                </div>
                <AsyncButton className="btn primary" disabled={!measured || !canTreat || !opd.BT_ID || btDone}
                  ok="บันทึกขั้น BT แล้ว" onClick={() => recordStage("BT")}>
                  {btDone ? "บันทึกแล้ว ✓" : "บันทึก + เสร็จขั้น BT"}
                </AsyncButton>
              </div>
              {!canTreat && <div className="muted" style={{ color: "var(--seal)", marginTop: 6 }}>{!paidReady ? "ต้องเลือกคอร์ส + รับเงินก่อน" : "สต๊อกไม่พอ — เติมของก่อน"}</div>}
            </>
          ) : <div className="muted">— ข้ามขั้น BT อัตโนมัติ —</div>}
        </div>
      )}

      {/* 4. ขั้นแพทย์ */}
      {!isClosed && (
        <div className="card" style={stepStyle(measured && (!hasBT || btDone))}>
          <h2><span className="h2-ico">💉</span> ขั้นแพทย์
            {!hasDr ? <span className="badge gray" style={{ marginLeft: "auto" }}>คอร์สนี้ไม่มีขั้นแพทย์</span>
              : drDone ? <span className="badge green" style={{ marginLeft: "auto" }}>เสร็จขั้นแพทย์ ✓</span>
                : <span className="badge red" style={{ marginLeft: "auto" }}>รอทำ</span>}
          </h2>
          {hasDr ? (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                หัตถการแพทย์ตามคอร์ส: {(snap?.doctor_procedures || []).map((p) => procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID)?.name || p.medical_procedure_ID).join(", ")}
              </div>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>ผู้ทำ ({t("doctor")})</label>
                  <select value={opd.doctor_ID || ""} disabled={drDone} onChange={(e) => assign("doctor_ID", e.target.value || null)}>
                    <option value="">— เลือกแพทย์ —</option>
                    {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
                  </select>
                </div>
                <AsyncButton className="btn primary" disabled={!measured || !canTreat || !opd.doctor_ID || drDone || (hasBT && !btDone)}
                  ok="บันทึกขั้นแพทย์แล้ว" onClick={() => recordStage("doctor")}>
                  {drDone ? "บันทึกแล้ว ✓" : "บันทึก + เสร็จขั้นแพทย์"}
                </AsyncButton>
              </div>
              {hasBT && !btDone && <div className="muted" style={{ color: "var(--amber)", marginTop: 6 }}>ทำขั้น BT ให้เสร็จก่อน</div>}
            </>
          ) : <div className="muted">— ข้ามขั้นแพทย์อัตโนมัติ —</div>}
        </div>
      )}

      {/* สรุปหัตถการที่บันทึก */}
      {opd.procedures_done?.length > 0 && (
        <div className="card">
          <h2><span className="h2-ico">📋</span> หัตถการที่บันทึก</h2>
          <table className="tbl">
            <thead><tr><th>หัตถการ</th><th>ประเภท</th><th>ผู้ทำ</th><th>ค่ามือ</th></tr></thead>
            <tbody>
              {opd.procedures_done.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.type === "doctor" ? "red" : "gold"} nodot`}>{p.type === "doctor" ? "แพทย์" : "BT"}</span></td>
                  <td>{userMap[p.performed_by] || p.performed_by}</td>
                  <td>{money(p.cost)}฿</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. add-on — ครั้งแรกย้ายไปติดการ์ดชำระเงินด้านบน · ครั้งต่อไป/ปิดเคสแล้วแสดงตรงนี้ */}
      {(!firstVisit || isClosed) && addonCard}

      {/* 4. ปิดเคส */}
      {canManage && !isClosed && (
        <div className="card" style={{ borderColor: stage === "closing" ? "var(--seal)" : "var(--line)" }}>
          <h2><span className="h2-ico">🔒</span> {t("close_case")}</h2>
          <div className="hint-box" style={{ marginBottom: 12 }}>
            ปิดเคสจะทำ 5 อย่างพร้อมกัน: ตัด stock (FIFO) ตามสูตร course → อัปเดตขวด (ครั้ง+cc)
            → นับครั้ง course → สร้างค่ามือหมอ/BT → คิวเป็น "เสร็จ"
          </div>
          <AsyncButton className="btn primary" disabled={!measured || !canTreat} onClick={doClose}>{t("close_case")}</AsyncButton>
          {!measured && <span className="muted" style={{ marginLeft: 10 }}>ต้องวัดตัวก่อนถึงจะปิดเคสได้</span>}
          {measured && !paidReady && <span className="muted" style={{ marginLeft: 10, color: "var(--seal)" }}>ต้องเลือกคอร์ส + รับเงินก่อน</span>}
          {measured && paidReady && !stockOk && <span className="muted" style={{ marginLeft: 10, color: "var(--seal)" }}>สต๊อกไม่พอ — เติมของก่อนปิดเคส</span>}
        </div>
      )}
    </div>
  );
}
