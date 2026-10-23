/* ==================== 高中 50 将 AI 自动对局回归（验收 A8） ====================
 * 连续跑多局无头 AI 对战，检测：卡死 / console error / 身份胜率极端化。
 * 用法：node scripts/repro-senior50.mjs [html文件名] [局数]
 * 退出码：0 通过 / 1 有卡死或控制台错误
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const N = Number(process.argv[3] || 20);
const PORT = 8917;
const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}`;

const server = spawn(process.execPath, [path.join(dirname, 'serve-dist.mjs'), String(PORT)], {
  cwd: path.resolve(dirname, '..'), stdio: 'ignore',
});
async function waitServer(t = 8000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const ok = await new Promise((r) => {
      const q = http.request({ host: '127.0.0.1', port: PORT, path: '/', method: 'HEAD', timeout: 1000 }, (res) => { res.resume(); r(true); });
      q.on('error', () => r(false)); q.on('timeout', () => { q.destroy(); r(false); }); q.end();
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
function findShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
}
if (!(await waitServer())) { console.error('服务器未启动'); server.kill(); process.exit(1); }
const browser = await chromium.launch(findShell() ? { executablePath: findShell() } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
await page.goto(url, { waitUntil: 'networkidle' });

const r = await page.evaluate(async (n) => window.xtsAutoRun(n, 6), N);
const chars = Object.entries(r.byChar).sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games);
console.log(`对局 ${r.games} 局 / 卡死 ${r.stalls} 次`);
console.log('身份胜率：', Object.entries(r.byRole).map(([k, v]) => `${k} ${(v.wins / v.games * 100).toFixed(0)}%`).join(' · '));
console.log('最强 5：', chars.slice(0, 5).map(([k, v]) => `${k}(${v.games}局 ${(v.wins / v.games * 100).toFixed(0)}%)`).join(' '));
console.log('最弱 5：', chars.slice(-5).map(([k, v]) => `${k}(${v.games}局 ${(v.wins / v.games * 100).toFixed(0)}%)`).join(' '));
const extreme = chars.filter(([, v]) => v.wins === v.games || v.wins === 0);
console.log(`极端胜率角色：${extreme.length} 名`);
console.log(`控制台错误：${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ' + e);

await browser.close();
server.kill();
process.exit(r.stalls || errors.length ? 1 : 0);
