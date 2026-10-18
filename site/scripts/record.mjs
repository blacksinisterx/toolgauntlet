// Records the three demo scenarios against a running site (default: production). Output: ../media/out/raw/<name>.webm
// Usage: node scripts/record.mjs [arena|heist|defense|all]   BASE_URL=http://localhost:5180 to override
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'https://toolgauntlet.vercel.app';
const RAW = '../media/out/raw/';
mkdirSync(RAW, { recursive: true });
const want = process.argv[2] ?? 'all';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { width: 1000, height: 700 };

// Playwright recordings have no cursor, so draw one
const CURSOR = `(() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:99999;width:14px;height:14px;margin:8px 0 0 10px;border-radius:50%;background:rgba(184,50,31,.9);border:2px solid #1E1B16;pointer-events:none;transition:transform .1s;left:-50px;top:-50px';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
  addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'scale(.6)'; }, true);
  addEventListener('mouseup', () => { d.style.transform = 'scale(1)'; }, true);
})();`;

async function glide(page, loc) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  await pause(250);
}
const tap = async (page, loc) => { await glide(page, loc); await loc.first().click(); };
// scroll so the element sits near the top of the frame, smoothly
const scrollTo = async (page, loc, offset = 70) => {
  await loc.first().evaluate((el, o) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - o, behavior: 'smooth' }), offset);
  await pause(900);
};

const browser = await chromium.launch();
async function session(name, fn) {
  const tmp = RAW + 'tmp-' + name;
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: tmp, size: VIEW }, deviceScaleFactor: 1 });
  await ctx.addInitScript(CURSOR);
  await ctx.addInitScript(() => { try { localStorage.setItem('tg-theme', 'light'); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  await fn(page);
  await ctx.close();
  const f = readdirSync(tmp).filter((x) => x.endsWith('.webm')).pop();
  renameSync(`${tmp}/${f}`, `${RAW}${name}.webm`);
  rmSync(tmp, { recursive: true, force: true });
  console.log('recorded', name);
}

/* 1. Arena: the same scenario through every tool layer, on one clock */
if (want === 'arena' || want === 'all') {
  await session('arena', async (page) => {
    await page.goto(BASE + '/#/arena'); await page.getByRole('button', { name: /^race$/i }).waitFor(); await pause(1800);
    await tap(page, page.getByRole('button', { name: /^race$/i }));
    await page.mouse.move(980, 690, { steps: 12 });
    await scrollTo(page, page.locator('.task'), 60);
    await pause(10500);
  });
}

/* 2. The Heists: open a real hijack, step by step */
if (want === 'heist' || want === 'all') {
  await session('heist', async (page) => {
    await page.goto(BASE + '/#/heists'); await page.getByRole('heading', { name: /the trojan page/i }).waitFor(); await pause(1500);
    const card = page.locator('article.heist', { hasText: 'The Trojan Page' });
    await scrollTo(page, card); await pause(1200);
    await tap(page, card.locator('summary')); await pause(500);
    await scrollTo(page, card.locator('summary'), 40); await pause(3800);
    const card2 = page.locator('article.heist', { hasText: 'The Look-alike' });
    await scrollTo(page, card2); await pause(1000);
    await tap(page, card2.locator('summary')); await pause(500);
    await scrollTo(page, card2.locator('summary'), 40); await pause(3500);
  });
}

/* 3. Defense Shop: what each defense costs and buys, layer by layer */
if (want === 'defense' || want === 'all') {
  await session('defense', async (page) => {
    await page.goto(BASE + '/#/findings'); await page.getByRole('heading', { name: /defense shop/i }).waitFor(); await pause(1000);
    await scrollTo(page, page.getByRole('heading', { name: /defense shop/i }), 20); await pause(1800);
    for (const name of [/the fortress/i, /the embassy/i, /the workshop/i, /the library/i, /all layers/i]) {
      await tap(page, page.locator('.seg button', { hasText: name })); await pause(1900);
    }
  });
}

await browser.close();
