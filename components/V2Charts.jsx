"use client";
// ชุดกราฟ SVG ล้วนสำหรับ V2 (AdminLTE) — ไม่พึ่ง lib, ไม่พึ่ง CSS legacy (สไตล์ inline/Bootstrap)
// โทนสีน้ำเงินแบรนด์ Osoth + สี semantic ของ Bootstrap · อนิเมชัน CSS ล้วน (วาดเส้น/บาร์โต/โดนัทหมุนเข้า)
import { useId } from "react";

export const V2_PALETTE = [
  "#1560a3", "#198754", "#dc3545", "#fd7e14", "#6f42c1", "#20c997", "#6c757d", "#0dcaf0",
];

// สี axis/grid อิง CSS var ของ Bootstrap — รอด dark mode อัตโนมัติ
const AXIS = "var(--bs-secondary-color)";
const GRID = "var(--bs-border-color)";
const BG = "var(--bs-body-bg)";
const FG = "var(--bs-body-color)";

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
  return (
    <div className="text-center text-muted py-4">
      <span className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
        style={{ width: 52, height: 52, fontSize: 24, background: "var(--bs-secondary-bg)", color: "var(--bs-secondary-color)" }}>
        <i className="bi bi-bar-chart" />
      </span>
      <div className="small">{label}</div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>ลองปรับช่วงวันที่ดูอีกครั้ง</div>
    </div>
  );
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
// เส้นวาดตัวเองตอนโหลด (pathLength trick) + พื้นที่ใต้เส้นเติม gradient จาง
export function LineChart({ data = [], series = [], height = 230 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!data.length) return <Empty />;
  const W = 640, H = height, padL = 46, padR = 12, padT = 12, padB = 30;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  const nice = niceMax(max);
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => padT + innerH - (v / nice) * innerH;
  const baseY = padT + innerH;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 380 }} role="img">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`lg-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="72%" stopColor={s.color} stopOpacity="0.05" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
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
        {series.map((s, si) => {
          const pts = data.map((d, i) => `${x(i)},${y(d[s.key] || 0)}`).join(" ");
          return (
            // key ผูกจำนวนจุด → เปลี่ยนช่วงวันที่แล้ว remount เล่นอนิเมชันวาดใหม่
            <g key={`${s.key}-${data.length}`}>
              {data.length > 1 && (
                <polygon className="v2-area" points={`${x(0)},${baseY} ${pts} ${x(data.length - 1)},${baseY}`}
                  fill={`url(#lg-${uid}-${s.key})`} style={{ animationDelay: `${0.3 + si * 0.12}s` }} />
              )}
              <polyline className="v2-line" fill="none" stroke={s.color} strokeWidth="2.4"
                strokeLinejoin="round" strokeLinecap="round" pathLength="1"
                style={{ animationDelay: `${si * 0.15}s` }} points={pts} />
              {data.length <= 45 && data.map((d, i) => (
                <circle key={i} className="v2-dot" cx={x(i)} cy={y(d[s.key] || 0)} r="2.4" fill={s.color}
                  style={{ animationDelay: `${0.4 + si * 0.12}s` }} />
              ))}
            </g>
          );
        })}
      </svg>
      <Legend items={series} />
      <style jsx>{`
        .v2-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: v2draw 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .v2-area, .v2-dot { opacity: 0; animation: v2fade 0.5s ease forwards; }
        @keyframes v2draw { to { stroke-dashoffset: 0; } }
        @keyframes v2fade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .v2-line { animation: none; stroke-dashoffset: 0; }
          .v2-area, .v2-dot { animation: none; opacity: 1; }
        }
      `}</style>
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
            <g key={`${i}-${data.length}`}>
              {/* กลุ่มแท่งโตขึ้นจากฐาน (scaleY) — ไล่จังหวะทีละแท่ง */}
              <g className="v2-barcol" style={{ animationDelay: `${Math.min(i * 0.018, 0.45)}s` }}>
                {series.map((s) => {
                  const v = d[s.key] || 0;
                  const h = hOf(v);
                  const yy = padT + innerH - hOf(acc) - h;
                  acc += v;
                  return v > 0 ? <rect key={s.key} x={x(i) - bw / 2} y={yy} width={bw} height={h} fill={s.color} rx="2" /> : null;
                })}
              </g>
              {i % labelEvery === 0 && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={AXIS}>{String(d.date).slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend items={series} />
      <style jsx>{`
        .v2-barcol { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0);
          animation: v2grow 0.55s cubic-bezier(0.25, 0.8, 0.35, 1) forwards; }
        @keyframes v2grow { to { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .v2-barcol { animation: none; transform: none; } }
      `}</style>
    </div>
  );
}

// ── bar แนวนอน ── data:[{label, value, color?, hint?}] — แท่ง gradient + โตจากซ้ายตอนโหลด
export function HBarChart({ data = [], height = null, unit = "" }) {
  const items = data.filter((d) => d.value > 0);
  if (!items.length) return <Empty />;
  const max = Math.max(...items.map((d) => d.value));
  return (
    <div className="d-flex flex-column gap-2">
      {items.map((d, i) => {
        const c = d.color || V2_PALETTE[i % V2_PALETTE.length];
        return (
          <div key={i}>
            <div className="d-flex small mb-1">
              <span className="text-truncate">{d.label}</span>
              {d.hint && <span className="text-muted ms-1">· {d.hint}</span>}
              <b className="ms-auto" style={{ fontVariantNumeric: "tabular-nums" }}>{shortNum(d.value)}{unit}</b>
            </div>
            <div className="progress" style={{ height: 9, borderRadius: 99, background: "var(--bs-secondary-bg)" }}>
              <div className="progress-bar v2-hbar" style={{
                width: `${(d.value / max) * 100}%`, borderRadius: 99,
                background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 62%, #fff))`,
                animationDelay: `${i * 70}ms`,
              }} />
            </div>
          </div>
        );
      })}
      <style jsx>{`
        .v2-hbar { transform-origin: left center; transform: scaleX(0);
          animation: v2hgrow 0.7s cubic-bezier(0.22, 0.8, 0.36, 1) forwards; }
        @keyframes v2hgrow { to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .v2-hbar { animation: none; transform: none; } }
      `}</style>
    </div>
  );
}

// ── donut ── data:[{label, value, color?}] — หมุนเข้าตอนโหลด + glow จางตามสีหลัก
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
  const glow = segs[0]?.color || "#1560a3";
  return (
    <div className="d-flex gap-3 align-items-center flex-wrap">
      <svg className="v2-donut" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
        style={{ filter: `drop-shadow(0 6px 14px ${glow}2b)` }}>
        {segs.map((s, i) => (
          s.frac >= 0.999
            ? <g key={i}><circle cx={cx} cy={cy} r={R} fill={s.color} /><circle cx={cx} cy={cy} r={r} fill={BG} /></g>
            : <path key={i} d={s.path} fill={s.color} stroke={BG} strokeWidth="1.5" />
        ))}
        <circle cx={cx} cy={cy} r={r} fill={BG} />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="17" fontWeight="800" fill={FG}
          style={{ fontVariantNumeric: "tabular-nums" }}>{shortNum(total)}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill={AXIS}>รวม</text>
      </svg>
      <div className="d-flex flex-column gap-1 small" style={{ minWidth: 150 }}>
        {segs.map((s, i) => (
          <span key={i} className="d-inline-flex align-items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span className="text-truncate" style={{ flex: 1 }}>{s.label}</span>
            <b style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(s.frac * 100)}%</b>
            <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{shortNum(s.value)}{unit}</span>
          </span>
        ))}
      </div>
      <style jsx>{`
        .v2-donut { animation: v2spin 0.7s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
        @keyframes v2spin {
          from { opacity: 0; transform: rotate(-65deg) scale(0.9); }
          to { opacity: 1; transform: rotate(0deg) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) { .v2-donut { animation: none; } }
      `}</style>
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
