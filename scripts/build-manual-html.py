# -*- coding: utf-8 -*-
# รวมคู่มือ 5 ไฟล์ (README + 4 บท) เป็น HTML เล่มเดียวสำหรับพิมพ์ PDF (A4)
# ใช้คู่กับ scripts/build-manual-pdf.mjs (Playwright → PDF)
import io, os, re, markdown

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "manual")
FILES = ["README.md", "01-ภาพรวมระบบ.md", "02-ขั้นตอนOPD.md", "03-บทบาทและสิทธิ์.md", "04-การเงิน.md"]

md = markdown.Markdown(extensions=["tables", "fenced_code", "sane_lists"])

sections = []
for i, f in enumerate(FILES):
    src = io.open(os.path.join(BASE, f), encoding="utf-8").read()
    # ลิงก์ข้ามไฟล์ .md ใช้ไม่ได้ใน PDF → เหลือแค่ข้อความ
    src = re.sub(r"\[([^\]]+)\]\([^)]+\.md\)", r"**\1**", src)
    html = md.convert(src)
    md.reset()
    cls = "cover-section" if i == 0 else "chapter"
    sections.append(f'<section class="{cls}">{html}</section>')

body = "\n".join(sections)
base_href = "file:///" + BASE.replace("\\", "/") + "/"

page = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<base href="{base_href}">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
  * {{ box-sizing: border-box; }}
  body {{
    font-family: 'Sarabun', 'Leelawadee UI', sans-serif;
    font-size: 13.5px; line-height: 1.85; color: #1f2937; margin: 0;
  }}
  /* ── ปกหน้าแรก ── */
  .pdf-cover {{
    height: 96vh; display: flex; flex-direction: column; justify-content: center; align-items: center;
    text-align: center; background: linear-gradient(135deg, #0f4a7d 0%, #1560a3 55%, #2a7bc4 100%);
    color: #fff; border-radius: 14px; page-break-after: always;
  }}
  .pdf-cover img {{ width: 110px; height: 110px; border-radius: 22px; box-shadow: 0 10px 40px rgba(0,0,0,.35); margin-bottom: 28px; }}
  .pdf-cover .t1 {{ font-size: 34px; font-weight: 800; letter-spacing: .5px; }}
  .pdf-cover .t2 {{ font-size: 17px; opacity: .92; margin-top: 6px; }}
  .pdf-cover .t3 {{ font-size: 13px; opacity: .8; margin-top: 30px; border-top: 1px solid rgba(255,255,255,.35); padding-top: 14px; }}
  /* ── โครงเอกสาร ── */
  .chapter {{ page-break-before: always; }}
  h1 {{ font-size: 24px; font-weight: 800; color: #0f4a7d; border-bottom: 3px solid #1560a3; padding-bottom: 8px; margin: 0 0 14px; }}
  h2 {{ font-size: 18px; font-weight: 700; color: #1560a3; margin: 26px 0 8px; border-left: 5px solid #1560a3; padding-left: 10px; }}
  h3 {{ font-size: 15px; font-weight: 700; color: #111827; margin: 18px 0 6px; }}
  h2, h3 {{ page-break-after: avoid; }}
  p {{ margin: 6px 0; }}
  strong {{ color: #0f4a7d; }}
  hr {{ border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }}
  /* รูปหน้าจอ */
  img {{ max-width: 100%; border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 2px 8px rgba(15,23,42,.08); margin: 6px 0; page-break-inside: avoid; }}
  /* ตาราง */
  table {{ border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 12.5px; page-break-inside: avoid; }}
  th {{ background: #eaf2fa; color: #0f4a7d; font-weight: 700; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left; vertical-align: top; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  /* กล่องเตือน/เคล็ดลับ (blockquote) */
  blockquote {{
    margin: 10px 0; padding: 9px 14px; border-radius: 8px;
    background: #fff8e6; border-left: 5px solid #f0a500; page-break-inside: avoid;
  }}
  blockquote p {{ margin: 2px 0; }}
  ol, ul {{ margin: 6px 0; padding-left: 26px; }}
  li {{ margin: 3px 0; }}
  code {{ background: #eef2f7; border-radius: 4px; padding: 1px 6px; font-size: 12px; font-family: Consolas, monospace; color: #0f4a7d; }}
</style>
</head>
<body>
<div class="pdf-cover">
  <img src="file:///{os.path.dirname(os.path.dirname(BASE)).replace(chr(92), '/')}/public/brand/logo.jpg" alt="Osoth">
  <div class="t1">คู่มือการใช้งานระบบ OSOTH</div>
  <div class="t2">Healthcare Operator System · ระบบบริหารงานคลินิกครบวงจร</div>
  <div class="t2">https://osoth.com</div>
  <div class="t3">ฉบับ 1.0 · สิงหาคม 2569 · สำหรับพนักงานคลินิกทุกตำแหน่ง</div>
</div>
{body}
</body>
</html>"""

out = os.path.join(BASE, "manual-print.html")
io.open(out, "w", encoding="utf-8", newline="\n").write(page)
print("HTML:", out, "|", len(page), "chars")
