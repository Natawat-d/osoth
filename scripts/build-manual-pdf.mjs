// แปลง docs/manual/manual-print.html → PDF A4 (รัน python scripts/build-manual-html.py ก่อน)
// ผลลัพธ์: docs/manual/คู่มือการใช้งาน_OSOTH.pdf
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(root, "docs", "manual", "manual-print.html");
const outPath = path.join(root, "docs", "manual", "คู่มือการใช้งาน_OSOTH.pdf");

const b = await chromium.launch();
const page = await b.newPage();
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready); // รอฟอนต์ Sarabun โหลดครบก่อนพิมพ์
await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `
    <div style="width:100%; font-size:9px; color:#94a3b8; padding:0 13mm; display:flex; font-family:'Sarabun',sans-serif;">
      <span>คู่มือการใช้งานระบบ OSOTH · ฉบับ 1.1</span>
      <span style="margin-left:auto;">หน้า <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
});
await b.close();
console.log("PDF:", outPath);
