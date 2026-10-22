// v2.1 创意机制专项冒烟：免疫指定牌 / 花色免疫 / 距离陷阱 / 装备失效 / 马政 / 效果转移
// 用法：node scripts/smoke-v21.mjs [html文件名]
//
// 思路：先跑一局无头 AI 对战拿到「活着的 G 状态」，再对 window.xtsV21（引擎查询层）断言。
// 这些查询正是 actions.ts / rules.ts / turn.ts 实际消费的接线点，故断言它们即验证机制生效。
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8905;
const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}`;

const server = spawn(process.execPath, [path.join(dirname, 'serve-dist.mjs'), String(PORT)], {
  cwd: path.resolve(dirname, '..'),
  stdio: 'ignore',
});
async function waitServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, path: '/', method: 'HEAD', timeout: 1000 }, (res) => {
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
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const errors = [];
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

if (!(await waitServer())) {
  console.error('❌ 静态服务器未能启动');
  server.kill();
  process.exit(1);
}
const browser = await chromium.launch(findHeadlessShell() ? { executablePath: findHeadlessShell() } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(url, { waitUntil: 'networkidle' });

// 反复开局的辅助函数：随机开直到出现包含目标角色的一局，返回 {seats, chars}
async function findRoster(wantIds, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const r = await page.evaluate(() => {
      const seats = [];
      for (let k = 0; k < 5; k++) seats.push(window.xtsV21.charOf(k));
      return seats;
    });
    if (wantIds.every((id) => r.includes(id))) return r;
    await page.evaluate((seats) => window.xtsAutoRun(1, seats), 5);
  }
  return null;
}

// 先开一局，让 G 进入可用状态
await page.evaluate((seats) => window.xtsAutoRun(1, seats), 5);

// ---- 1. 墨子【非攻】：免疫万箭齐发 / 南蛮入侵 + 敌人武器防具失效 ----
let roster = await findRoster(['mozi']);
check('开到含墨子的一局', !!roster, roster ? roster.join(',') : '未开到');
if (roster) {
  const moziIdx = roster.indexOf('mozi');
  const r = await page.evaluate(
    (i) => ({
      wanjian: window.xtsV21.cardImmune(i, '万箭齐发'),
      nanman: window.xtsV21.cardImmune(i, '南蛮入侵'),
      lebu: window.xtsV21.cardImmune(i, '乐不思蜀'),
      trickAsWanjian: window.xtsV21.canBeTarget(i, 'trick', '万箭齐发'),
      weaponVoid: window.xtsV21.equipVoid(i, 'weapon'),
      armorVoid: window.xtsV21.equipVoid(i, 'armor'),
      horseVoid: window.xtsV21.equipVoid(i, 'horsePlus'),
      trickStillTargetable: window.xtsV21.canBeTarget(i, 'trick', '过河拆桥'),
      trickRedirect: window.xtsV21.trickRedirect(i),
    }),
    moziIdx,
  );
  check('墨子免疫【万箭齐发】', r.wanjian && !r.trickAsWanjian);
  check('墨子免疫【南蛮入侵】', r.nanman);
  check('墨子不免疫【乐不思蜀】（仅群体 AOE）', !r.lebu);
  check('墨子免疫仅限 AOE，单体锦囊仍可指定', r.trickStillTargetable);
  check('墨子令敌人武器失效', r.weaponVoid);
  check('墨子令敌人防具失效', r.armorVoid);
  check('墨子不令敌人 +1 马失效（避免距离体系崩坏）', !r.horseVoid);
  check('墨子【兼爱】可转移锦囊', r.trickRedirect);
}

// ---- 2. 法拉第【避雷针】：免疫【闪电】 ----
roster = await findRoster(['faraday']);
check('开到含法拉第的一局', !!roster, roster ? roster.join(',') : '未开到');
if (roster) {
  const i = roster.indexOf('faraday');
  const r = await page.evaluate((i) => ({
    shandian: window.xtsV21.cardImmune(i, '闪电'),
    wanjian: window.xtsV21.cardImmune(i, '万箭齐发'),
    trickAsShandian: window.xtsV21.canBeTarget(i, 'trick', '闪电'),
  }), i);
  check('法拉第免疫【闪电】', r.shandian && !r.trickAsShandian);
  check('法拉第不免疫【万箭齐发】', !r.wanjian);
}

// ---- 3. 徐霞客【探险】：距离陷阱 ----
roster = await findRoster(['xuxiake']);
check('开到含徐霞客的一局', !!roster);
if (roster) {
  const i = roster.indexOf('xuxiake');
  const r = await page.evaluate((i) => window.xtsV21.distTrap(i), i);
  check('徐霞客距离陷阱阈值 = 1', r === 1, `min=${r}`);
}

// ---- 4. 郑和【航海图】：马政 ----
roster = await findRoster(['zhenghe']);
check('开到含郑和的一局', !!roster);
if (roster) {
  const i = roster.indexOf('zhenghe');
  const before = await page.evaluate((i) => window.xtsV21.horseDist(i), i);
  const after = await page.evaluate((i) => {
    const p = window.xtsV21.players()[i];
    p.equip.horsePlus = { id: 900001, name: '+1马', type: 'equip', sub: 'horsePlus', suit: '♠', num: '1', skill: 'horsePlus' };
    p.equip.horseMinus = { id: 900002, name: '-1马', type: 'equip', sub: 'horseMinus', suit: '♠', num: '1', skill: 'horseMinus' };
    return window.xtsV21.horseDist(i);
  }, i);
  check('郑和装备双马后马政减免增量 = 2', after - before === 2, `before=${before} after=${after}`);
}

// ---- 5. 卢瑟福【散射实验】：可转移【杀】 ----
roster = await findRoster(['luosefu']);
check('开到含卢瑟福的一局', !!roster);
if (roster) {
  const i = roster.indexOf('luosefu');
  const r = await page.evaluate((i) => ({
    sha: window.xtsV21.shaRedirect(i),
    trick: window.xtsV21.trickRedirect(i),
  }), i);
  check('卢瑟福可转移【杀】', r.sha);
  check('卢瑟福不可转移锦囊（仅墨子）', !r.trick);
}

// ---- 6. 巴斯德【免疫】：♦ 方片无效 ----
roster = await findRoster(['baside']);
check('开到含巴斯德的一局', !!roster);
if (roster) {
  const i = roster.indexOf('baside');
  const r = await page.evaluate((i) => ({
    d: window.xtsV21.canBeTarget(i, 'trick', '过河拆桥', '♦'),
    spade: window.xtsV21.canBeTarget(i, 'trick', '过河拆桥', '♠'),
  }), i);
  check('巴斯德免疫 ♦方片牌', !r.d);
  check('巴斯德不免疫 ♠黑桃牌', r.spade);
}

// ---- 汇总 ----
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(40)}\n通过 ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log('❌ 失败项:');
  for (const f of failed) console.log(`   - ${f.name}${f.extra ? ' (' + f.extra + ')' : ''}`);
}
if (errors.length) {
  console.log(`❌ 控制台错误 ${errors.length} 条:`);
  for (const e of errors.slice(0, 20)) console.log('   ' + e);
} else {
  console.log('✅ 无 console error / pageerror');
}

await browser.close();
server.kill();
process.exit(failed.length || errors.length ? 1 : 0);
