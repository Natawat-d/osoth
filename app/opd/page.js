"use client";
// หน้า OPD / หน้าห้อง: คิวที่มาถึง → เปิดเคส (สร้าง HN ถ้าลูกค้าใหม่) → วัดตัว (บังคับ)
// → มอบหมาย BT/หมอ → บันทึกหัตถการ → add-on → ปิดเคส (ตัด stock + นับครั้ง + ค่ามือ)
import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { StatusBadge, Stepper, todayStr, money } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/i18n/messages";

// ลำดับขั้นของเคส (แสดงเป็น Stepper ให้ชัด)
const CASE_STEPS = [
  { key: "open", label: "เปิดเคส" },
  { key: "measuring", label: "วัดตัว" },
  { key: "procedure", label: "ทำหัตถการ" },
  { key: "closing", label: "ปิดเคส" },
];
function caseStage(opd) {
  if (opd.status === "closed") return "__complete__";
  if (!opd.opd_data?.measured_at) return "measuring";
  if (!(opd.procedures_done?.length)) return "procedure";
  return "closing";
}

export default function OpdPage() {
  const auth = useSelector((s) => s.auth);
  const branch_ID = auth.branch_ID;
  const t = useT();
  const [date, setDate] = useState(todayStr());
  const [reserves, setReserves] = useState([]);
  const [opds, setOpds] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!branch_ID) return;
    api(`/reserves?branch_ID=${branch_ID}&date=${date}`).then(setReserves);
    api(`/opd?branch_ID=${branch_ID}&date=${date}`).then(setOpds);
  }, [branch_ID, date]);
  useEffect(load, [load]);

  const myRole = auth.user?.role;
  const isStaffOnly = ["doctor", "BT"].includes(myRole);
  const visibleReserves = reserves.filter((r) => {
    if (["cancelled", "no_show"].includes(r.status)) return false;
    if (myRole === "doctor") return r.doctor_ID === auth.user.user_ID;
    if (myRole === "BT") return !r.BT_ID || r.BT_ID === auth.user.user_ID;
    return true;
  });

  return (
    <div>
      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}>
          <label>{t("date")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grow" />
        <span className="badge gray nodot">คิว {visibleReserves.length} รายการ</span>
      </div>
      {error && <div className="err">{error}</div>}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 340, flexShrink: 0 }}>
          <div className="card">
            <h2><span className="h2-ico">📋</span> คิววันนี้</h2>
            {visibleReserves.length === 0 && (
              <div className="empty-state"><span className="es-ico">🍵</span>ยังไม่มีคิว</div>
            )}
            {visibleReserves.map((r) => {
              const opd = opds.find((o) => o.opd_ID === r.opd_ID);
              return (
                <QueueItem
                  key={r.reserve_ID}
                  r={r}
                  opd={opd}
                  t={t}
                  selected={active?.opd_ID && active.opd_ID === r.opd_ID}
                  isStaffOnly={isStaffOnly}
                  onError={setError}
                  onChanged={load}
                  onOpen={(o) => setActive(o)}
                />
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {active ? (
            <CaseEditor
              opd_ID={active.opd_ID}
              t={t}
              auth={auth}
              onError={setError}
              onChanged={load}
              onClose={() => { setActive(null); load(); }}
            />
          ) : (
            <div className="card">
              <div className="empty-state">
                <span className="es-ico">🩺</span>
                เลือกคิวจากด้านซ้ายเพื่อเริ่มทำเคส
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueItem({ r, opd, t, selected, isStaffOnly, onError, onChanged, onOpen }) {
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({
    full_name: "", sure_name: "", nick_name: r.contact?.nick_name || "", phone: r.contact?.phone || "",
  });

  const openCase = async () => {
    onError("");
    try {
      let HN = r.HN_number;
      if (!HN) { setShowNew(true); return; }
      const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: HN } });
      onChanged();
      onOpen(o);
    } catch (e) { onError(e.message); }
  };

  const createCustomerAndOpen = async () => {
    onError("");
    try {
      const c = await api("/customers", { method: "POST", body: { ...newCust, branch_ID: r.branch_ID } });
      await api(`/reserves/${r.reserve_ID}`, { method: "PUT", body: { HN_number: c.HN_number } });
      const o = await api("/opd", { method: "POST", body: { reserve_ID: r.reserve_ID, HN_number: c.HN_number } });
      setShowNew(false);
      onChanged();
      onOpen(o);
    } catch (e) { onError(e.message); }
  };

  return (
    <div className={`q-item ${selected ? "selected" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span className="q-time">{r.time_start}</span>
        <StatusBadge status={r.status} />
      </div>
      <div style={{ margin: "4px 0 8px" }}>
        <b>{r.contact?.nick_name || r.HN_number || "ลูกค้าใหม่"}</b>
        <span className="muted"> · {r.room_ID}{r.is_walk_in ? " · Walk-in" : ""}</span>
      </div>
      <div className="row">
        {!r.opd_ID && !isStaffOnly && ["arrived", "ready", "in_progress"].includes(r.status) && (
          <button className="btn small primary" onClick={openCase}>{t("open_case")}</button>
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
          {["full_name", "sure_name", "nick_name", "phone"].map((k) => (
            <div className="field" key={k} style={{ marginTop: 8 }}>
              <label>{{ full_name: "ชื่อ", sure_name: "นามสกุล", nick_name: "ชื่อเล่น", phone: "เบอร์โทร" }[k]}</label>
              <input value={newCust[k]} onChange={(e) => setNewCust((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <button className="btn primary small" style={{ marginTop: 8 }} disabled={!newCust.full_name} onClick={createCustomerAndOpen}>
            สร้าง HN + เปิดเคส
          </button>
        </div>
      )}
    </div>
  );
}

function CaseEditor({ opd_ID, t, auth, onError, onChanged, onClose }) {
  const [opd, setOpd] = useState(null);
  const [cc, setCc] = useState(null);
  const [bts, setBts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [products, setProducts] = useState([]);
  const [vitals, setVitals] = useState({ blood_pressure: "", heart_rate: "", weight_kg: "", height_cm: "", fat_mass: "", muscle_mass: "", other: "" });
  const [addon, setAddon] = useState({ product_ID: "", qty: 1, method: "cash" });
  const [closing, setClosing] = useState(false);

  const reload = useCallback(async () => {
    const o = await api(`/opd/${opd_ID}`);
    setOpd(o);
    if (o.opd_data?.measured_at) setVitals((v) => ({ ...v, ...o.opd_data }));
    const list = await api(`/customer-courses?HN=${o.HN_number}`);
    setCc(list.find((x) => x.customer_course_ID === o.customer_course_ID) || null);
  }, [opd_ID]);

  useEffect(() => {
    reload();
    api("/users?role=BT").then(setBts);
    api("/users?role=doctor").then(setDoctors);
    api("/procedures").then(setProcedures);
    api("/products").then((p) => setProducts(p.filter((x) => x.active)));
  }, [reload]);

  if (!opd) return <div className="card"><div className="empty-state">{t("loading")}</div></div>;
  const snap = cc?.course_snapshot;
  const canManage = ["super_admin", "admin", "acception"].includes(auth.user.role);
  const stage = caseStage(opd);
  const measured = !!opd.opd_data?.measured_at;
  const isClosed = opd.status === "closed";

  const saveVitals = async () => {
    onError("");
    try {
      await api(`/opd/${opd_ID}`, {
        method: "PUT",
        body: { opd_data: { ...vitals, heart_rate: +vitals.heart_rate || 0, weight_kg: +vitals.weight_kg || 0, height_cm: +vitals.height_cm || 0, fat_mass: +vitals.fat_mass || 0, muscle_mass: +vitals.muscle_mass || 0 } },
      });
      reload();
    } catch (e) { onError(e.message); }
  };

  const assign = async (field, value) => {
    onError("");
    try { await api(`/opd/${opd_ID}`, { method: "PUT", body: { [field]: value } }); reload(); }
    catch (e) { onError(e.message); }
  };

  const recordProcedures = async () => {
    onError("");
    try {
      const done = [];
      for (const p of snap?.BT_procedures || []) {
        const mp = procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID);
        if (mp && opd.BT_ID) done.push({ medical_procedure_ID: mp.medical_procedure_ID, name: mp.name, type: "BT", performed_by: opd.BT_ID, cost: mp.cost });
      }
      for (const p of snap?.doctor_procedures || []) {
        const mp = procedures.find((x) => x.medical_procedure_ID === p.medical_procedure_ID);
        if (mp && opd.doctor_ID) done.push({ medical_procedure_ID: mp.medical_procedure_ID, name: mp.name, type: "doctor", performed_by: opd.doctor_ID, cost: mp.cost });
      }
      await api(`/opd/${opd_ID}`, { method: "PUT", body: { procedures_done: done } });
      reload();
    } catch (e) { onError(e.message); }
  };

  const doAddon = async () => {
    onError("");
    try {
      await api(`/opd/${opd_ID}/addon`, { method: "POST", body: addon });
      setAddon({ product_ID: "", qty: 1, method: "cash" });
      reload();
    } catch (e) { onError(e.message); }
  };

  const doClose = async () => {
    onError("");
    setClosing(true);
    try {
      const res = await api(`/opd/${opd_ID}/close`, { method: "POST" });
      alert(`ปิดเคสสำเร็จ ✓\nตัด stock ${res.stock_used.length} รายการ\nคงเหลือ ${res.uses_remaining} ครั้ง${res.course_completed ? " (course ครบแล้ว)" : ""}`);
      onClose();
    } catch (e) { onError(e.message); }
    finally { setClosing(false); }
  };

  const stepStyle = (on) => ({ opacity: on ? 1 : 0.55, transition: "opacity .15s" });

  return (
    <div>
      {/* หัวเคส + Stepper สถานะ */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>
            {snap?.name || "เคส"}
          </span>
          <span className="badge gold nodot">HN {opd.HN_number}</span>
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

      {isClosed && (
        <div className="card" style={{ borderColor: "var(--jade)", background: "var(--jade-tint)" }}>
          <b style={{ color: "var(--jade)", fontFamily: "var(--font-display)" }}>✓ ปิดเคสเรียบร้อยแล้ว</b>
          <div className="muted" style={{ marginTop: 4 }}>
            ตัด stock {opd.stock_used?.length || 0} รายการ · ต้นทุนรวม {money((opd.stock_used || []).reduce((s, u) => s + (u.cost_of_goods || 0), 0))}฿
          </div>
        </div>
      )}

      {/* 1. วัดตัว */}
      <div className="card" style={stepStyle(!isClosed ? stage === "measuring" || measured : true)}>
        <h2>
          <span className="h2-ico">📏</span> {t("measure")}
          <span className="muted" style={{ fontWeight: 400 }}>(บังคับทุกครั้ง)</span>
          {measured && <span className="badge green" style={{ marginLeft: "auto" }}>บันทึกแล้ว</span>}
        </h2>
        <div className="row">
          {[
            ["blood_pressure", "ความดัน", "text"],
            ["heart_rate", "ชีพจร", "number"],
            ["weight_kg", "น้ำหนัก (kg)", "number"],
            ["height_cm", "ส่วนสูง (cm)", "number"],
            ["fat_mass", "มวลไขมัน", "number"],
            ["muscle_mass", "มวลกล้ามเนื้อ", "number"],
          ].map(([k, label, type]) => (
            <div className="field" key={k}>
              <label>{label}</label>
              <input type={type} disabled={isClosed} value={vitals[k]} onChange={(e) => setVitals((v) => ({ ...v, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        {!isClosed && (
          <button className="btn primary" style={{ marginTop: 12 }} onClick={saveVitals}>
            บันทึกการวัดตัว {measured && "✓"}
          </button>
        )}
      </div>

      {/* 2. มอบหมาย + หัตถการ */}
      <div className="card" style={stepStyle(measured || isClosed)}>
        <h2><span className="h2-ico">💉</span> มอบหมาย + บันทึกหัตถการ</h2>
        <div className="row">
          <div className="field">
            <label>BT (pre-procedure)</label>
            <select value={opd.BT_ID || ""} disabled={isClosed} onChange={(e) => assign("BT_ID", e.target.value || null)}>
              <option value="">— ข้ามขั้น BT —</option>
              {bts.map((b) => <option key={b.user_ID} value={b.user_ID}>{b.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t("doctor")}</label>
            <select value={opd.doctor_ID || ""} disabled={isClosed} onChange={(e) => assign("doctor_ID", e.target.value || null)}>
              <option value="">— ข้ามขั้นหมอ —</option>
              {doctors.map((d) => <option key={d.user_ID} value={d.user_ID}>{d.full_name}</option>)}
            </select>
          </div>
          {!isClosed && (
            <button className="btn" disabled={!measured} onClick={recordProcedures}>บันทึกหัตถการตาม course</button>
          )}
        </div>
        {opd.procedures_done?.length > 0 && (
          <table className="tbl" style={{ marginTop: 12 }}>
            <thead><tr><th>หัตถการ</th><th>ประเภท</th><th>ผู้ทำ</th><th>ค่ามือ</th></tr></thead>
            <tbody>
              {opd.procedures_done.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.type === "doctor" ? "red" : "gold"} nodot`}>{p.type}</span></td>
                  <td>{p.performed_by}</td>
                  <td>{money(p.cost)}฿</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. add-on */}
      <div className="card">
        <h2><span className="h2-ico">➕</span> {t("add_on")}
          <span className="muted" style={{ fontWeight: 400 }}>(เก็บเงินทันที แยกบิล)</span>
        </h2>
        {!isClosed && (
          <div className="row">
            <div className="field">
              <label>สินค้า</label>
              <select value={addon.product_ID} onChange={(e) => setAddon((f) => ({ ...f, product_ID: e.target.value }))}>
                <option value="">—</option>
                {products.map((p) => <option key={p.product_ID} value={p.product_ID}>{p.name} · {money(p.selling_price)}฿</option>)}
              </select>
            </div>
            <div className="field">
              <label>จำนวน</label>
              <input type="number" min={1} value={addon.qty} onChange={(e) => setAddon((f) => ({ ...f, qty: +e.target.value }))} />
            </div>
            <div className="field">
              <label>ช่องทาง</label>
              <select value={addon.method} onChange={(e) => setAddon((f) => ({ ...f, method: e.target.value }))}>
                <option value="cash">เงินสด</option><option value="transfer">โอน</option><option value="card">บัตร</option>
              </select>
            </div>
            <button className="btn gold" disabled={!addon.product_ID} onClick={doAddon}>+ {t("add_on")}</button>
          </div>
        )}
        {opd.add_ons?.length > 0 && (
          <div style={{ marginTop: isClosed ? 0 : 10 }}>
            {opd.add_ons.map((a, i) => (
              <div key={i} className="roster-item">
                <span style={{ flex: 1 }}>{a.name} ×{a.qty}</span>
                <span className="badge gold nodot">{money(a.price)}฿</span>
                <span className="muted">บิล {a.payment_ID}</span>
              </div>
            ))}
          </div>
        )}
        {isClosed && !opd.add_ons?.length && <div className="muted">— ไม่มี add-on —</div>}
      </div>

      {/* 4. ปิดเคส */}
      {canManage && !isClosed && (
        <div className="card" style={{ borderColor: stage === "closing" ? "var(--seal)" : "var(--line)" }}>
          <h2><span className="h2-ico">🔒</span> {t("close_case")}</h2>
          <div className="hint-box" style={{ marginBottom: 12 }}>
            ปิดเคสจะทำ 5 อย่างพร้อมกัน: ตัด stock (FIFO) ตามสูตร course → อัปเดตขวด (ครั้ง+cc)
            → นับครั้ง course → สร้างค่ามือหมอ/BT → คิวเป็น "เสร็จ"
          </div>
          <button className="btn primary" disabled={closing || !measured} onClick={doClose}>
            {closing ? "กำลังปิดเคส..." : t("close_case")}
          </button>
          {!measured && <span className="muted" style={{ marginLeft: 10 }}>ต้องวัดตัวก่อนถึงจะปิดเคสได้</span>}
        </div>
      )}
    </div>
  );
}
