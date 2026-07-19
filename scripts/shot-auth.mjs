// จับภาพหน้าจอฟีเจอร์ auth ใหม่ (landing, staff login, storefront, HR login manager)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const BASE = "http://localhost:3000";
const ART = path.resolve("test-artifacts");
fs.mkdirSync(ART, { recursive: true });

const shots = [];
async function shot(page, name, caption) {
  await page.waitForTimeout(700);
  const file = path.join(ART, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  shots.push(name);
  console.log("  📸 " + name + " — " + caption);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1.3 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  ⚠ pageerror:", e.message));

// 1) Landing (ยังไม่ login)
await ctx.clearCookies();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: "networkidle" });
await shot(page, "auth-01-landing", "หน้าแรก: เลือกลูกค้า / พนักงาน");

// 2) Staff login form
await page.click("text=พนักงาน");
await shot(page, "auth-02-staff-login", "ฟอร์ม login พนักงาน (username + รหัสผ่าน)");

// 3) Storefront — เลือกสาขา
await page.goto(BASE + "/store", { waitUntil: "networkidle" });
await shot(page, "auth-03-storefront-branches", "หน้าลูกค้า: เลือกสาขา (โทร/LINE)");

// 4) Storefront — ปฏิทินสาขา
await page.click(".store-branch-card");
await page.waitForTimeout(1200);
await shot(page, "auth-04-storefront-calendar", "หน้าลูกค้า: ปฏิทินคิว (privacy) + ปุ่มติดต่อ");

// 5) HR login manager (login เป็นเจ้าของ)
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "owner", password: "1234" }) });
  localStorage.setItem("osoth_lang", "th");
  localStorage.removeItem("osoth_branch");
});
await page.goto(BASE + "/hr", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot(page, "auth-05-hr-login-manager", "HR: เจ้าของจัดการบัญชี login พนักงาน");

await browser.close();
console.log(`\nเสร็จ · ${shots.length} ภาพ → test-artifacts/`);
