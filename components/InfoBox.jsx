"use client";
// info-box สไตล์ AdminLTE (ref widgets/info-box): กล่องไอคอนสี + ตัวเลขใหญ่
// ใช้เป็นหัวสรุปของทุกหน้า (ตามคำตอบข้อ 18) · กดได้ถ้าส่ง onClick (ใช้เป็น filter)
export default function InfoBox({ ico, label, value, color = "primary", active = false, onClick, sub }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="osoth-ib-wrap w-100 text-start border-0 p-0 bg-transparent"
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className={`osoth-ib ${onClick ? "osoth-ib-click" : ""} d-flex align-items-center rounded-3 bg-body ${active ? "border border-2 border-" + color : "border"} p-2`}>
        <span className={`osoth-ib-chip d-inline-flex align-items-center justify-content-center rounded-3 text-bg-${color} me-2`}
              style={{ width: 46, height: 46, fontSize: 21 }}>
          <i className={`bi ${ico}`} />
        </span>
        <span className="lh-1 min-w-0">
          <span className="osoth-ib-label d-block text-muted text-truncate">{label}</span>
          <b className="osoth-ib-value d-block">{value}</b>
          {sub && <span className="d-block text-muted text-truncate" style={{ fontSize: 11 }}>{sub}</span>}
        </span>
      </div>
      <style jsx>{`
        .osoth-ib {
          box-shadow: var(--osoth-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.05), 0 3px 12px rgba(15, 23, 42, 0.06));
          transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
        }
        .osoth-ib-click:hover {
          transform: translateY(-2px);
          box-shadow: var(--osoth-shadow-lg, 0 6px 16px rgba(15, 23, 42, 0.1), 0 14px 34px rgba(15, 23, 42, 0.1));
        }
        .osoth-ib-wrap:focus-visible {
          outline: none;
        }
        .osoth-ib-wrap:focus-visible .osoth-ib {
          box-shadow: var(--osoth-ring, 0 0 0 0.22rem rgba(21, 96, 163, 0.16));
        }
        .osoth-ib-chip {
          /* gradient เงาแสงทับสีเดิมของ text-bg-* — ได้ chip ไล่เฉดทุกสีโดยไม่ fix สี */
          background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.02) 48%, rgba(0, 0, 0, 0.16) 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 2px 8px rgba(15, 23, 42, 0.18);
          flex: 0 0 auto;
        }
        .osoth-ib-label {
          font-size: 11.5px;
          letter-spacing: 0.045em;
        }
        .osoth-ib-value {
          font-size: 1.3rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
      `}</style>
    </Tag>
  );
}
