"use client";
// ชุดกราฟ SVG ล้วนสำหรับ V2 (AdminLTE) — ไม่พึ่ง lib, ไม่พึ่ง CSS legacy (สไตล์ inline/Bootstrap)
// โทนสีน้ำเงินแบรนด์ Osoth + สี semantic ของ Bootstrap

export const V2_PALETTE = [
  "#1560a3", "#198754", "#dc3545", "#fd7e14", "#6f42c1", "#20c997", "#6c757d", "#0dcaf0",
];

const AXIS = "#adb5bd";
const GRID = "#e9ecef";

function niceMax(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
export function shortNum(v) {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(v));
}

function Empty({ label = "ไม่มีข้อมูลในช่วงนี้" }) {
  return <div className="text-center text-muted py-4 small"><i className="bi bi-graph-up me-1" />{label}</div>;
}

export function Legend({ items }) {
  return (
    <div className="d-flex flex-wrap gap-3 small mt-1">
      {items.map((s, i) => (
        <span key={i} className="d-inline-flex align-items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
          <span className="text-muted">{s.label}</span>
          {s.value !== undefined && <b>{s.value}</b>}
        </span>
      ))}
    </div>
  );
}

// ── กราฟเส้นหลาย series ── data:[{date,...}] series:[{key,label,color}]
export function LineChart({ data = [], series = [], height = 230 }) {
  if (!data.length) return <Empty />;
  const W = 640, H = height, padL = 46, padR = 12, padT = 12, padB = 30;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const nice = niceMax(max);
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => padT + innerH - (v / nice) * innerH;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380 }} role="img">
        {Array.from({ length: 5 }, (_, t) => {
          const v = (nice / 4) * t, yy = y(v);
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={yy + 4} textAnchor="end" fontSize="10" fill={AXIS}>{shortNum(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={AXIS}>
              {String(d.date).slice(5)}
            </text>
          ) : null
        )}
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
              points={data.map((d, i) => `${x(i)},${y(d[s.key] || 0)}`).join(" ")} />
            {data.length <= 45 && data.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d[s.key] || 0)} r="2.4" fill={s.color} />
            ))}
          </g>
        ))}
      </svg>
      <Legend items={series} />
    </div>
  );
}

// ── bar ซ้อน (stacked) รายวัน ── data:[{date,...}] series:[{key,label,color}]
export function StackedBarChart({ data = [], series = [], height = 230 }) {
  if (!data.length) return <Empty />;
  const W = 640, H = height, padL = 46, padR = 12, padT = 12, padB = 30;
  const totals = data.map((d) => series.reduce((s, x) => s + (d[x.key] || 0), 0));
  const nice = niceMax(Math.max(1, ...totals));
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const bw = Math.min(34, (innerW / data.length) * 0.66);
  const x = (i) => padL + ((i + 0.5) / data.length) * innerW;
  const hOf = (v) => (v / nice) * innerH;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380 }} role="img">
        {Array.from({ length: 5 }, (_, t) => {
          const v = (nice / 4) * t, yy = padT + innerH - (v / nice) * innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={yy + 4} textAnchor="end" fontSize="10" fill={AXIS}>{shortNum(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {series.map((s) => {
                const v = d[s.key] || 0;
                const h = hOf(v);
                const yy = padT + innerH - hOf(acc) - h;
                acc += v;
                return v > 0 ? <rect key={s.key} x={x(i) - bw / 2} y={yy} width={bw} height={h} fill={s.color} rx="1.5" /> : null;
              })}
              {i % labelEvery === 0 && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={AXIS}>{String(d.date).slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend items={series} />
    </div>
  );
}

// ── bar แนวนอน ── data:[{label, value, color?, hint?}]
export function HBarChart({ data = [], height = null, unit = "" }) {
  const items = data.filter((d) => d.value > 0);
  if (!items.length) return <Empty />;
  const max = Math.max(...items.map((d) => d.value));
  return (
    <div className="d-flex flex-column gap-2">
      {items.map((d, i) => (
        <div key={i}>
          <div className="d-flex small mb-1">
            <span className="text-truncate">{d.label}</span>
            {d.hint && <span className="text-muted ms-1">· {d.hint}</span>}
            <b className="ms-auto">{shortNum(d.value)}{unit}</b>
          </div>
          <div className="progress" style={{ height: 8 }}>
            <div className="progress-bar" style={{ width: `${(d.value / max) * 100}%`, background: d.color || V2_PALETTE[i % V2_PALETTE.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── donut ── data:[{label, value, color?}]
export function DonutChart({ data = [], size = 170, unit = "" }) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty label="ไม่มีข้อมูล" />;
  const R = size / 2, r = R * 0.62, cx = R, cy = R;
  let acc = 0;
  const segs = items.map((d, i) => {
    const frac = d.value / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    return { ...d, frac, path: arc(cx, cy, R, r, a0, a1), color: d.color || V2_PALETTE[i % V2_PALETTE.length] };
  });
  return (
    <div className="d-flex gap-3 align-items-center flex-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        {segs.map((s, i) => (
          s.frac >= 0.999
            ? <g key={i}><circle cx={cx} cy={cy} r={R} fill={s.color} /><circle cx={cx} cy={cy} r={r} fill="#fff" /></g>
            : <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5" />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="#fff" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#212529">{shortNum(total)}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill={AXIS}>รวม</text>
      </svg>
      <div className="d-flex flex-column gap-1 small" style={{ minWidth: 150 }}>
        {segs.map((s, i) => (
          <span key={i} className="d-inline-flex align-items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span className="text-truncate" style={{ flex: 1 }}>{s.label}</span>
            <b>{Math.round(s.frac * 100)}%</b>
            <span className="text-muted">{shortNum(s.value)}{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function arc(cx, cy, R, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
  const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
  const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
  const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`;
}
