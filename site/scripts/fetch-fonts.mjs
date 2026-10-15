// One-off: download the latin subset of the two typefaces (SIL OFL) so the site serves its own fonts.
// node scripts/fetch-fonts.mjs  -> public/fonts/*.woff2, prints @font-face rules for src/fonts.css
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const url = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Barlow+Condensed:wght@500;700&display=swap';
const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
let rules = '';
for (const [, tag, block] of css.matchAll(/\/\* (\S+) \*\/\s*(@font-face \{[^}]+\})/g)) {
  if (tag !== 'latin') continue;
  const family = block.match(/font-family: '([^']+)'/)[1], weight = block.match(/font-weight: (\d+)/)[1];
  const file = `${family.toLowerCase().replace(/ /g, '-')}-${weight}.woff2`;
  writeFileSync(`public/fonts/${file}`, Buffer.from(await (await fetch(block.match(/url\(([^)]+)\)/)[1])).arrayBuffer()));
  rules += `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('/fonts/${file}') format('woff2'); unicode-range: ${block.match(/unicode-range: ([^;]+);/)[1]}; }\n`;
}
writeFileSync('src/fonts.css', rules); console.log(rules);
