// เจนรูป AI (Pollinations.ai — ฟรี ไม่ต้องมี key) → public/courses/*.jpg
// รัน: node scripts/gen-photos.mjs   (แก้ prompt/seed ได้ในตาราง SPECS)
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "courses");
mkdirSync(OUT, { recursive: true });

const STYLE = "rose wine and gold color palette, elegant luxury Thai beauty clinic, chinese modern minimal, soft cinematic studio light, high detail, no text, no watermark";
const SPECS = [
  { name: "botox", seed: 11, p: "serene asian woman glowing dewy skin slim jawline, gold shimmer highlight, soft rose backdrop" },
  { name: "skincare", seed: 22, p: "radiant glowing skin closeup with water serum droplets, rose petals, luminous" },
  { name: "filler", seed: 33, p: "luxury plump lips and cheeks beauty portrait, golden serum droplet, rose velvet" },
  { name: "thread", seed: 45, p: "elegant woman face profile with delicate golden light contour lines, jade and rose tones" },
  { name: "gold", seed: 55, p: "24k gold leaf facial treatment, shimmering gold flakes on glowing skin, opulent spa" },
  { name: "combo", seed: 66, p: "luxury spa skincare products flatlay, gold and rose, soft sparkle bokeh" },
  { name: "promo", seed: 78, p: "festive beauty gift set with red roses and gold ribbon, celebratory warm glow" },
];

for (const s of SPECS) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${s.p}, ${STYLE}`)}?width=880&height=400&nologo=true&seed=${s.seed}`;
  process.stdout.write(`… ${s.name} `);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(join(OUT, `${s.name}.jpg`), buf);
    console.log(`✓ ${(buf.length / 1024) | 0}KB`);
  } catch (e) {
    console.log("✗ " + e.message);
  }
}
console.log("\nเสร็จ — ตั้ง course.image = \"/courses/<ชื่อ>.jpg\" (seed.mjs ทำให้แล้ว)");
