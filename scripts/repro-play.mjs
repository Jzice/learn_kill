// 交互式复现：以脚本方式完整打完一局单机对战，记录每次提示与点击结果
// 重点验证：用户出牌阶段手牌是否可点、点击后是否生效、AI 出牌后是否卡死
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8903;
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push('console: ' + m.text());
});
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(url, { waitUntil: 'networkidle' });
await page.click('#startBtn');
await page.waitForSelector('#screenGame.active');

const trace = [];
let lastHint = '';
let stuckCount = 0;
const start = Date.now();
const MAX_MS = 90000;

async function state() {
  return page.evaluate(() => ({
    hint: document.getElementById('actionHint')?.textContent || '',
    quizOpen: !!document.querySelector('#quizModal.show'),
    handCount: document.querySelectorAll('#handRow .card').length,
    clickable: document.querySelectorAll('#handRow .card.clickable').length,
    handNames: [...document.querySelectorAll('#handRow .card .cname')].map((x) => x.textContent),
    logCount: document.querySelectorAll('#playLogList .play-log-item').length,
    turn: document.getElementById('turnName')?.textContent || '',
    gameOver: document.body.textContent.includes('获胜'),
    markOpen: !!document.querySelector('#markModal.show'),
  }));
}

while (Date.now() - start < MAX_MS) {
  const s = await state();
  if (s.gameOver) {
    trace.push(`[结算] ${s.hint}`);
    break;
  }
  if (s.quizOpen) {
    trace.push(`[答题] 点击第一项`);
    await page.click('.quiz-option');
    await page.waitForTimeout(1800);
    continue;
  }
  if (s.markOpen) {
    await page.click('#markModal button:last-child');
    continue;
  }

  const h = s.hint;
  const isMyTurnPrompt =
    h.includes('点击手牌出牌') ||
    h.includes('弃置') ||
    h.includes('需要出【闪】') ||
    h.includes('濒死') ||
    h.includes('参悟') ||
    h.includes('请选择');

  if (h !== lastHint) {
    trace.push(`[${s.turn}] ${h} (手牌${s.handCount}张 可点${s.clickable})`);
    lastHint = h;
    stuckCount = 0;
  } else if (isMyTurnPrompt) {
    stuckCount++;
    if (stuckCount === 20) {
      trace.push(`!!! 卡死疑似：提示 20 秒未变化且等待用户输入: ${h}`);
    }
  }

  if (h.includes('点击手牌出牌')) {
    // 出牌阶段：检查可点手牌
    const before = await state();
    if (before.clickable === 0) {
      trace.push(`!!! BUG: 出牌阶段无可点击手牌！手牌=${before.handNames.join('/')}`);
      await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'repro-bug.png') });
      break;
    }
    // 点第一张可点的牌
    await page.locator('#handRow .card.clickable').first().click();
    await page.waitForTimeout(600);
    const mid = await state();
    if (mid.hint.includes('点击座位卡选择目标')) {
      trace.push(`  选目标中…`);
      await page.locator('#seatRing .seat-targetable').first().click();
      await page.waitForTimeout(1200);
    } else if (mid.quizOpen) {
      trace.push(`  触发技能答题`);
      await page.click('.quiz-option');
      await page.waitForTimeout(1800);
    }
    const after = await state();
    trace.push(`  出牌点击: ${before.handCount} → ${after.handCount} 张, 日志 ${before.logCount} → ${after.logCount}`);
    continue;
  }
  if (h.includes('弃置')) {
    await page.locator('#handRow .card.clickable').first().click();
    await page.waitForTimeout(500);
    continue;
  }
  if (h.includes('需要出【闪】')) {
    const s2 = await state();
    if (s2.clickable > 0) {
      await page.locator('#handRow .card.clickable').first().click();
      trace.push(`  出闪点击成功`);
    } else {
      trace.push(`  无闪可出(${s2.handNames.join('/')})，点承受伤害`);
      const btn = page.locator('button:has-text("承受伤害")');
      if (await btn.count()) await btn.click();
    }
    await page.waitForTimeout(1200);
    continue;
  }
  if (h.includes('濒死')) {
    const btn = page.locator('button:has-text("放弃")');
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(1500);
    continue;
  }
  if (h.includes('参悟')) {
    await page.locator('button:has-text("跳过")').click();
    await page.waitForTimeout(400);
    continue;
  }
  if (h.includes('请选择')) {
    const btns = await page.locator('#actionBtns button').count();
    if (btns > 0) {
      await page.locator('#actionBtns button').first().click();
      await page.waitForTimeout(600);
    }
    continue;
  }
  // AI 回合，等待
  await page.waitForTimeout(500);
}

const final = await state();
await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'repro-final.png') });
await browser.close();
server.kill();

console.log('===== 交互轨迹 =====');
trace.forEach((t) => console.log(t));
console.log('===== 结束状态 =====');
console.log(JSON.stringify(final, null, 2));
console.log('===== JS 错误 =====');
console.log(pageErrors.length ? pageErrors.join('\n') : '(无)');
