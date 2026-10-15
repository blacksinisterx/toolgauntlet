import { chromium } from '@playwright/test';
const b = await chromium.launch();
const out = '../media/out/';
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  for (const r of ['findings', 'arena', 'heists', 'traces', 'method']) {
    await p.goto('http://127.0.0.1:5180/#/' + r); await p.waitForTimeout(900);
    if (r === 'arena') { await p.getByRole('button', { name: /skip to the end/i }).click().catch(() => {}); await p.waitForTimeout(300); }
    await p.screenshot({ path: `${out}tg-${r}-${theme}.png`, fullPage: r === 'findings' });
  }
  console.log(theme, 'errors:', errs);
  await ctx.close();
}
await b.close();
