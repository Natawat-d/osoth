"use client";
// การ์ด "โมดูลกำลังพัฒนา" — ใช้เป็น placeholder ของโมดูล V2 ระหว่างทยอยสร้างตามเฟส
export default function ComingSoon({ title, ico = "bi-cone-striped", items = [] }) {
  return (
    <div className="app-content">
      <div className="container-fluid pt-3">
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <i className={`bi ${ico} text-primary`} style={{ fontSize: 56 }} />
            <h4 className="fw-bold mt-3">{title}</h4>
            <p className="text-muted">โมดูลนี้อยู่ระหว่างพัฒนา (ตามแผน REVAMP_V2)</p>
            {items.length > 0 && (
              <ul className="list-group list-group-flush d-inline-block text-start mt-2">
                {items.map((it) => (
                  <li className="list-group-item py-1 border-0" key={it}>
                    <i className="bi bi-check2-circle text-secondary me-2" />{it}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
