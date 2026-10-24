// 联机复现：客人完整参与对战（答题/出牌/选目标），验证客人选牌是否生效
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8904;
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
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

if (!(await waitServer())) {
  console.error('服务器未启动');
  server.kill();
  process.exit(1);
}
const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});

async function state(page) {
  return page.evaluate(() => ({
    hint: document.getElementById('actionHint')?.textContent || '',
    quizOpen: !!document.querySelector('#quizModal.show'),
    handCount: document.querySelectorAll('#handRow .card').length,
    clickable: document.querySelectorAll('#handRow .card.clickable').length,
    handNames: [...document.querySelectorAll('#handRow .card .cname')].map((x) => x.textContent),
    logCount: document.querySelectorAll('#playLogList .play-log-item').length,
    turn: document.getElementById('turnName')?.textContent || '',
    gameOver: document.body.textContent.includes('获胜'),
  }));
}

const ctxH = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxG = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctxH.newPage();
const guest = await ctxG.newPage();
const errs = { host: [], guest: [] };
const t0 = Date.now();
const hostLog = [];
const guestLog = [];
function logLine(arr, page, m) {
  arr.push(`+${((Date.now() - t0) / 1000).toFixed(1)}s [${page}] ${m}`);
}
host.on('pageerror', (e) => {
  errs.host.push(e.message);
  logLine(hostLog, 'host', 'PAGEERROR: ' + e.message);
});
guest.on('pageerror', (e) => {
  errs.guest.push(e.message);
  logLine(guestLog, 'guest', 'PAGEERROR: ' + e.message);
});
host.on('console', (m) => {
  const line = (m.type() === 'error' ? 'console-error: ' : '') + m.text();
  if (m.type() === 'error') errs.host.push(m.text());
  logLine(hostLog, 'host', line);
});
guest.on('console', (m) => {
  const line = (m.type() === 'error' ? 'console-error: ' : '') + m.text();
  if (m.type() === 'error') errs.guest.push(m.text());
  logLine(guestLog, 'guest', line);
});
await host.addInitScript(() => {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED_REJECTION: ' + (e.reason && e.reason.stack ? e.reason.stack : String(e.reason)));
  });
  // 看门狗：每 2 秒心跳。若心跳停止而页面无响应 → 主线程被阻塞；心跳继续但游戏静默 → 游戏循环死亡
  setInterval(() => console.log('[WD] host alive'), 2000);
});
await guest.addInitScript(() => {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED_REJECTION: ' + (e.reason && e.reason.stack ? e.reason.stack : String(e.reason)));
  });
  setInterval(() => console.log('[WD] guest alive'), 2000);
});
host.on('dialog', (d) => d.accept().catch(() => {}));
guest.on('dialog', (d) => d.accept().catch(() => {}));

await host.goto(url, { waitUntil: 'networkidle' });
await guest.goto(url, { waitUntil: 'networkidle' });

await host.click('#modePicker .mode-card[data-mode="net"]');
await host.click('#createRoomBtn');
await host.waitForFunction(
  () => /房间号：<span[^>]*>(\d{6})/.test(document.getElementById('roomInfo')?.innerHTML || ''),
  { timeout: 20000 },
);
const code = ((await host.textContent('#roomInfo')) || '').match(/(\d{6})/)[1];
console.log('房间号:', code);

await guest.click('#modePicker .mode-card[data-mode="net"]');
await guest.click('#netModePicker .opt-btn[data-net="join"]');
await guest.waitForSelector('#joinConfig', { state: 'visible', timeout: 3000 });
await guest.fill('#joinCode', code);
await guest.click('#joinRoomBtn');
await guest.waitForFunction(
  () => (document.getElementById('joinStatus')?.textContent || '').includes('已连接房主'),
  { timeout: 20000 },
);
console.log('客人已连接');

// 客人先选角色（默认随机即可），房主开始
await host.click('#hostStartBtn');
// 随机模式：先弹「亮将确认」，确认后才进入对局（与 smoke-net.mjs 口径一致）
await host
  .waitForSelector('#revealModal.show', { timeout: 5000 })
  .then(() => host.click('#revealBody button[onclick="revealConfirm()"]'))
  .catch(() => {});
await host.waitForSelector('#screenGame.active', { timeout: 15000 });
await guest.waitForSelector('#screenGame.active', { timeout: 10000 });
console.log('双方开局');

// 主循环：谁有提示就操作谁；重点记录客人的每次操作与双手牌变化
const trace = [];
let lastGuestHint = '';
const start = Date.now();
let guestPlays = 0;
let stuckGuest = 0;
let stuck = false;
while (Date.now() - start < 90000) {
  const hs = await state(host);
  const gs = await state(guest);
  if (hs.gameOver || gs.gameOver) {
    trace.push(`[结算] ${hs.hint}`);
    break;
  }

  // 客人侧交互
  if (gs.quizOpen) {
    trace.push(`[客人][答题]`);
    await guest.click('.quiz-option');
    await guest.waitForTimeout(1800);
    continue;
  }
  const gh = gs.hint;
  if (gh !== lastGuestHint) {
    trace.push(`[客人] ${gh} (手牌${gs.handCount} 可点${gs.clickable}: ${gs.handNames.join('/')})`);
    lastGuestHint = gh;
  }
  if (gh.includes('点击手牌出牌')) {
    if (gs.clickable === 0) {
      trace.push(`[客人] 无可点牌（可能仅剩闪/桃满血），点结束出牌`);
      const endBtn = guest.locator('button:has-text("结束出牌")');
      if (await endBtn.count()) await endBtn.click();
      await guest.waitForTimeout(800);
      continue;
    }
    const before = await state(guest);
    await guest.locator('#handRow .card.clickable').first().click();
    await guest.waitForTimeout(700);
    const mid = await state(guest);
    if (mid.hint.includes('点击座位卡选择目标')) {
      const tgt = guest.locator('#seatRing .seat-targetable');
      if (await tgt.count()) await tgt.first().click();
      await guest.waitForTimeout(1200);
    } else if (mid.quizOpen) {
      await guest.click('.quiz-option');
      await guest.waitForTimeout(1800);
    }
    const after = await state(guest);
    guestPlays++;
    trace.push(`[客人] 出牌点击: ${before.handCount} → ${after.handCount} 张, 日志 ${before.logCount} → ${after.logCount}`);
    continue;
  }
  if (gh.includes('弃置')) {
    await guest.locator('#handRow .card.clickable').first().click();
    await guest.waitForTimeout(500);
    continue;
  }
  if (gh.includes('需要出【闪】')) {
    const s2 = await state(guest);
    if (s2.clickable > 0) {
      await guest.locator('#handRow .card.clickable').first().click();
      trace.push(`[客人] 出闪成功`);
    } else {
      const btn = guest.locator('button:has-text("承受伤害")');
      if (await btn.count()) await btn.click();
      trace.push(`[客人] 无闪(${s2.handNames.join('/')})，承受伤害`);
    }
    await guest.waitForTimeout(1200);
    continue;
  }
  if (gh.includes('濒死')) {
    const btn = guest.locator('button:has-text("放弃")');
    if (await btn.count()) await btn.click();
    await guest.waitForTimeout(1500);
    continue;
  }
  if (gh.includes('参悟')) {
    await guest.locator('button:has-text("跳过")').click();
    await guest.waitForTimeout(400);
    continue;
  }
  if (gh.includes('点击座位卡选择目标')) {
    const tgt = guest.locator('#seatRing .seat-targetable');
    if (await tgt.count()) {
      await tgt.first().click();
      await guest.waitForTimeout(800);
    }
    continue;
  }
  if (gh.includes('请选择')) {
    const btns = await guest.locator('#actionBtns button').count();
    if (btns > 0) {
      await guest.locator('#actionBtns button').first().click();
      await guest.waitForTimeout(600);
    }
    continue;
  }

  // 房主侧交互（同样策略，保证游戏推进）
  if (hs.quizOpen) {
    await host.click('.quiz-option');
    await host.waitForTimeout(1800);
    continue;
  }
  const hh = hs.hint;
  if (hh.includes('点击手牌出牌')) {
    const endBtn = host.locator('button:has-text("结束出牌")');
    if (await endBtn.count()) await endBtn.click();
    await host.waitForTimeout(600);
    continue;
  }
  if (hh.includes('弃置')) {
    const c = host.locator('#handRow .card.clickable');
    if (await c.count()) await c.first().click();
    await host.waitForTimeout(400);
    continue;
  }
  if (hh.includes('需要出【闪】') || hh.includes('濒死')) {
    const c = host.locator('#handRow .card.clickable');
    if (await c.count()) await c.first().click();
    else {
      const btn = host.locator('button:has-text("承受伤害"), button:has-text("放弃")');
      if (await btn.count()) await btn.first().click();
    }
    await host.waitForTimeout(1000);
    continue;
  }
  if (hh.includes('参悟')) {
    await host.locator('button:has-text("跳过")').click();
    await host.waitForTimeout(400);
    continue;
  }
  if (hh.includes('点击座位卡选择目标')) {
    const tgt = host.locator('#seatRing .seat-targetable');
    if (await tgt.count()) {
      await tgt.first().click();
      await host.waitForTimeout(800);
    }
    continue;
  }
  if (hh.includes('请选择')) {
    const btns = await host.locator('#actionBtns button').count();
    if (btns > 0) {
      await host.locator('#actionBtns button').first().click();
      await host.waitForTimeout(600);
    }
    continue;
  }
  // 客人卡死检测：提示为“请稍候…”持续超过 8 秒 →  dump 房主状态
  if (gh.includes('请稍候')) {
    stuckGuest++;
    if (stuckGuest === 16) {
      stuck = true;
      const hs2 = await state(host);
      trace.push(`!!! 客人卡在“请稍候…”8秒+，房主提示: "${hs2.hint}" 回合:${hs2.turn} 日志:${hs2.logCount}`);
      await guest.screenshot({ path: path.resolve(dirname, '..', 'dist', 'repro-stuck-guest.png') });
      await host.screenshot({ path: path.resolve(dirname, '..', 'dist', 'repro-stuck-host.png') });
    }
  } else {
    stuckGuest = 0;
  }

  await host.waitForTimeout(500);
}

const finalH = await state(host);
const finalG = await state(guest);
console.log('===== 轨迹 =====');
trace.forEach((t) => console.log(t));
console.log('===== 房主错误 =====', errs.host.length ? errs.host.join(' ; ') : '(无)');
console.log('===== 客人错误 =====', errs.guest.length ? errs.guest.join(' ; ') : '(无)');
console.log('客人出牌次数:', guestPlays);
console.log('卡死检测:', stuck ? '❌ 出现客人无法选牌' : '✅ 未出现');
if (stuck || process.argv.includes('--trace')) {
  console.log('===== 房主消息流（末 40 条） =====');
  hostLog.slice(-40).forEach((l) => console.log(l));
  console.log('===== 客人消息流（末 40 条） =====');
  guestLog.slice(-40).forEach((l) => console.log(l));
}
await browser.close();
server.kill();
if (stuck) process.exit(1);
