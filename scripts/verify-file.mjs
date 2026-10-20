// file:// 直开验证：确认题库分片能以经典脚本注入（fetch 在 file:// 下会被 CORS 拦截）
// 这是题库外置方案的关键前提——双击 dist 产物也必须能抽到题。
//   node scripts/verify-file.mjs [产物文件名]
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
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(fileUrl, { waitUntil: 'load' });
await page.waitForTimeout(2000);

// 直接走运行时同一条路径：注入 banks/<学期>/<学科>.js，看 window.__XTS_BANK__ 是否被填充
const res = await page.evaluate(async () => {
  const key = '初一上/数学';
  const src = 'banks/' + encodeURIComponent('初一上') + '/' + encodeURIComponent('数学') + '.js';
  const ok = await new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => {
      el.remove();
      resolve(true);
    };
    el.onerror = () => {
      el.remove();
      resolve(false);
    };
    document.head.appendChild(el);
    setTimeout(() => resolve(false), 5000);
  });
  const slice = window.__XTS_BANK__?.[key];
  return { loaded: ok, count: slice?.q?.length ?? 0, sample: slice?.q?.[0]?.q ?? '' };
});

console.log('file:// URL:', fileUrl);
console.log('题库分片注入:', res.loaded ? '✅ 成功' : '❌ 失败');
console.log('分片题数:', res.count, res.count > 0 ? '✅' : '❌');
if (res.sample) console.log('样题:', res.sample.slice(0, 30));
console.log('JS 错误:', errs.length ? '\n' + errs.join('\n') : '(无)');

await browser.close();
const ok = res.loaded && res.count > 0 && errs.length === 0;
console.log(ok ? '✅ file:// 直开可加载题库（双击即玩成立）' : '❌ file:// 题库加载不可用');
process.exit(ok ? 0 : 1);
