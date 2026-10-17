// 验证题库按年级懒加载：dev 模式下初始不加载任何年级题库，开局时只载入选定年级
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5177;

const server = spawn(process.execPath, [path.join(dirname, 'dev.mjs'), 'cdn', String(PORT)], {
  cwd: path.resolve(dirname, '..'),
  env: { ...process.env, VITE_PEERJS_MODE: 'cdn' },
  stdio: 'ignore',
});

async function waitServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: 'localhost', port: PORT, path: '/', method: 'HEAD', timeout: 1500 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

if (!(await waitServer())) {
  console.error('❌ dev 服务器未启动');
  server.kill();
  process.exit(1);
}
console.log('dev server ready');

const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const bankReqs = [];
page.on('request', (r) => {
  const u = r.url();
  if (/banks[/\\]g\d+\.ts/.test(u) || /g\d+\.js/.test(u)) bankReqs.push(u.split('/').pop());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const lobbyLoaded = await page.evaluate(() => !!document.querySelector('#screenLobby.active'));
const gradesRendered = await page.locator('#gradePicker .opt-btn').count();
console.log('大厅渲染:', lobbyLoaded ? '✅' : '❌', '年级按钮:', gradesReasons(gradesRendered));
function gradesReasons(n) {
  return n === 12 ? `✅ ${n} 个` : `❌ ${n} 个`;
}
console.log('初始已加载题库模块:', bankReqs.length === 0 ? '✅ 0 个（未加载任何年级）' : `❌ ${bankReqs.join(', ')}`);

// 开局（默认年级 初二上 → g03）：先选模式进入设置子界面，再开始
await page.click('#modePicker .opt-btn[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });
await page.click('#startBtn');
await page.waitForTimeout(3000);
const started = await page.isVisible('#screenGame.active');
console.log('开局成功:', started ? '✅' : '❌');
console.log('开局后加载题库模块:', bankReqs.length ? bankReqs.join(', ') : '(无)');
const ok = started && bankReqs.length > 0;
console.log(ok ? '✅ 懒加载生效：仅在开局时按年级加载' : '❌ 懒加载未生效');

await browser.close();
server.kill();
process.exit(ok ? 0 : 1);
