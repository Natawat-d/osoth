"use client";
// กราฟ SVG ล้วน ไม่พึ่ง external lib — โทนสีตามธีมโอสถ
export const CHART_PALETTE = [
  "#a8455c", "#2f7d5b", "#a5842f", "#34618f", "#a9761a", "#7a4f96", "#64615a",
];

// ---------- กราฟเส้น ----------
// data: [{date, ...}], series: [{key, label, color}]
export function LineChart({ data = [], series = [], height = 240 }) {
  const W = 640, H = height, padL = 52, padR = 16, padT = 16, padB = 34;
  if (!data.length)
    return <div className="empty-state"><span className="es-ico">📈</span>ไม่มีข้อมูลในช่วงนี้</div>;

  const max = Math.max(
    1,
    ...data.flatMap((d) => series.map((s) => d[s.key] || 0))
  );
  const nice = niceMax(max);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => padT + innerH - (v / nice) * innerH;
  const ticks = 4;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420 }} role="img">
        {/* gridlines + y labels */}
        {Array.from({ length: ticks + 1 }, (_, t) => {
          const v = (nice / ticks) * t;
          const yy = y(v);
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#eae7df" strokeWidth="1" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#928c82">
                {shortNum(v)}
              </text>
            </g>
          );
        })}
        {/* x labels */}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="#928c82">
              {String(d.date).slice(5)}
            </text>
          ) : null
        )}
        {/* lines */}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
              points={data.map((d, i) => `${x(i)},${y(d[s.key] || 0)}`).join(" ")}
            />
            {data.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d[s.key] || 0)} r="2.6" fill={s.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="cl-item">
            <span className="cl-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- กราฟวง (donut) ----------
// data: [{label, value, color?}]
export function DonutChart({ data = [], size = 200, unit = "" }) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total)
    return <div className="empty-state"><span className="es-ico">🥧</span>ไม่มีข้อมูล</div>;

  const R = size / 2, r = R * 0.62, cx = R, cy = R;
  let acc = 0;
  const segs = items.map((d, i) => {
    const frac = d.value / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const color = d.color || CHART_PALETTE[i % CHART_PALETTE.length];
    return { ...d, frac, path: arc(cx, cy, R, r, a0, a1), color };
  });

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        {segs.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5" />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="#fff" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#201d1a">
          {shortNum(total)}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#928c82">รวม</text>
      </svg>
      <div className="chart-legend col">
        {segs.map((s, i) => (
          <span key={i} className="cl-item">
            <span className="cl-swatch" style={{ background: s.color }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <b>{Math.round(s.frac * 100)}%</b>
            <span className="muted">{shortNum(s.value)}{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- helpers ----------
function arc(cx, cy, R, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
  const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
  const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
  const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`;
}
function niceMax(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
function shortNum(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(v));
}
