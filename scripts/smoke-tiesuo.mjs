// 铁索连环·横置 机制回归测试：验证属性伤害在连环角色间传导、连环重置、普通伤害不传导
// 用法：node scripts/smoke-tiesuo.mjs [html文件名]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8902;
const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}?debug=1`;

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

const executablePath = findHeadlessShell();
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

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
// 进入单机对局以初始化 G
await page.click('#modePicker .mode-card[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });
await page.click('#startBtn');
// 随机模式：先过亮将确认弹窗
await page.waitForSelector('#revealModal.show', { timeout: 3000 });
await page.click('#revealBody button[onclick="revealConfirm()"]');
await page.waitForSelector('#screenGame.active', { timeout: 5000 });
// 等待对局玩家初始化完成（默认 5 人比原先 4 人略久，避免固定等待在负载下偶发不足）
await page.waitForFunction(() => window.__game && window.__game.G.players.length >= 3, { timeout: 8000 });
// 彻底停住对局循环并清空手牌：主公常由 AI 担任而先行其回合，其在途动作（尤其【铁索连环】会横置/重置
// 测试目标）会在后续 dealDamage 的动画 await 间隙触发并污染连环状态。置 gameOver + 清空手牌（无牌可出
// 即不会再横置任何人），再等待在途动作收尾，最后才跑场景。
await page.evaluate(() => {
  const g = window.__game;
  if (!g) return;
  g.G.gameOver = true;
  g.G.players.forEach((p) => {
    p.hand = [];
  });
});
await page.waitForTimeout(3000);

// 通过调试钩子直接驱动机制（暂停主循环避免 AI 干扰）
const out = await page.evaluate(async () => {
  const g = window.__game;
  if (!g) return { error: 'no __game (debug hook missing)' };
  const G = g.G;
  G.gameOver = true; // 暂停 AI 自动推进
  const ps = G.players;
  ps.forEach((p) => {
    p.alive = true;
    p.hp = p.maxHp = 4;
    p.chained = false;
    p.shield = 0;
    p.knowledge = 0;
  });

  // 场景1：连环 A、B，对 A 造成 2 点火伤 → B 被传导 2 点，A、B 均重置
  ps[1].chained = true;
  ps[2].chained = true;
  await g.dealDamage(3, 1, 2, 'fire');
  const r1 = { hp1: ps[1].hp, hp2: ps[2].hp, c1: ps[1].chained, c2: ps[2].chained };

  // 场景2：连环 A、B，对 A 造成 1 点普通伤害 → 不传导，仅 A 受伤
  ps.forEach((p) => {
    p.chained = false;
    p.hp = 4;
  });
  ps[1].chained = true;
  ps[2].chained = true;
  await g.dealDamage(3, 1, 1, 'normal');
  const r2 = { hp1: ps[1].hp, hp2: ps[2].hp, c1: ps[1].chained, c2: ps[2].chained };

  // 场景3：仅连环 A（无其他连环者），对 A 火伤 → 自身受伤，不向任何人传导
  ps.forEach((p) => {
    p.chained = false;
    p.hp = 4;
  });
  ps[1].chained = true;
  await g.dealDamage(3, 1, 2, 'fire');
  const r3 = { hp1: ps[1].hp, hp2: ps[2].hp, c1: ps[1].chained };

  return { r1, r2, r3 };
});

if (out.error) {
  check('调试钩子可用', false, out.error);
} else {
  const { r1, r2, r3 } = out;
  check('属性伤害在连环角色间传导 + 连环重置', r1.hp1 === 2 && r1.hp2 === 2 && r1.c1 === false && r1.c2 === false,
    `A:${r1.hp1} B:${r1.hp2} chained:${r1.c1}/${r1.c2}`);
  check('普通伤害不触发连环传导', r2.hp1 === 3 && r2.hp2 === 4 && r2.c1 === true && r2.c2 === true,
    `A:${r2.hp1} B:${r2.hp2} chained:${r2.c1}/${r2.c2}`);
  check('仅一名连环者时火伤不向他人传导', r3.hp1 === 2 && r3.hp2 === 4 && r3.c1 === false,
    `A:${r3.hp1} B:${r3.hp2} chainedA:${r3.c1}`);
}

check('控制台零错误', errors.length === 0, errors.slice(0, 3).join(' ; '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
if (failed.length) {
  console.log('失败项:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
