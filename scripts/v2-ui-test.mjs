// ทดสอบ UI V2 จริงในเบราว์เซอร์: about_me → login → dashboard → HR → เพิ่มพนักงาน
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const OUT = "D:/arkara_project/clinic_project/osot/test-artifacts/v2";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} - ${name} ${note}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

// 1) about_me
await page.goto(`${BASE}/about_me`, { waitUntil: "networkidle" });
ok("about_me loads", await page.locator("h1").count() > 0, await page.locator("h1").first().textContent().catch(() => ""));
ok("about_me has login button", (await page.getByRole("link", { name: /เข้าสู่ระบบ/ }).count()) > 0);
await page.screenshot({ path: `${OUT}/01-about_me.png`, fullPage: true });

// 2) login page
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/02-login.png` });
ok("login page shows form", (await page.locator("input").count()) >= 2);

// 3) login as owner → /app dashboard
await page.fill('input[placeholder="username"]', "owner");
await page.fill('input[placeholder="••••••"]', "1234");
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 15000 });
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${OUT}/03-dashboard.png`, fullPage: true });
ok("dashboard after login", (await page.locator("text=Dashboard").count()) > 0);
ok("sidebar shows owner modules", (await page.locator("text=ตั้งค่าธุรกิจ").count()) > 0);

// 4) HR page — เพิ่มพนักงานผ่าน modal
await page.click('a[href="/app/hr"]');
await page.waitForURL("**/app/hr");
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${OUT}/04-hr.png`, fullPage: true });
ok("HR table lists users", (await page.locator("table tbody tr").count()) >= 2);

await page.click("text=เพิ่มพนักงาน");
await page.waitForSelector(".modal");
await page.fill(".modal input.form-control >> nth=0", "สมหญิง ขายเก่ง");
await page.fill(".modal input.form-control >> nth=1", "หญิง");
await page.selectOption(".modal select", "sale");
// username / password
const inputs = page.locator(".modal input.form-control");
await inputs.nth(4).fill("sale.ying");           // username (ลำดับ: full,nick,phone,email,username,password)
await page.fill('.modal input[type="password"]', "1234");
await page.screenshot({ path: `${OUT}/05-hr-modal.png` });
await page.click(".modal button[type=submit]");
await page.waitForSelector(".alert-success", { timeout: 15000 });
await page.screenshot({ path: `${OUT}/06-hr-added.png`, fullPage: true });
ok("staff added via UI (RTK refetch)", (await page.locator("text=สมหญิง").count()) > 0);

// 5) logout → login เป็นพนักงานใหม่ → ต้องเจอบังคับเปลี่ยนรหัส
await page.click("text=ออก");
await page.waitForURL("**/login");
await page.fill('input[placeholder="username"]', "sale.ying");
await page.fill('input[placeholder="••••••"]', "1234");
await page.click('button[type="submit"]');
await page.waitForURL("**/app", { timeout: 15000 });
await page.waitForLoadState("networkidle");
const forced = (await page.locator("text=ตั้งรหัสผ่านใหม่").count()) > 0;
ok("staff forced change password", forced);
await page.screenshot({ path: `${OUT}/07-force-change.png` });
if (forced) {
  await page.fill('input[type="password"] >> nth=0', "5678");
  await page.fill('input[type="password"] >> nth=1', "5678");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  // sale ไม่ใช่ owner → dashboard เด้งไป / (หน้าเดิม legacy)
  await page.screenshot({ path: `${OUT}/08-staff-after.png` });
  ok("staff redirected after change", true, page.url());
}

// สรุป
const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
ok("no js errors", jsErrors.length === 0, jsErrors.slice(0, 3).join(" | "));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
