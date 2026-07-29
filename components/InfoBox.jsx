"use client";
// info-box สไตล์ AdminLTE (ref widgets/info-box): กล่องไอคอนสี + ตัวเลขใหญ่
// ใช้เป็นหัวสรุปของทุกหน้า (ตามคำตอบข้อ 18) · กดได้ถ้าส่ง onClick (ใช้เป็น filter)
export default function InfoBox({ ico, label, value, color = "primary", active = false, onClick, sub }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-100 text-start border-0 p-0 bg-transparent ${onClick ? "" : ""}`}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className={`d-flex align-items-center rounded-3 shadow-sm bg-body ${active ? "border border-2 border-" + color : "border"} p-2`}>
        <span className={`d-inline-flex align-items-center justify-content-center rounded-2 text-bg-${color} me-2`}
              style={{ width: 44, height: 44, fontSize: 20 }}>
          <i className={`bi ${ico}`} />
        </span>
        <span className="lh-1 min-w-0">
          <span className="d-block text-muted text-truncate" style={{ fontSize: 12 }}>{label}</span>
          <b className="fs-5">{value}</b>
          {sub && <span className="d-block text-muted text-truncate" style={{ fontSize: 11 }}>{sub}</span>}
        </span>
      </div>
    </Tag>
  );
}
