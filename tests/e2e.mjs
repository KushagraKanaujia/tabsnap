// End-to-end test: loads the unpacked extension into Chrome for Testing and
// closes real tabs. Run: npm install && npx puppeteer browsers install chrome && npm run test:e2e
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert';

const ext = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await puppeteer.launch({
  headless: true, pipe: true, enableExtensions: [ext],
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
});
const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().endsWith('background.js'));
const page = await browser.newPage();
await page.goto(`chrome-extension://${new URL(sw.url()).host}/popup.html`);

// Runs inside the extension page: build a window of 6 tabs, visit some, close one.
async function scenario(strategy, visits, closeIdx) {
  return page.evaluate(async (strategy, visits, closeIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    await chrome.storage.sync.set({ strategy });
    const w = await chrome.windows.create({ url: 'about:blank' });
    const ids = [w.tabs[0].id];
    for (let i = 1; i < 6; i++) ids.push((await chrome.tabs.create({ windowId: w.id, url: 'about:blank', active: false })).id);
    await sleep(200);
    for (const k of visits) { await chrome.tabs.update(ids[k], { active: true }); await sleep(150); }
    await chrome.tabs.remove(ids[closeIdx]);
    await sleep(500);
    const [a] = await chrome.tabs.query({ windowId: w.id, active: true });
    await chrome.windows.remove(w.id);
    return ids.indexOf(a.id);
  }, strategy, visits, closeIdx);
}

const cases = [
  // [name, strategy, visit order, tab to close, expected focused tab (original position)]
  ['lru returns to previous tab', 'lru', [1, 4, 2], 2, 4],
  ['proximity tie -> recently used left neighbour', 'proximity', [3, 0, 1, 2], 2, 1],
  ['proximity tie -> recently used right neighbour', 'proximity', [1, 0, 3, 2], 2, 3],
  ['hybrid tie -> recently used left neighbour', 'hybrid', [3, 1, 5, 2], 2, 1],
  ['background close never steals focus', 'hybrid', [0, 4], 1, 4],
  ['background close never steals focus (proximity)', 'proximity', [0, 4], 3, 4],
];

let failed = 0;
for (const [name, strategy, visits, close, expected] of cases) {
  const got = await scenario(strategy, visits, close);
  try { assert.equal(got, expected); console.log(`ok   ${name}`); }
  catch { failed++; console.log(`FAIL ${name}: expected tab ${expected}, got ${got}`); }
}
await browser.close();
process.exit(failed ? 1 : 0);
