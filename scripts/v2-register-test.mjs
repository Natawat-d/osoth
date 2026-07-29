// ทดสอบ first-run UX: root → เด้ง /register → สมัคร owner (ไทย) → dashboard
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const OUT = "D:/arkara_project/clinic_project/osot/test-artifacts/v2";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} - ${name} ${note}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1) เปิด root — ยังไม่มี owner → ต้องเด้งไป /register
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForURL("**/register", { timeout: 15000 }).catch(() => {});
ok("root redirects to /register (first-run)", page.url().includes("/register"), page.url());
await page.screenshot({ path: `${OUT}/10-register.png`, fullPage: true });

// 2) กรอกสมัคร owner ภาษาไทย
await page.fill('input >> nth=0', "โอสถ คลินิกความงาม จำกัด");        // ชื่อบริษัท
await page.fill('input >> nth=1', "88/8 ถนนสุขุมวิท แขวงคลองเตย กรุงเทพฯ"); // ที่อยู่
await page.fill('input >> nth=2', "0105567890123");                    // เลขภาษี
await page.fill('input >> nth=3', "02-999-8888");                      // เบอร์บริษัท
await page.fill('input >> nth=4', "อรรถกร วิริยะกุล");                 // ชื่อ-นามสกุล owner
await page.fill('input >> nth=5', "กร");                               // ชื่อเล่น
await page.fill('input >> nth=6', "owner");                            // username
await page.fill('input >> nth=7', "081-234-5678");                     // เบอร์
await page.fill('input[type="password"] >> nth=0', "1234");
await page.fill('input[type="password"] >> nth=1', "1234");
await page.screenshot({ path: `${OUT}/11-register-filled.png`, fullPage: true });
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 20000 });
await page.waitForLoadState("networkidle");
ok("owner registered → /app", page.url().endsWith("/app"));
await page.screenshot({ path: `${OUT}/12-dashboard-thai.png`, fullPage: true });
ok("dashboard shows thai company", (await page.locator("text=โอสถ คลินิกความงาม").count()) > 0);

// 3) เข้า /about_me อีกครั้ง — ไม่เด้ง register แล้ว + ชื่อบริษัทไทยขึ้น
await page.goto(`${BASE}/about_me`, { waitUntil: "networkidle" });
ok("about_me stays (owner exists)", page.url().includes("about_me"), page.url());
ok("about_me shows thai company", (await page.locator("text=โอสถ คลินิกความงาม").count()) > 0);
await page.screenshot({ path: `${OUT}/13-about_me-thai.png`, fullPage: true });

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
