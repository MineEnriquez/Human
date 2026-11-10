// End-to-end smoke test in a real browser (no AI calls).
// Starts the Vite dev server, then for every live path: opens the path page, every lesson's case file,
// lecture and lab, and fails on any page error, console error, or missing lab.
// Run: npm run test:e2e   (uses Google Chrome, or set CHROME_PATH)
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { PATHS } from "../src/content/paths";

const CHROME = process.env.CHROME_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) { console.log("SKIP e2e: no Chrome found (set CHROME_PATH)"); process.exit(0); }

process.env.ANTHROPIC_API_KEY = ""; // keep the run free: AI features show "AI is off"
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const BASE = "http://localhost:5199";
const browser = await chromium.launch({ executablePath: CHROME });
const failures: string[] = [];
let checks = 0;
const ok = (cond: unknown, msg: string) => { checks++; if (!cond) failures.push(msg); };

try {
  const live = PATHS.filter(p => p.status === "live");
  // Seed progress so every lesson is unlocked.
  const done = { stages: { brief: true, lecture: true, lab: true, seminar: true, quiz: true }, evidence: [] };
  const seeded = JSON.stringify({ xp: 0, badges: [], lessons: Object.fromEntries(live.flatMap(p => p.lessons.map(l => [l.id, done]))), misconceptions: [], awarded: [], streak: { last: "", count: 0 } });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(`pageerror at ${page.url()}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/status of 503/.test(m.text())) errors.push("console: " + m.text()); });

  await page.goto(BASE + "/");
  ok(await page.getByRole("heading", { name: /Choose a path/ }).isVisible(), "home: path list");
  for (const p of PATHS) ok(await page.getByText(p.title, { exact: true }).first().isVisible(), `home: ${p.title} card`);

  for (const p of live) {
    await page.goto(`${BASE}/paths/${p.id}`);
    for (const l of p.lessons) ok(await page.getByText(l.title, { exact: true }).first().isVisible(), `${p.id}: lists ${l.id}`);
  }

  await ctx.addInitScript(s => localStorage.setItem("neva:v1", s), seeded);
  for (const p of live) for (const l of p.lessons) try {
    await page.goto(`${BASE}/lesson/${l.id}`);
    const steps = page.locator(".stepper .step");
    await steps.nth(0).click();
    ok(await page.getByText(l.brief.question.replace(/\*\*|\[\[\w\||\]\]/g, "").slice(0, 30)).first().isVisible(), `${l.id}: case question`);
    await steps.nth(1).click();
    ok(await page.locator(".segment").count() === l.lecture.length, `${l.id}: ${l.lecture.length} lecture segments`);
    await steps.nth(2).click();
    await page.waitForSelector(".lab", { timeout: 10000 }).catch(() => null);
    ok(await page.locator(".lab").count() >= 1, `${l.id}: lab renders`);
    ok(!(await page.getByText(/is missing/).count()), `${l.id}: lab registered`);
    if (!l.boss) {
      await steps.filter({ hasText: "Quiz" }).click();
      ok(await page.locator(".check").count() === l.quiz.length, `${l.id}: ${l.quiz.length} quiz questions`);
    }
  } catch (e) {
    failures.push(`${l.id}: ${(e as Error).message.split("\n")[0]}`);
  }

  // Drag and drop really moves a card (first sortable sequence found in the first lesson with one).
  for (const p of live) {
    const l = p.lessons.find(x => x.lab.includes("rag") || x.lab.includes("mcp"));
    if (!l) continue;
    try {
    await page.goto(`${BASE}/lesson/${l.id}`);
    await page.locator(".stepper .step").nth(2).click();
    const rows = page.locator(".sortlist .drag");
    await rows.first().waitFor();
    const label = (t: string) => t.replace(/^\s*\d+\s*/, "").trim();
    const before = label((await rows.allInnerTexts())[2]);
    const a = (await rows.nth(2).boundingBox())!, t = (await rows.nth(0).boundingBox())!;
    await page.mouse.move(a.x + 40, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + 10, { steps: 5 }); await page.mouse.move(t.x + 40, t.y + 4, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(250);
    ok(label((await rows.allInnerTexts())[0]) === before, `${l.id}: drag-and-drop reorders`);
    } catch (e) { failures.push(`${l.id} dnd: ${(e as Error).message.split("\n")[0]}`); }
  }

  // Theme toggle cycles System -> Light -> Dark.
  await page.goto(BASE + "/");
  const btn = page.locator(".theme-btn");
  await btn.click(); ok(await page.evaluate(() => document.documentElement.dataset.theme) === "light", "theme: light");
  await btn.click(); ok(await page.evaluate(() => document.documentElement.dataset.theme) === "dark", "theme: dark");

  for (const e of errors) failures.push(e);
} finally {
  await browser.close();
  await server.close();
}
console.log(`${checks} checks, ${failures.length} failures`);
if (failures.length) { console.log(failures.map(f => " ✗ " + f).join("\n")); process.exit(1); }
console.log("e2e smoke: all good");
