"use client";
// HR (บุคคล) V2 เต็ม — พนักงาน (ฟอร์ม HR เต็ม + login + รูป) · Org chart · รายงาน
// data ผ่าน RTK Query ทั้งหมด — mutation invalidate "Users" → ทุกแท็บรีเฟรชเอง
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation, useSetUserLoginMutation,
} from "@/store/apiSlice";
import { ThroughputReport } from "@/components/lgc/StaffTools";
import ScheduleRanges from "@/components/ScheduleRanges";
import PayrollTab from "@/components/PayrollTab";

// V3: 5 roles — admin คือ จอง+รับลูกค้า+OPD ในตัว (ไม่มีแผนกต้อนรับแยกแล้ว)
const ROLES = [
  { value: "admin", label: "แอดมิน (จอง/รับลูกค้า/OPD)" },
  { value: "sale", label: "ฝ่ายขาย (จอง/ขายคอร์ส)" },
  { value: "doctor", label: "แพทย์" },
  { value: "BT", label: "ผู้ช่วยหัตถการ (BT)" },
];
const ROLE_TH = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));
ROLE_TH.super_admin = "เจ้าของระบบ";
const money = (n) => Number(n || 0).toLocaleString("th-TH");

export default function HrV2Page() {
  const role = useSelector((s) => s.auth.user?.role);
  const [tab, setTab] = useState("staff");

  if (role && role !== "super_admin")
    return <div className="app-content"><div className="container-fluid pt-3"><div className="alert alert-warning">เฉพาะเจ้าของระบบ</div></div></div>;

  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="d-flex align-items-center mb-3">
          <h4 className="mb-0 fw-bold">บุคคล (HR)</h4>
        </div>
        <ul className="nav nav-tabs mb-3">
          {[["staff", "bi-people", "พนักงาน"], ["schedule", "bi-calendar3", "ตารางหมอ"], ["payroll", "bi-cash-coin", "เงินเดือน"], ["org", "bi-diagram-3", "ผังองค์กร"], ["report", "bi-clipboard-data", "รายงาน"], ["throughput", "bi-activity", "อัตราทำเคส"]].map(([k, ico, l]) => (
            <li className="nav-item" key={k}>
              <button className={`nav-link ${tab === k ? "active fw-semibold" : ""}`} onClick={() => setTab(k)}>
                <i className={`bi ${ico} me-1`} />{l}
              </button>
            </li>
          ))}
        </ul>
        {tab === "staff" && <StaffTab />}
        {tab === "schedule" && <ScheduleRanges />}
        {tab === "payroll" && <PayrollTab />}
        {tab === "org" && <OrgTab />}
        {tab === "report" && <ReportTab />}
        {tab === "throughput" && <div className="lgc"><ThroughputReport /></div>}
      </div>
    </div>
  );
}

// ── แท็บพนักงาน ──
function StaffTab() {
  const { data: users = [], error } = useGetUsersQuery();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");

  return (
    <>
      <div className="d-flex mb-2">
        <span className="text-muted small align-self-center">เพิ่ม/แก้ไขพนักงาน + สิทธิ์เข้าระบบ + ข้อมูล HR</span>
        <button className="btn btn-primary btn-sm ms-auto" onClick={() => setForm({})}>
          <i className="bi bi-person-plus me-1" /> เพิ่มพนักงาน
        </button>
      </div>
      {error && <div className="alert alert-danger py-2">{error.message}</div>}
      {msg && <div className="alert alert-success py-2">{msg}</div>}

      <div className="card shadow-sm">
        <div className="card-body p-0" style={{ overflowX: "auto" }}>
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 56 }}></th>
                <th>ชื่อ</th><th>ตำแหน่ง</th><th>username</th><th className="text-end">เงินเดือน</th>
                <th>เริ่มงาน</th><th className="text-center">สถานะ</th><th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_ID} className={u.active === false ? "opacity-50" : ""}>
                  <td>
                    {u.profile_picture
                      ? <img src={u.profile_picture} alt="" width={38} height={38} className="rounded-circle object-fit-cover" />
                      : <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold" style={{ width: 38, height: 38 }}>{(u.nick_name || u.full_name).slice(0, 2)}</span>}
                  </td>
                  <td>
                    <div className="fw-semibold">{u.full_name}</div>
                    <small className="text-muted">{u.nick_name}{u.phone ? ` · ${u.phone}` : ""}</small>
                  </td>
                  <td><span className="badge text-bg-light border">{ROLE_TH[u.role] || u.role}</span></td>
                  <td className="font-monospace small">{u.username || <span className="text-muted">—</span>}</td>
                  <td className="text-end">{u.salary ? money(u.salary) : <span className="text-muted">—</span>}</td>
                  <td className="small">{u.start_date || "—"}</td>
                  <td className="text-center">
                    {u.active !== false
                      ? <span className="badge text-bg-success">ใช้งาน</span>
                      : <span className="badge text-bg-secondary">ปิด</span>}
                  </td>
                  <td className="text-end pe-3">
                    {u.role !== "super_admin" && (
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setForm(u)}><i className="bi bi-pencil" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={8} className="text-center text-muted py-4">— ยังไม่มีพนักงาน —</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form !== null && (
        <StaffForm initial={form} onClose={() => setForm(null)}
          onSaved={(m) => { setForm(null); setMsg(m); setTimeout(() => setMsg(""), 4000); }} />
      )}
    </>
  );
}

// ฟอร์มพนักงานเต็ม (ข้อมูลงาน + login + HR + ค่าตัว) — props เฉพาะ ephemeral (doc แก้ + callback ปิด)
function StaffForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial.user_ID;
  const { data: users = [] } = useGetUsersQuery();
  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [setUserLogin] = useSetUserLoginMutation();
  const [f, setF] = useState({
    full_name: initial.full_name || "", nick_name: initial.nick_name || "",
    role: initial.role || "admin", phone: initial.phone || "", email: initial.email || "",
    username: initial.username || "", password: "", profile_picture: initial.profile_picture || "",
    active: initial.active !== false,
    salary: initial.salary || 0, start_date: initial.start_date || "",
    id_card: initial.id_card || "", address: initial.address || "",
    emergency_contact: initial.emergency_contact || "", manager_ID: initial.manager_ID || "",
    rate_per_hour: initial.rate_per_hour || 0, hand_fee: initial.hand_fee || 0, doctor_fee: initial.doctor_fee || 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const isPro = f.role === "doctor" || f.role === "BT"; // ค่าตัวแยกจากพนักงานธรรมดา

  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("รูปต้องไม่เกิน 2MB");
    const reader = new FileReader();
    reader.onload = () => setF((s) => ({ ...s, profile_picture: reader.result }));
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!f.full_name.trim()) return setError("กรุณากรอกชื่อ-นามสกุล");
    if (!isEdit && (!f.username.trim() || !f.password)) return setError("กรุณาตั้ง username และรหัสผ่าน");
    setBusy(true);
    const body = {
      full_name: f.full_name, nick_name: f.nick_name, role: f.role, phone: f.phone, email: f.email,
      profile_picture: f.profile_picture, active: f.active,
      salary: Number(f.salary) || 0, start_date: f.start_date, id_card: f.id_card, address: f.address,
      emergency_contact: f.emergency_contact, manager_ID: f.manager_ID || null,
      rate_per_hour: Number(f.rate_per_hour) || 0, hand_fee: Number(f.hand_fee) || 0, doctor_fee: Number(f.doctor_fee) || 0,
    };
    try {
      if (isEdit) {
        await updateUser({ user_ID: initial.user_ID, ...body }).unwrap();
        if (f.password) await setUserLogin({ user_ID: initial.user_ID, username: f.username, password: f.password }).unwrap();
        onSaved("บันทึกข้อมูลพนักงานแล้ว");
      } else {
        const u = await createUser(body).unwrap();
        await setUserLogin({ user_ID: u.user_ID, username: f.username, password: f.password }).unwrap();
        onSaved(`เพิ่มพนักงาน ${f.full_name} แล้ว (username: ${f.username})`);
      }
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  }

  const managers = users.filter((u) => u.user_ID !== initial.user_ID && u.active !== false);

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,.4)", overflowY: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <form className="modal-content" onSubmit={submit}>
          <div className="modal-header">
            <h5 className="modal-title fw-bold">{isEdit ? `แก้ไข: ${initial.full_name}` : "เพิ่มพนักงานใหม่"}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <div className="row g-3">
              <div className="col-md-3 text-center">
                {f.profile_picture
                  ? <img src={f.profile_picture} alt="" className="rounded-circle object-fit-cover mb-2" width={96} height={96} />
                  : <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center mx-auto mb-2" style={{ width: 96, height: 96 }}><i className="bi bi-person fs-1 text-muted" /></div>}
                <label className="btn btn-outline-secondary btn-sm d-block ms-auto px-4">
                  <i className="bi bi-image me-1" /> รูปโปรไฟล์
                  <input type="file" accept="image/*" hidden onChange={pickImage} />
                </label>
              </div>
              <div className="col-md-9">
                <div className="row g-2">
                  <div className="col-md-8"><label className="form-label small">ชื่อ-นามสกุล *</label><input className="form-control form-control-sm" value={f.full_name} onChange={set("full_name")} required /></div>
                  <div className="col-md-4"><label className="form-label small">ชื่อเล่น</label><input className="form-control form-control-sm" value={f.nick_name} onChange={set("nick_name")} /></div>
                  <div className="col-md-4"><label className="form-label small">ตำแหน่ง *</label>
                    <select className="form-select form-select-sm" value={f.role} onChange={set("role")} disabled={isEdit}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4"><label className="form-label small">เบอร์โทร</label><input className="form-control form-control-sm" value={f.phone} onChange={set("phone")} /></div>
                  <div className="col-md-4"><label className="form-label small">อีเมล</label><input className="form-control form-control-sm" value={f.email} onChange={set("email")} /></div>
                  <div className="col-md-6"><label className="form-label small">username {isEdit ? "" : "*"}</label><input className="form-control form-control-sm" value={f.username} onChange={set("username")} autoComplete="off" /></div>
                  <div className="col-md-6"><label className="form-label small">{isEdit ? "รหัสผ่านใหม่ (ว่าง = ไม่เปลี่ยน)" : "รหัสผ่าน *"}</label><input type="password" className="form-control form-control-sm" value={f.password} onChange={set("password")} autoComplete="new-password" /></div>
                </div>
              </div>

              <div className="col-12"><hr className="my-1" /><b className="small text-primary"><i className="bi bi-briefcase me-1" />ข้อมูล HR</b></div>
              <div className="col-md-3"><label className="form-label small">เงินเดือน (บาท)</label><input type="number" className="form-control form-control-sm" value={f.salary} onChange={set("salary")} /></div>
              <div className="col-md-3"><label className="form-label small">วันเริ่มงาน</label><input type="date" className="form-control form-control-sm" value={f.start_date} onChange={set("start_date")} /></div>
              <div className="col-md-3"><label className="form-label small">เลขบัตรประชาชน</label><input className="form-control form-control-sm" value={f.id_card} onChange={set("id_card")} /></div>
              <div className="col-md-3"><label className="form-label small">หัวหน้า (org chart)</label>
                <select className="form-select form-select-sm" value={f.manager_ID || ""} onChange={set("manager_ID")}>
                  <option value="">— ไม่มี (ขึ้นตรงเจ้าของ) —</option>
                  {managers.map((m) => <option key={m.user_ID} value={m.user_ID}>{m.nick_name || m.full_name} ({ROLE_TH[m.role] || m.role})</option>)}
                </select>
              </div>
              <div className="col-md-6"><label className="form-label small">ที่อยู่</label><input className="form-control form-control-sm" value={f.address} onChange={set("address")} /></div>
              <div className="col-md-6"><label className="form-label small">ผู้ติดต่อฉุกเฉิน (ชื่อ+เบอร์)</label><input className="form-control form-control-sm" value={f.emergency_contact} onChange={set("emergency_contact")} /></div>

              {isPro && (
                <>
                  <div className="col-12"><hr className="my-1" /><b className="small text-primary"><i className="bi bi-cash-coin me-1" />ค่าตัว {f.role === "doctor" ? "หมอ" : "BT"} (แยกจากพนักงานธรรมดา)</b></div>
                  <div className="col-md-4"><label className="form-label small">ค่าตัวต่อชั่วโมง (บาท)</label><input type="number" className="form-control form-control-sm" value={f.rate_per_hour} onChange={set("rate_per_hour")} /></div>
                  {f.role === "BT" && <div className="col-md-4"><label className="form-label small">ค่ามือ default (บาท/หัตถการ)</label><input type="number" className="form-control form-control-sm" value={f.hand_fee} onChange={set("hand_fee")} /></div>}
                  {f.role === "doctor" && <div className="col-md-4"><label className="form-label small">DF ค่ามือหมอ default (บาท)</label><input type="number" className="form-control form-control-sm" value={f.doctor_fee} onChange={set("doctor_fee")} /></div>}
                </>
              )}

              {isEdit && (
                <div className="col-12">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="fActive" checked={f.active} onChange={set("active")} />
                    <label className="form-check-label" htmlFor="fActive">เปิดใช้งานบัญชีนี้</label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ผังองค์กร (tree จาก manager_ID — root = เจ้าของ) ──
function OrgTab() {
  const { data: users = [] } = useGetUsersQuery();
  const active = users.filter((u) => u.active !== false);
  const owner = active.find((u) => u.role === "super_admin");
  const childrenOf = (id) =>
    active.filter((u) => u.role !== "super_admin" && ((u.manager_ID || null) === id || (!u.manager_ID && id === owner?.user_ID)));

  return (
    <div className="card shadow-sm">
      <div className="card-header fw-semibold">ผังองค์กร <span className="text-muted small">(ตั้ง "หัวหน้า" ในฟอร์มพนักงาน — ไม่ตั้ง = ขึ้นตรงเจ้าของ)</span></div>
      <div className="card-body" style={{ overflowX: "auto" }}>
        {owner ? <OrgNode user={owner} childrenOf={childrenOf} depth={0} /> : <div className="text-muted">— ไม่มีข้อมูล —</div>}
      </div>
    </div>
  );
}

function OrgNode({ user, childrenOf, depth }) {
  const kids = childrenOf(user.user_ID);
  return (
    <div style={{ marginLeft: depth ? 28 : 0, borderLeft: depth ? "2px solid #dee2e6" : "none", paddingLeft: depth ? 14 : 0, marginTop: 8 }}>
      <div className="d-inline-flex align-items-center gap-2 border rounded-3 px-3 py-2 shadow-sm bg-body">
        {user.profile_picture
          ? <img src={user.profile_picture} alt="" width={34} height={34} className="rounded-circle object-fit-cover" />
          : <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold" style={{ width: 34, height: 34, fontSize: 13 }}>{(user.nick_name || user.full_name).slice(0, 2)}</span>}
        <div>
          <div className="fw-semibold small">{user.nick_name || user.full_name}</div>
          <div className="text-muted" style={{ fontSize: 11 }}>{ROLE_TH[user.role] || user.role}</div>
        </div>
      </div>
      {kids.map((k) => <OrgNode key={k.user_ID} user={k} childrenOf={childrenOf} depth={depth + 1} />)}
    </div>
  );
}

// ── รายงาน HR ──
function ReportTab() {
  const { data: users = [] } = useGetUsersQuery();
  const active = users.filter((u) => u.active !== false);
  const byRole = useMemo(() => {
    const m = {};
    for (const u of active) {
      m[u.role] = m[u.role] || { role: u.role, count: 0, salary: 0 };
      m[u.role].count += 1;
      m[u.role].salary += u.salary || 0;
    }
    return Object.values(m);
  }, [active]);
  const totalSalary = active.reduce((s, u) => s + (u.salary || 0), 0);
  const pros = active.filter((u) => u.role === "doctor" || u.role === "BT");

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="card text-bg-primary shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{active.length}</div><div>พนักงานทั้งหมด</div></div></div>
      </div>
      <div className="col-md-4">
        <div className="card text-bg-success shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{money(totalSalary)}</div><div>เงินเดือนรวม/เดือน (บาท)</div></div></div>
      </div>
      <div className="col-md-4">
        <div className="card text-bg-info shadow-sm"><div className="card-body"><div className="fs-3 fw-bold">{pros.length}</div><div>หมอ + BT (ค่าตัวแยก)</div></div></div>
      </div>
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">จำนวน & เงินเดือนตามตำแหน่ง</div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead className="table-light"><tr><th>ตำแหน่ง</th><th className="text-end">จำนวน</th><th className="text-end">เงินเดือนรวม</th></tr></thead>
              <tbody>
                {byRole.map((r) => (
                  <tr key={r.role}><td>{ROLE_TH[r.role] || r.role}</td><td className="text-end">{r.count}</td><td className="text-end">{money(r.salary)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-lg-6">
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">ค่าตัวหมอ/BT (บาท)</div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead className="table-light"><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th className="text-end">ค่าตัว/ชม.</th><th className="text-end">ค่ามือ/DF</th></tr></thead>
              <tbody>
                {pros.map((u) => (
                  <tr key={u.user_ID}>
                    <td>{u.nick_name || u.full_name}</td><td className="small text-muted">{ROLE_TH[u.role]}</td>
                    <td className="text-end">{money(u.rate_per_hour)}</td>
                    <td className="text-end">{money(u.role === "doctor" ? u.doctor_fee : u.hand_fee)}</td>
                  </tr>
                ))}
                {!pros.length && <tr><td colSpan={4} className="text-center text-muted py-3">— ยังไม่มีหมอ/BT —</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
