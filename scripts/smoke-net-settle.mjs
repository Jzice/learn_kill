// 联机结算回归测试：房主强制结束对局后，房主与加入方均应弹出显示结局的本局结算界面
// 用法：node scripts/smoke-net-settle.mjs [html文件名]
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
const base = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}`;
const url = `${base}?debug=1`;

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
  const baseDir = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(baseDir)) return undefined;
  const dirs = fs
    .readdirSync(baseDir)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    const exe = path.join(baseDir, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

if (!(await waitServer())) {
  console.error('❌ 静态服务器未能启动');
  server.kill();
  process.exit(1);
}

const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const errsHost = [],
  errsGuest = [];
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctxA.newPage();
const guest = await ctxB.newPage();
host.on('pageerror', (e) => errsHost.push(e.message));
guest.on('pageerror', (e) => errsGuest.push(e.message));
host.on('dialog', (d) => d.accept().catch(() => {}));
guest.on('dialog', (d) => d.accept().catch(() => {}));

await host.goto(url, { waitUntil: 'networkidle' });
await guest.goto(url, { waitUntil: 'networkidle' });

// 房主建房
await host.click('#modePicker .mode-card[data-mode="net"]');
await host.click('#createRoomBtn');
await host.waitForFunction(
  () => /房间号：<span[^>]*>(\d{6})/.test(document.getElementById('roomInfo')?.innerHTML || ''),
  { timeout: 20000 },
);
const roomCode = (await host.textContent('#roomInfo')).match(/(\d{6})/)[1];
check('房主创建房间', !!roomCode, '房间号 ' + roomCode);

// 客人加入
await guest.click('#modePicker .mode-card[data-mode="net"]');
await guest.click('#netModePicker .opt-btn[data-net="join"]');
await guest.waitForSelector('#joinConfig', { state: 'visible', timeout: 3000 });
await guest.locator('#joinFactionPicker .faction-card').nth(1).click();
await guest.waitForTimeout(150);
await guest.fill('#joinCode', roomCode);
await guest.click('#joinRoomBtn');
await guest.waitForFunction(
  () => (document.getElementById('joinStatus')?.textContent || '').includes('已连接房主'),
  { timeout: 20000 },
);
check('客人加入房间', true);

// 开始游戏
await host.click('#hostStartBtn');
await host.waitForSelector('#screenGame.active', { timeout: 10000 });
await guest.waitForSelector('#screenGame.active', { timeout: 10000 });
check('双方进入游戏界面', true);
await host.waitForTimeout(1500);

// 房主强制结束对局：构造「主公与忠臣获胜」局面（且轮到加入方行棋，模拟对局在联机者回合结束）
const endRes = await host.evaluate(() => {
  const g = window.__game;
  const G = g.G;
  if (!G || !g.checkWin) return { error: 'no __game/checkWin' };
  G.players.forEach((p) => {
    p.role = 'loyal';
    p.roleRevealed = false;
  });
  G.players[0].role = 'lord';
  G.current = G.myPlayerIdx === 0 ? 1 : 0; // 让轮到另一方，模拟「联机者回合内结束」
  g.checkWin();
  return { gameOver: G.gameOver, winner: G.winnerText };
});
check('房主端对局已结束', !endRes.error && endRes.gameOver === true, endRes.winner || endRes.error || '');

// 等待并断言房主结算面板
await host.waitForSelector('#settleModal.show', { timeout: 5000 }).catch(() => {});
const hostSettle = await host.evaluate(() => {
  const m = document.getElementById('settleModal');
  if (!m || !m.classList.contains('show')) return { shown: false };
  const body = document.getElementById('settleBody')?.textContent || '';
  return { shown: true, text: body };
});
check('房主显示结算界面（含结局）', hostSettle.shown && /获胜|落败/.test(hostSettle.text), hostSettle.shown ? hostSettle.text.slice(0, 40) : '未弹窗');

// 等待并断言加入方结算面板
await guest.waitForSelector('#settleModal.show', { timeout: 6000 }).catch(() => {});
const guestSettle = await guest.evaluate(() => {
  const m = document.getElementById('settleModal');
  if (!m || !m.classList.contains('show')) return { shown: false };
  const body = document.getElementById('settleBody')?.textContent || '';
  return { shown: true, text: body };
});
check(
  '加入方（联机者）也显示结算界面（含结局）',
  guestSettle.shown && /获胜|落败/.test(guestSettle.text),
  guestSettle.shown ? guestSettle.text.slice(0, 40) : '未弹窗',
);

// 加入方结算应能看到本局结局文案（如「主公与忠臣获胜」）
if (guestSettle.shown) {
  check('加入方结算展示本局结局', /主公与忠臣获胜|获胜|落败/.test(guestSettle.text), guestSettle.text.slice(0, 30));
}

check('房主页面无JS错误', errsHost.length === 0, errsHost.slice(0, 2).join(' ; '));
check('客人页面无JS错误', errsGuest.length === 0, errsGuest.slice(0, 2).join(' ; '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
if (failed.length) {
  console.log('失败项:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
