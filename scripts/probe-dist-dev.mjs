// 探测：对比 dev 服务器与 dist 产物的界面一致性
// 用法：node scripts/probe-dist-dev.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const DIST_PORT = 8907;
const DEV_PORT = 8908;
const distUrl = `http://127.0.0.1:${DIST_PORT}/${encodeURIComponent('学堂杀.html')}`;
const devUrl = `http://127.0.0.1:${DEV_PORT}/index.html`;

// dist 静态服务器
const server = spawn(process.execPath, [path.join(dirname, 'serve-dist.mjs'), String(DIST_PORT)], {
  cwd: root,
  stdio: 'ignore',
});
// dev 服务器
process.env.VITE_PEERJS_MODE = 'cdn';
const { createServer } = await import('vite');
const vserver = await createServer({
  configFile: path.join(root, 'vite.config.ts'),
  server: { open: false, port: DEV_PORT, strictPort: true, host: '127.0.0.1' },
  logLevel: 'error',
});
await vserver.listen();

async function waitUrl(u, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.request(u, { method: 'HEAD', timeout: 1000 }, (res) => {
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
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs
    .readdirSync(base)
    .filter((x) => x.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const SNAPSHOT_FN = () => {
  const PROPS = [
    'display', 'position', 'top', 'left', 'width', 'height', 'margin', 'padding',
    'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'backgroundImage',
    'borderRadius', 'borderWidth', 'borderColor', 'boxShadow', 'opacity', 'visibility',
    'zIndex', 'transform', 'overflow', 'flexDirection', 'gap', 'gridTemplateColumns', 'letterSpacing',
  ];
  const key = (el) => {
    if (el.id) return '#' + el.id;
    const parts = [];
    let n = el;
    while (n && n !== document.body) {
      const p = n.parentElement;
      if (!p) break;
      parts.unshift(n.tagName.toLowerCase() + ':nth-child(' + ([...p.children].indexOf(n) + 1) + ')');
      n = p;
    }
    return parts.join('>');
  };
  const map = {};
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const props = {};
    for (const p of PROPS) {
      let v = cs[p] || '';
      if (p === 'backgroundImage' || p === 'boxShadow' || p === 'transform') v = v.slice(0, 80);
      props[p] = v;
    }
    const r = el.getBoundingClientRect();
    map[key(el)] = { props, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  }
  // CSS 规则选择器集合（用于发现构建后被丢弃的规则）
  const sels = new Set();
  let ruleCount = 0;
  for (const ss of document.styleSheets) {
    let rules;
    try {
      rules = ss.cssRules;
    } catch {
      continue;
    }
    for (const r of rules) {
      ruleCount++;
      if (r.selectorText) sels.add(r.selectorText.replace(/\s+/g, ' ').trim());
    }
  }
  return {
    map,
    sels: [...sels],
    ruleCount,
    els: document.querySelectorAll('body *').length,
    ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim(),
    dataTheme: document.body.dataset.theme + '/' + document.body.dataset.mode,
  };
};

if (!(await waitUrl(distUrl)) || !(await waitUrl(devUrl))) {
  console.error('服务器未就绪');
  await vserver.close();
  server.kill();
  process.exit(1);
}

const exe = findHeadlessShell();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const errs = { dev: [], dist: [] };

async function snap(url, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs[tag].push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screenLobby.active', { timeout: 20000 });
  await page.waitForTimeout(600);
  const s = await page.evaluate(SNAPSHOT_FN);
  await page.screenshot({ path: path.join(root, 'dist', `probe-${tag}.png`), fullPage: false });
  await ctx.close();
  return s;
}

const dev = await snap(devUrl, 'dev');
const dist = await snap(distUrl, 'dist');

console.log(`元素数     dev=${dev.els}  dist=${dist.els}`);
console.log(`CSS 规则数 dev=${dev.ruleCount}  dist=${dist.ruleCount}`);
console.log(`CSS 选择器 dev=${dev.sels.length}  dist=${dist.sels.length}`);
console.log(`id 数量    dev=${dev.ids.length}  dist=${dist.ids.length}`);
console.log(`主题属性   dev=${dev.dataTheme}  dist=${dist.dataTheme}`);

// 1) 缺失元素
const distKeys = new Set(Object.keys(dist.map));
const devKeys = new Set(Object.keys(dev.map));
const missingInDist = [...devKeys].filter((k) => !distKeys.has(k));
const missingInDev = [...distKeys].filter((k) => !devKeys.has(k));
console.log(`\n[缺失元素] dev有dist无: ${missingInDist.length}  dist有dev无: ${missingInDev.length}`);
missingInDist.slice(0, 12).forEach((k) => console.log('  - ' + k));
missingInDev.slice(0, 12).forEach((k) => console.log('  + ' + k));

// 2) 计算样式差异
const diffs = [];
for (const [k, dv] of Object.entries(dev.map)) {
  const cv = dist.map[k];
  if (!cv) continue;
  const pd = [];
  for (const p of Object.keys(dv.props)) if (dv.props[p] !== cv.props[p]) pd.push(`${p}: dev=${dv.props[p]} | dist=${cv.props[p]}`);
  const rd = dv.rect.some((v, i) => v !== cv.rect[i]);
  if (pd.length || rd) diffs.push({ k, pd, rd, devRect: dv.rect, distRect: cv.rect });
}
console.log(`\n[样式差异元素] ${diffs.length}`);
diffs.slice(0, 20).forEach((d) => {
  console.log(`  ${d.k}`);
  if (d.rd) console.log(`    尺寸 dev=${d.devRect} dist=${d.distRect}`);
  d.pd.slice(0, 4).forEach((p) => console.log('    ' + p));
});

// 3) CSS 选择器差异（构建是否丢规则）
const distSel = new Set(dist.sels);
const lost = dev.sels.filter((s) => !distSel.has(s));
console.log(`\n[构建后丢失的 CSS 规则] ${lost.length}`);
lost.slice(0, 30).forEach((s) => console.log('  - ' + s));

// 4) 文本内容差异
console.log(`\n[正文文本一致] ${dev.bodyText === dist.bodyText}`);
if (dev.bodyText !== dist.bodyText) {
  const a = dev.bodyText;
  const b = dist.bodyText;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  console.log(`  首个差异位置 ${i}`);
  console.log(`  dev : ...${a.slice(Math.max(0, i - 40), i + 60)}`);
  console.log(`  dist: ...${b.slice(Math.max(0, i - 40), i + 60)}`);
}

console.log(`\n[JS 错误] dev=${errs.dev.length} dist=${errs.dist.length}`);
errs.dev.slice(0, 3).forEach((e) => console.log('  dev: ' + e));
errs.dist.slice(0, 3).forEach((e) => console.log('  dist: ' + e));

await browser.close();
await vserver.close();
server.kill();
process.exit(0);