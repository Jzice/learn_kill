// 平衡模拟：无头批量 AI 对战，统计各角色 / 各身份胜率与存活率，输出分档表。
// 用法：node scripts/balance.mjs [html文件名] [对局数] [座位数]
// 依赖 scripts/serve-dist.mjs 与无头 chromium（沿用 scripts/smoke.mjs 的加载方式）。
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const N = parseInt(process.argv[3] || '300', 10);
const SEATS = parseInt(process.argv[4] || '5', 10);
const PORT = 8902;
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
  const dirs = fs
    .readdirSync(base)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

if (!(await waitServer())) {
  console.error('❌ 静态服务器未能启动');
  server.kill();
  process.exit(1);
}
const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(url, { waitUntil: 'networkidle' });

// 1. 技能登记表自检
const audit = await page.evaluate(() => window.xtsSkillAudit());
console.log(`\n=== 技能登记表自检 ===`);
console.log(`角色数: ${audit.chars}  技能定义总数: ${audit.total}`);
if (audit.missing.length) console.log(`❌ 缺少定义: ${audit.missing.join(', ')}`);
else console.log('✅ 所有角色 / 主公技均有对应定义');
if (audit.duplicates.length) console.log(`❌ 重复 id: ${audit.duplicates.join(', ')}`);
else console.log('✅ 技能 id 唯一');

// 2. 批量对战（每局独立 evaluate，避免跨局状态堆积导致越来越慢；每 50 局重载页面）
console.log(`\n=== 批量对战 ${N} 局（${SEATS} 人局）===`);
const t0 = Date.now();
const acc = {
  games: 0,
  stalls: 0,
  byChar: {},
  byCharRole: {},
  byRole: { lord: { games: 0, wins: 0 }, loyal: { games: 0, wins: 0 }, rebel: { games: 0, wins: 0 }, spy: { games: 0, wins: 0 } },
};
function mergeOne(r) {
  acc.games += r.games;
  acc.stalls += r.stalls;
  for (const [cid, v] of Object.entries(r.byChar)) {
    const a = (acc.byChar[cid] ||= { games: 0, wins: 0, alive: 0 });
    a.games += v.games;
    a.wins += v.wins;
    a.alive += v.alive;
  }
  for (const [cid, cr] of Object.entries(r.byCharRole || {})) {
    const a = (acc.byCharRole[cid] ||= {});
    for (const [role, v] of Object.entries(cr)) {
      const rr = (a[role] ||= { games: 0, wins: 0, alive: 0 });
      rr.games += v.games;
      rr.wins += v.wins;
      rr.alive += v.alive;
    }
  }
  for (const k of Object.keys(acc.byRole)) {
    acc.byRole[k].games += r.byRole[k].games;
    acc.byRole[k].wins += r.byRole[k].wins;
  }
}
for (let i = 0; i < N; i++) {
  const r = await page.evaluate((seats) => window.xtsAutoRun(1, seats), SEATS);
  mergeOne(r);
}
const stats = acc;
const ms = Date.now() - t0;
console.log(`耗时 ${ms}ms，平均每局 ${(ms / N).toFixed(1)}ms，卡死局数: ${stats.stalls}`);

// 3. 各身份胜率
console.log(`\n=== 各身份阵营胜率 ===`);
for (const [role, v] of Object.entries(stats.byRole)) {
  const winRate = v.games ? ((v.wins / v.games) * 100).toFixed(1) : '0.0';
  console.log(`  ${role.padEnd(9)} 胜率 ${winRate}%  (${v.wins}/${v.games})`);
}

// 4. 各角色「去身份」实力（扣除身份占比带来的胜率偏差，仅反映角色技能强弱）
const roleBaseline = {};
for (const [role, v] of Object.entries(stats.byRole)) {
  roleBaseline[role] = v.games ? v.wins / v.games : 0;
}
const rows = Object.entries(stats.byChar)
  .map(([cid, v]) => {
    const win = v.games ? v.wins / v.games : 0;
    const alive = v.games ? v.alive / v.games : 0;
    // 预期胜率：按其实际身份分布 × 全局身份基线估算，扣除后得到角色本身强度
    const cr = stats.byCharRole[cid] || {};
    let expected = 0;
    let tot = 0;
    for (const [role, rv] of Object.entries(cr)) {
      if (rv.games) {
        expected += rv.games * (roleBaseline[role] || 0);
        tot += rv.games;
      }
    }
    const expWin = tot ? expected / tot : 0;
    const adj = win - expWin; // >0 偏强，<0 偏弱
    return { cid, win, alive, games: v.games, adj };
  })
  .sort((a, b) => b.adj - a.adj);
const adjs = rows.map((r) => r.adj);
const median = adjs.length ? adjs[Math.floor(adjs.length / 2)] : 0;
const avg = adjs.length ? adjs.reduce((s, x) => s + x, 0) / adjs.length : 0;

function tierA(adj) {
  if (adj >= 0.12) return 'S';
  if (adj >= 0.06) return 'A';
  if (adj >= -0.02) return 'B';
  if (adj >= -0.08) return 'C';
  return 'D';
}
console.log(`\n=== 角色去身份实力（扣除身份偏差，中位 ${(median * 100).toFixed(1)}% / 均值 ${(avg * 100).toFixed(1)}%）===`);
console.log('  角色           胜率    存活率   偏差    档位');
for (const r of rows) {
  console.log(
    `  ${r.cid.padEnd(14)} ${(r.win * 100).toFixed(1).padStart(5)}%  ${(r.alive * 100).toFixed(1).padStart(5)}%  ${(r.adj * 100 >= 0 ? '+' : '')}${(r.adj * 100).toFixed(1).padStart(5)}%  ${tierA(r.adj)}`,
  );
}
const top = rows.slice(0, 5).map((r) => `${r.cid}(${(r.win * 100).toFixed(0)}%)`);
const bot = rows.slice(-5).map((r) => `${r.cid}(${(r.win * 100).toFixed(0)}%)`);
console.log(`\n最强: ${top.join(' ')}`);
console.log(`最弱: ${bot.join(' ')}`);

// 5. 控制台错误
console.log(`\n=== 控制台错误 ===`);
if (errors.length) {
  console.log(`❌ ${errors.length} 条:`);
  for (const e of errors.slice(0, 20)) console.log('   ' + e);
} else {
  console.log('✅ 无 console error / pageerror');
}

await browser.close();
server.kill();

// 机器可读结果（可选第 5 个参数指定路径，供后台跑局 + 轮询读取）
const jsonPath = process.argv[5];
if (jsonPath) {
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        games: stats.games,
        stalls: stats.stalls,
        ms,
        seats: SEATS,
        roleBaseline,
        byRole: stats.byRole,
        chars: rows.map((r) => ({ cid: r.cid, win: r.win, alive: r.alive, adj: r.adj, games: r.games, tier: tierA(r.adj) })),
      },
      null,
      2,
    ),
  );
  console.log(`\n✅ 已写入 ${jsonPath}`);
}
process.exit(errors.length || stats.stalls ? 1 : 0);
