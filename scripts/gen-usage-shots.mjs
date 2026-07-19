// จับภาพหน้าจอจริงครบทุก flow สำหรับ PowerPoint (ต้อง seed:demo + dev server รันอยู่)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve("test-artifacts/usage");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1460, height: 940 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  ⚠", e.message));

const done = [];
async function shot(name, { full = false, sel = null } = {}) {
  await page.waitForTimeout(650);
  const file = path.join(OUT, name + ".png");
  try {
    if (sel) {
      const el = await page.$(sel);
      if (el) { await el.screenshot({ path: file }); }
      else { await page.screenshot({ path: file, fullPage: full }); }
    } else {
      await page.screenshot({ path: file, fullPage: full });
    }
    done.push(name);
    console.log("  📸", name);
  } catch (e) { console.log("  ✗", name, e.message); }
}
async function login(username, password = "1234") {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ([u, p]) => {
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    localStorage.setItem("osoth_lang", "th"); localStorage.removeItem("osoth_branch");
  }, [username, password]);
}
async function logout() {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => { try { await fetch("/api/auth/logout", { method: "POST" }); } catch {} localStorage.clear(); });
  await ctx.clearCookies();
}
async function go(url) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForSelector(".content .card, .content table, .content .cal-wrap, .content .opd-split, .store-branch-grid, .login-card, .landing-card, .no-access", { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(1100);
}
const click = async (t) => { try { await page.click(t, { timeout: 3500 }); await page.waitForTimeout(700); return true; } catch { return false; } };

// ============ 1) ACCESS ============
console.log("[1] Access");
await logout();
await page.goto(BASE, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
await shot("01-landing");
await click("text=พนักงาน");
await shot("02-staff-login");
// storefront
await page.goto(BASE + "/store", { waitUntil: "networkidle" }); await page.waitForTimeout(900);
await shot("03-store-branches");
await click(".store-branch-card");
await page.waitForTimeout(1200);
await shot("04-store-calendar", { full: true });

// forced first password change (เคสจริง: เจ้าของเพิ่งตั้ง login ให้พนักงานใหม่)
await login("owner");
await page.evaluate(async () => { await fetch("/api/users/US-008/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "newstaff", password: "start1" }) }); });
await logout();
await login("newstaff", "start1");
await go("/");
await shot("05-force-change-password");

// ============ 2) OWNER / HR login manager ============
console.log("[2] HR login manager");
await login("owner");
await go("/hr");
await shot("06-hr-login-manager", { sel: ".card:has-text('บัญชีเข้าระบบพนักงาน')" });

// ============ 3) SALES & BOOKING ============
console.log("[3] Sales & Booking");
await login("sale");
await go("/calendar");
await shot("07-sale-calendar", { full: true });
// เปิดฟอร์มขายคอร์ส
if (await click("text=ขายคอร์ส")) await shot("08-sale-form");
// ฟอร์มจองคิว (คลิกช่องเวลาว่างในปฏิทิน)
await go("/calendar");
try {
  const cell = await page.$(".cal-slot, .cal-cell.slot, .cal-grid .cal-cell:not(.cal-head):not(.time-head)");
  if (cell) { await cell.click(); await page.waitForTimeout(700); }
} catch {}
await shot("09-booking-form", { full: true });

// ============ 4) RECEPTION → HN → OPEN CASE ============
console.log("[4] Reception");
await login("reception");
await go("/reception");
await shot("10-reception", { full: true });

// ============ 5) OPD ============
console.log("[5] OPD");
await go("/opd");
await shot("11-opd-list", { full: true });
// เลือกเคสแรกในคิวเพื่อโชว์แผงจัดการเคส
try {
  const row = await page.$(".opd-tbl tbody tr, .opd-queue .opd-row, table tbody tr");
  if (row) { await row.click(); await page.waitForTimeout(900); }
} catch {}
await shot("12-opd-case", { full: true });

// ============ 6) STOCK & PURCHASING ============
console.log("[6] Stock & Purchasing");
await login("admin");
await go("/stock");
await shot("13-stock", { full: true });
await go("/purchasing");
await shot("14-purchasing", { full: true });

// ============ 7) CUSTOMERS ============
console.log("[7] Customers");
await go("/customers");
await shot("15-customers", { full: true });
// ค้นหา + เปิดโปรไฟล์
try {
  const q = await page.$("input[placeholder*='ค้นหา'], .content input[type='text']");
  if (q) { await q.fill("0"); await page.waitForTimeout(400); await page.keyboard.press("Enter"); await page.waitForTimeout(800); }
  const prof = await page.$(".content table tbody tr, .cust-row, .customer-card");
  if (prof) { await prof.click(); await page.waitForTimeout(900); }
} catch {}
await shot("16-customer-profile", { full: true });

// ============ 8) FINANCE ============
console.log("[8] Finance");
await go("/finance");
await shot("17-finance", { full: true });

// ============ 9) COMMISSION ============
await go("/commission");
await shot("18-commission", { full: true });

// ============ 10) ATTENDANCE ============
console.log("[9] People");
await go("/attendance");
await shot("19-attendance", { full: true });

// ============ 11) LEAVES ============
await login("bt1");
await go("/leaves");
await shot("20-leaves-mine", { full: true });
await login("admin");
await go("/leaves");
await shot("21-leaves-approve", { full: true });

// ============ 12) HR throughput + schedule ============
await go("/hr");
await shot("22-hr-throughput", { full: true });

// ============ 13) MY EARNINGS + RBAC ============
console.log("[10] Earnings & RBAC");
await login("dr.mangkorn");
await go("/my-earnings");
await shot("23-my-earnings", { full: true });
await go("/finance");
await shot("24-rbac-no-access");

// ============ 14) MULTI-BRANCH (owner switch) ============
console.log("[11] Multi-branch & Settings");
await login("owner");
await go("/finance");
try { await page.click(".topbar select", { timeout: 2500 }); await page.waitForTimeout(400); } catch {}
await shot("25-branch-switch");

// ============ 15) SETTINGS + CATALOG ============
await go("/settings");
await shot("26-settings", { full: true });
await go("/courses");
await shot("27-courses", { full: true });
await go("/promotions");
await shot("28-promotions", { full: true });
await go("/products");
await shot("29-products", { full: true });
await go("/procedures");
await shot("30-procedures", { full: true });

await browser.close();
fs.writeFileSync(path.join(OUT, "_index.json"), JSON.stringify(done, null, 1));
console.log(`\nเสร็จ · ${done.length} ภาพ → test-artifacts/usage/`);
