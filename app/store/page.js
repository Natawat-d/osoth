"use client";
// หน้าลูกค้า (สาธารณะ) — ไม่ต้อง login, ไม่มีเมนูภายใน
//   - เลือกสาขา (เฉพาะสาขาที่เปิดหน้าร้าน)
//   - ดูคิวว่างแบบ privacy (ไม่เห็นชื่อคนจอง)
//   - โปรโมชั่น/คอร์ส + ปุ่มติดต่อ (โทร / LINE)
import { useEffect, useState } from "react";
import CalendarGrid from "@/components/CalendarGrid";
import PromoCarousel from "@/components/PromoCarousel";
import { todayStr, money } from "@/components/ui";

// public fetch — ไม่แนบ auth (ลูกค้า anonymous)
async function pub(path) {
  const res = await fetch(`/api/public${path}`);
  const json = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
  return json.data;
}

export default function StorePage() {
  const [branches, setBranches] = useState(null);
  const [branch, setBranch] = useState(null); // สาขาที่เลือก (object)
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    pub("/storefront")
      .then((b) => {
        setBranches(b);
        if (b.length === 1) setBranch(b[0]); // มีสาขาเดียว → เข้าเลย
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!branch) return;
    setData(null);
    pub(`/calendar?branch_ID=${branch.branch_ID}&date=${date}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [branch, date]);

  const carouselItems = data
    ? [
        ...data.promos.map((p) => ({
          kind: "โปรโมชั่น",
          image: p.banner_image,
          title: p.name,
          subtitle:
            p.type === "discount"
              ? `ลด ${p.discount_value}${p.discount_type === "percent" ? "%" : " บาท"} · ถึง ${p.date_end}`
              : `คอร์สโปรพิเศษ · ถึง ${p.date_end}`,
        })),
        ...data.courses.map((c) => ({
          kind: "คอร์ส",
          image: c.image,
          title: c.name,
          subtitle: `${money(c.price)}฿ · ${c.quantity_used} ครั้ง`,
        })),
      ]
    : [];

  const roomDoctor = {};
  (data?.roster || []).forEach((r) => {
    if (r.room_ID) roomDoctor[r.room_ID] = { name: r.name, color: r.color };
  });

  return (
    <div className="store-bg">
      <header className="store-top">
        <div className="store-brand">
          <span className="store-mark">☯</span>
          <div>
            <div className="store-title">โอสถ · OSOTH</div>
            <div className="store-sub">คลินิกความงาม — คิวว่าง & ติดต่อจอง</div>
          </div>
        </div>
        <a className="btn ghost small" href="/">← เข้าสู่ระบบพนักงาน</a>
      </header>

      <div className="store-wrap">
        {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

        {branches === null && !err && <div className="muted">กำลังโหลด…</div>}
        {branches?.length === 0 && (
          <div className="store-empty">ยังไม่เปิดให้จองออนไลน์ในขณะนี้ — กรุณาติดต่อคลินิกโดยตรง</div>
        )}

        {/* เลือกสาขา */}
        {branches && branches.length > 0 && !branch && (
          <div>
            <h2 className="store-h">เลือกสาขา</h2>
            <div className="store-branch-grid">
              {branches.map((b) => (
                <button key={b.branch_ID} className="store-branch-card" onClick={() => setBranch(b)}>
                  <div className="sb-name">🏢 {b.name}</div>
                  {b.address && <div className="sb-addr">{b.address}</div>}
                  <div className="sb-contact">
                    {b.phone && <span>📞 {b.phone}</span>}
                    {b.line_id && <span>💬 {b.line_id}</span>}
                  </div>
                  <span className="sb-go">ดูคิวว่าง →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ปฏิทินสาขาที่เลือก */}
        {branch && (
          <div className="store-cal">
            <div className="store-cal-head">
              <button className="btn ghost small" onClick={() => setBranch(null)}>← เปลี่ยนสาขา</button>
              <h2 className="store-h" style={{ margin: 0 }}>🏢 {branch.name}</h2>
              <div className="grow" />
              <div className="field" style={{ margin: 0 }}>
                <label>วันที่</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="store-contact-bar">
              <span className="muted">สนใจจองคิว ติดต่อเรา:</span>
              {branch.phone && <a className="btn gold small" href={`tel:${branch.phone}`}>📞 โทร {branch.phone}</a>}
              {branch.line_id && (
                <a className="btn small" href={`https://line.me/R/ti/p/~${encodeURIComponent(branch.line_id.replace(/^@?/, "@"))}`} target="_blank" rel="noreferrer">
                  💬 LINE {branch.line_id}
                </a>
              )}
              {!branch.phone && !branch.line_id && <span className="muted">— ยังไม่ระบุช่องทางติดต่อ —</span>}
            </div>

            <div className="cal-wrap">
              <div className="cal-main">
                <div className="toolbar">
                  <span className="badge gray nodot">คิววันนี้ {data?.events.length ?? 0} รายการ</span>
                  <div className="grow" />
                  <span className="muted" style={{ fontSize: 12 }}>* แสดงเฉพาะช่วงที่ว่าง/ไม่ว่าง ไม่เปิดเผยชื่อผู้จอง</span>
                </div>
                {data ? (
                  <CalendarGrid
                    rooms={data.rooms}
                    events={data.events}
                    doctors={[]}
                    roomDoctor={roomDoctor}
                    privacy
                  />
                ) : (
                  <div className="muted" style={{ padding: 30 }}>กำลังโหลดปฏิทิน…</div>
                )}
              </div>

              <div className="cal-side">
                {carouselItems.length > 0 && <PromoCarousel items={carouselItems} />}
                <div className="card">
                  <h2><span className="h2-ico">👨‍⚕️</span> หมอที่อยู่วันนี้</h2>
                  {(!data || data.roster.length === 0) && (
                    <div className="muted">— ยังไม่มีหมอลงตารางวันนี้ —</div>
                  )}
                  {data?.roster.map((d, i) => (
                    <div className="roster-item" key={i}>
                      <span className="roster-swatch" style={{ background: d.color }} />
                      <div style={{ flex: 1 }}>
                        <div className="roster-name">{d.name}</div>
                        <div className="roster-meta">{d.room_ID || "—"} · {d.time_start}–{d.time_end}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
