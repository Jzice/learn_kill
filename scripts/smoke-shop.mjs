// 聚焦冒烟：学分商店 / 局前配装 / 局内道具 的运行时无错校验
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8917;
const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}`;
const server = spawn(process.execPath, [path.join(dirname, 'serve-dist.mjs'), String(PORT)], {
  cwd: path.resolve(dirname, '..'), stdio: 'ignore',
});
async function waitServer(t = 8000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const ok = await new Promise((r) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, path: '/', method: 'HEAD', timeout: 1000 }, (res) => { res.resume(); r(true); });
      req.on('error', () => r(false)); req.on('timeout', () => { req.destroy(); r(false); }); req.end();
    });
    if (ok) return true; await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  return fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
    .map((d) => path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
    .find((e) => fs.existsSync(e));
}
const results = [], errors = [];
function check(n, ok, x = '') { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`); }
const exe = findHeadlessShell();
if (!(await waitServer())) { console.error('❌ 服务器未启动'); server.kill(); process.exit(1); }
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// 预置档案：充足学分 + 已解锁一件装备 + 持有道具 + 配装携带
await ctx.addInitScript(() => {
  const prof = {
    credits: 9999,
    creditDaily: { date: '2099-01-01', earned: 0 },
    unlockedChars: [], unlockedEquips: ['eq_wpn_1'], items: { it_reset: 2, it_shield: 1 },
    loadout: { weapon: null, armor: null, horsePlus: null, horseMinus: null, items: { it_reset: 1 } },
  };
  localStorage.setItem('xuetangsha_profile_v1', JSON.stringify(prof));
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));
await page.goto(url, { waitUntil: 'networkidle' });

// 1. 打开商店（角色页）
await page.evaluate(() => window.openShop('chars'));
await page.waitForTimeout(150);
check('商店弹窗显示', await page.isVisible('#shopModal.show'));
const charCards = await page.locator('#shopBody .shop-card').count();
check('角色卡片渲染', charCards > 0, `${charCards} 张`);
// 2. 切换到装备页
await page.evaluate(() => window.shopSetTab('equips'));
await page.waitForTimeout(150);
const equipCards = await page.locator('#shopBody .shop-card').count();
check('装备卡片渲染', equipCards === 18, `${equipCards} 张`);
// 3. 解锁一名角色
await page.evaluate(() => window.shopUnlockChar('ex_0_cn'));
await page.waitForTimeout(100);
const afterUnlock = await page.evaluate(() => JSON.parse(localStorage.getItem('xuetangsha_profile_v1')).unlockedChars);
check('解锁角色入账', Array.isArray(afterUnlock) && afterUnlock.includes('ex_0_cn'), JSON.stringify(afterUnlock));
// 4. 购买装备
await page.evaluate(() => window.shopBuyEquip('eq_arm_1'));
await page.waitForTimeout(100);
const afterBuy = await page.evaluate(() => JSON.parse(localStorage.getItem('xuetangsha_profile_v1')).unlockedEquips);
check('购买装备入账', Array.isArray(afterBuy) && afterBuy.includes('eq_arm_1'), JSON.stringify(afterBuy));
// 5. 局前配装：装配武器 + 携带道具
await page.evaluate(() => window.shopSetLoadoutSlot('weapon', 'eq_wpn_1'));
await page.evaluate(() => window.shopAddLoadoutItem('it_reset', 1));
await page.waitForTimeout(100);
const loadout = await page.evaluate(() => JSON.parse(localStorage.getItem('xuetangsha_profile_v1')).loadout);
check('局前配装写入（武器）', loadout.weapon === 'eq_wpn_1', JSON.stringify(loadout));
check('局前配装写入（道具）', (loadout.items.it_reset || 0) === 2, JSON.stringify(loadout.items));
// 6. 进入开局界面，渲染配装栏
await page.evaluate(() => window.closeShop());
await page.evaluate(() => window.enterSetup('single'));
await page.waitForTimeout(150);
check('开局界面配装栏可见', await page.isVisible('#loadoutBar'));
// 7. 开始单机对局，校验道具注入与局内道具栏
await page.evaluate(() => window.startSingle());
await page.waitForTimeout(600);
check('对局界面激活', await page.isVisible('#screenGame.active'));
const itemBarVisible = await page.evaluate(() => {
  const el = document.getElementById('itemBar');
  return !!el && el.style.display !== 'none' && el.children.length > 0;
});
check('局内道具栏渲染', itemBarVisible);
// 8. 使用道具（应无报错）
await page.evaluate(() => window.useItem(0, 'it_reset'));
await page.waitForTimeout(300);
const itemUsed = await page.evaluate(() => {
  const el = document.getElementById('itemBar');
  return el ? el.textContent : '';
});
check('道具使用无异常', true, itemUsed.slice(0, 40));

await browser.close();
server.kill();
console.log(`\n控制台错误数: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  ⚠ ' + e));
const pass = results.filter(Boolean).length;
console.log(`\n===== ${pass}/${results.length} 通过 =====`);
process.exit(errors.length === 0 && pass === results.length ? 0 : 1);
