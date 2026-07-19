// สร้าง banner SVG ธีมโอสถ (จีนโมเดิร์น แดง/ทอง) → public/courses/*.svg
// รัน: node scripts/gen-banners.mjs  (แก้พาเลต/เพิ่มคอร์สได้ในตาราง SPECS ด้านล่าง)
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "courses");
mkdirSync(OUT, { recursive: true });

const W = 880, H = 400;
const GOLD = "#d9be7e", GOLD2 = "#a5842f";

// ---- emblem (ลายกลางเวกเตอร์) ----
const EMBLEM = {
  droplet: (x, y, s) => `
    <g transform="translate(${x} ${y})" opacity="0.95">
      <path d="M0 ${-s} C ${s * 0.62} ${-s * 0.2}, ${s * 0.62} ${s * 0.55}, 0 ${s}
               C ${-s * 0.62} ${s * 0.55}, ${-s * 0.62} ${-s * 0.2}, 0 ${-s} Z"
            fill="url(#gGloss)" stroke="${GOLD}" stroke-width="2"/>
      <ellipse cx="${-s * 0.18}" cy="${-s * 0.05}" rx="${s * 0.16}" ry="${s * 0.28}" fill="#fff" opacity="0.5"/>
      <line x1="0" y1="${s + 10}" x2="0" y2="${s + 56}" stroke="${GOLD}" stroke-width="3"/>
      <circle cx="0" cy="${s + 62}" r="4" fill="${GOLD}"/>
    </g>`,
  glow: (x, y, s) => `
    <g transform="translate(${x} ${y})">
      ${[0, 1, 2].map((i) => `<circle r="${s - i * s * 0.26}" fill="none" stroke="${GOLD}" stroke-width="${2 - i * 0.4}" opacity="${0.85 - i * 0.22}"/>`).join("")}
      <circle r="${s * 0.28}" fill="url(#gGloss)"/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = a * Math.PI / 180, r0 = s * 0.55, r1 = s + 18; return `<line x1="${Math.cos(r) * r0}" y1="${Math.sin(r) * r0}" x2="${Math.cos(r) * r1}" y2="${Math.sin(r) * r1}" stroke="${GOLD}" stroke-width="2" opacity="0.7"/>`; }).join("")}
    </g>`,
  thread: (x, y, s) => `
    <g transform="translate(${x} ${y})" fill="none" stroke-width="3" opacity="0.95">
      <path d="M ${-s} ${-s * 0.4} C ${-s * 0.2} ${-s}, ${s * 0.2} ${s}, ${s} ${s * 0.4}" stroke="${GOLD}"/>
      <path d="M ${-s} ${s * 0.1} C ${-s * 0.3} ${-s * 0.5}, ${s * 0.3} ${s * 0.5}, ${s} ${-s * 0.1}" stroke="#fff" opacity="0.65"/>
      <path d="M ${-s} ${s * 0.55} C ${-s * 0.2} ${s * 0.1}, ${s * 0.2} ${-s * 0.9}, ${s} ${-s * 0.45}" stroke="${GOLD}" opacity="0.7"/>
    </g>`,
  ingot: (x, y, s) => `
    <g transform="translate(${x} ${y})" opacity="0.96">
      <path d="M ${-s} ${s * 0.4} Q 0 ${s}, ${s} ${s * 0.4} L ${s * 0.55} ${-s * 0.35} Q 0 ${-s * 0.05}, ${-s * 0.55} ${-s * 0.35} Z" fill="url(#gGloss)" stroke="${GOLD}" stroke-width="2"/>
      <path d="M ${-s * 0.55} ${-s * 0.35} Q 0 ${-s * 0.8}, ${s * 0.55} ${-s * 0.35} Q 0 ${-s * 0.05}, ${-s * 0.55} ${-s * 0.35} Z" fill="${GOLD}" opacity="0.85"/>
      <ellipse cx="${-s * 0.2}" cy="${s * 0.35}" rx="${s * 0.22}" ry="${s * 0.1}" fill="#fff" opacity="0.4"/>
    </g>`,
  sparkle: (x, y, s) => `
    <g transform="translate(${x} ${y})" fill="url(#gGloss)" stroke="${GOLD}" stroke-width="1.5">
      ${[[0, 0, s], [-s * 0.9, -s * 0.5, s * 0.5], [s * 0.85, s * 0.55, s * 0.42], [s * 0.7, -s * 0.7, s * 0.3]].map(([dx, dy, r]) =>
    `<path transform="translate(${dx} ${dy})" d="M0 ${-r} C ${r * 0.16} ${-r * 0.16}, ${r * 0.16} ${-r * 0.16}, ${r} 0 C ${r * 0.16} ${r * 0.16}, ${r * 0.16} ${r * 0.16}, 0 ${r} C ${-r * 0.16} ${r * 0.16}, ${-r * 0.16} ${r * 0.16}, ${-r} 0 C ${-r * 0.16} ${-r * 0.16}, ${-r * 0.16} ${-r * 0.16}, 0 ${-r} Z"/>`).join("")}
    </g>`,
  seal: (x, y, s) => `
    <g transform="translate(${x} ${y})">
      <rect x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" rx="12" fill="url(#gGloss)" stroke="${GOLD}" stroke-width="3"/>
      <rect x="${-s + 14}" y="${-s + 14}" width="${s * 2 - 28}" height="${s * 2 - 28}" rx="6" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.7"/>
      <text x="0" y="${s * 0.42}" font-family="serif" font-size="${s * 1.5}" font-weight="700" text-anchor="middle" fill="#fff">福</text>
    </g>`,
};

// พาเลต + emblem ต่อคอร์ส
const SPECS = [
  { name: "botox", c1: "#a52830", c2: "#4a1220", accent: "#e0645a", emblem: "droplet" },
  { name: "skincare", c1: "#c06b74", c2: "#5e2733", accent: "#f0b3ab", emblem: "glow" },
  { name: "filler", c1: "#b8791f", c2: "#5a3810", accent: "#e8b45a", emblem: "droplet" },
  { name: "thread", c1: "#2f7d5b", c2: "#153328", accent: "#7fd3ab", emblem: "thread" },
  { name: "gold", c1: "#c2a34a", c2: "#5f4a16", accent: "#f5e2a0", emblem: "ingot" },
  { name: "combo", c1: "#7a3a8a", c2: "#2e1636", accent: "#c99adf", emblem: "sparkle" },
  { name: "promo", c1: "#b23a33", c2: "#6a1512", accent: "#f0c14a", emblem: "seal" },
];

function banner({ name, c1, c2, accent, emblem }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.28" r="0.6">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8e6"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD2}"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.3" fill="#fff" opacity="0.05"/>
    </pattern>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- coin / fret motif (祥云) มุมขวาบน -->
  <g transform="translate(700 96)" opacity="0.5">
    <circle r="120" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <circle r="120" fill="none" stroke="${GOLD}" stroke-width="10" stroke-dasharray="3 9" opacity="0.6"/>
    <circle r="86" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.7"/>
    <rect x="-22" y="-22" width="44" height="44" fill="none" stroke="${GOLD}" stroke-width="2"/>
  </g>
  <!-- คลื่นเมฆด้านล่าง -->
  <g fill="none" stroke="${GOLD}" stroke-width="2" opacity="0.28">
    <path d="M-20 ${H - 40} q 60 -46 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0"/>
    <path d="M-20 ${H - 14} q 60 -46 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" opacity="0.6"/>
  </g>

  <!-- emblem กลางซ้าย -->
  ${EMBLEM[emblem](250, 190, 92)}

  <!-- กรอบทอง + มุม L -->
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="16" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.55"/>
  ${[[26, 26, 1, 1], [W - 26, 26, -1, 1], [26, H - 26, 1, -1], [W - 26, H - 26, -1, -1]].map(([x, y, sx, sy]) =>
    `<path d="M ${x} ${y + 24 * sy} L ${x} ${y} L ${x + 24 * sx} ${y}" fill="none" stroke="${GOLD}" stroke-width="3"/>`).join("")}
  <!-- ตราโอสถมุมล่างซ้าย (จาง) -->
  <text x="40" y="${H - 30}" font-family="serif" font-size="26" font-weight="700" fill="${GOLD}" opacity="0.5">โอสถ 龍</text>
</svg>`;
}

for (const s of SPECS) {
  writeFileSync(join(OUT, `${s.name}.svg`), banner(s).trim());
  console.log("✓ public/courses/" + s.name + ".svg");
}
console.log(`\nสร้าง ${SPECS.length} banner ที่ public/courses/ — ตั้ง course.image = "/courses/<ชื่อ>.svg"`);
