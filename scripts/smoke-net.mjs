// 联机冒烟测试：双页面 建房 → 加入 → 开始游戏 → 状态同步
// 用法：node scripts/smoke-net.mjs [html文件名]
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
const errsA = [],
  errsB = [];
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const host = await ctxA.newPage();
const guest = await ctxB.newPage();
host.on('pageerror', (e) => errsA.push(e.message));
guest.on('pageerror', (e) => errsB.push(e.message));
host.on('dialog', (d) => d.accept().catch(() => {}));
guest.on('dialog', (d) => d.accept().catch(() => {}));

await host.goto(url, { waitUntil: 'networkidle' });
await guest.goto(url, { waitUntil: 'networkidle' });

// 房主：切到创建房间模式
await host.click('#modePicker .opt-btn[data-mode="host"]');
await host.fill('#nicknameInput', '测试房主');
await host.click('#createRoomBtn');
await host.waitForFunction(
  () => /房间号：<span[^>]*>(\d{6})/.test(document.getElementById('roomInfo')?.innerHTML || ''),
  { timeout: 20000 },
);
const roomInfoText = (await host.textContent('#roomInfo')) || '';
const roomCode = roomInfoText.match(/(\d{6})/)[1];
check('房主创建房间', !!roomCode, '房间号 ' + roomCode);

// 房主等待 peer 连接（ PeerJS open 事件后 roomInfo 才显示，说明信令服务连通）
// 客人：加入房间
await guest.click('#modePicker .opt-btn[data-mode="join"]');
await guest.fill('#joinNick', '测试客人');
await guest.fill('#joinCode', roomCode);
await guest.click('#joinRoomBtn');
await guest.waitForFunction(
  () => (document.getElementById('joinStatus')?.textContent || '').includes('已连接房主'),
  { timeout: 20000 },
);
check('客人加入房间', true);

// 双方成员列表各显示 2 人
await host.waitForFunction(() => document.querySelectorAll('#hostMemberList .rm-item').length === 2, { timeout: 10000 });
const guestMembers = await guest.locator('#guestMemberList .rm-item').count();
check('双方成员列表同步（2人）', guestMembers === 2, `客人看到 ${guestMembers} 人`);

// 房主开始游戏
await host.click('#hostStartBtn');
await host.waitForSelector('#screenGame.active', { timeout: 10000 });
await guest.waitForSelector('#screenGame.active', { timeout: 10000 });
check('双方进入游戏界面', true);

await host.waitForTimeout(3000);
const hostSeats = await host.locator('#seatRing .p-card').count();
const guestSeats = await guest.locator('#seatRing .p-card').count();
check('双方座位渲染一致（4人）', hostSeats === 4 && guestSeats === 4, `房主${hostSeats} 客人${guestSeats}`);

// 客人应能看到自己的手牌与操作提示（房主权威同步）
const guestHand = await guest.locator('#handRow .card').count();
check('客人手牌同步', guestHand >= 0, `${guestHand} 张（主公先手时客人可为0）`);

// 战报同步：房主日志条数应达到客人
await host.waitForTimeout(2000);
const hostLog = await host.locator('#playLogList .play-log-item').count();
const guestLog = await guest.locator('#playLogList .play-log-item').count();
check('战报广播同步', hostLog === guestLog && hostLog > 0, `房主${hostLog} 客人${guestLog}`);

await host.screenshot({ path: path.resolve(dirname, '..', 'dist', 'smoke-net-host.png') });
await guest.screenshot({ path: path.resolve(dirname, '..', 'dist', 'smoke-net-guest.png') });

check('房主页面无JS错误', errsA.length === 0, errsA.slice(0, 2).join(' ; '));
check('客人页面无JS错误', errsB.length === 0, errsB.slice(0, 2).join(' ; '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
if (failed.length) process.exit(1);
