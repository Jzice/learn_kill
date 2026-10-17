// file:// 直开测试：验证双击打开 dist 产物能否正常初始化和开局
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const fileUrl = 'file:///' + path.resolve(dirname, '..', 'dist', file).replace(/\\/g, '/');

function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text());
});
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(fileUrl, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const lobbyRendered = await page.evaluate(
  () => !!document.querySelector('#screenLobby.active #profileCard .profile-card'),
);
console.log('file:// URL:', fileUrl);
console.log('大厅渲染:', lobbyRendered ? '✅' : '❌');
console.log('JS 错误:', errs.length ? '\n' + errs.join('\n') : '(无)');

if (lobbyRendered) {
  await page.click('#startBtn');
  await page.waitForTimeout(3000);
  const seats = await page.locator('#seatRing .p-card').count();
  const hand = await page.locator('#handRow .card').count();
  console.log('开局后座位:', seats, '手牌:', hand, seats === 4 ? '✅' : '❌');
  const errs2 = errs.length;
  console.log('JS 错误(开局后):', errs2 ? '\n' + errs.join('\n') : '(无)');
}
await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'repro-file.png') });
await browser.close();
