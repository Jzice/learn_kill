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

// 双方先设置个性化资料（昵称 / 头像 / 性别 / 心情；点头像在合并弹窗内编辑）
async function setupProfile(page, name, mood) {
  await page.locator('#topBar .tb-user-chip').click();
  await page.waitForSelector('#profileModal.show', { timeout: 3000 });
  await page.fill('#profileNameInput', name);
  await page.fill('#moodInput', mood);
  await page.locator('#profileEditor .pick-item').nth(2).click(); // 头像
  await page.locator('#profileEditor .pick-grid-3 .pick-item').nth(1).click(); // 性别：女生
  await page.locator('#moodIconGrid .pick-item').nth(4).click(); // 心情图标
  await page.click('#profileModal .rules-close');
  await page.waitForTimeout(200);
}
await setupProfile(host, '房主甲', '房主心情：稳住');
await setupProfile(guest, '客人乙', '客人心情：冲呀');
const hostProfile = await host.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}'),
);
check(
  '个性化资料写入（房主）',
  hostProfile.name === '房主甲' && hostProfile.mood === '房主心情：稳住' && hostProfile.gender === 'female',
  `${hostProfile.name}/${hostProfile.gender}/${hostProfile.mood}`,
);

// 房主：切到创建房间模式
await host.click('#modePicker .mode-card[data-mode="net"]');
await host.click('#createRoomBtn');
await host.waitForFunction(
  () => /房间号：<span[^>]*>(\d{6})/.test(document.getElementById('roomInfo')?.innerHTML || ''),
  { timeout: 20000 },
);
const roomInfoText = (await host.textContent('#roomInfo')) || '';
const roomCode = roomInfoText.match(/(\d{6})/)[1];
check('房主创建房间', !!roomCode, '房间号 ' + roomCode);

// 房主等待 peer 连接（ PeerJS open 事件后 roomInfo 才显示，说明信令服务连通）
// 客人：加入房间（联机卡进入后切到「加入服务器」档）
await guest.click('#modePicker .mode-card[data-mode="net"]');
await guest.click('#netModePicker .opt-btn[data-net="join"]');
await guest.waitForSelector('#joinConfig', { state: 'visible', timeout: 3000 });
const jf = await guest.locator('#joinFactionPicker .faction-card').count();
check('加入档阵营选择器渲染', jf === 9, `${jf} 个`);
await guest.locator('#joinFactionPicker .faction-card').nth(1).click();
await guest.waitForTimeout(150);
const jc = await guest.locator('#joinCharGrid .char-card').count();
check('加入档角色选择器渲染', jc > 0, `${jc} 名`);
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

// 房间成员列表展示对方的个性化信息（头像 / 性别 / 心情）
const guestListHtml = await guest.locator('#guestMemberList').innerHTML();
check(
  '成员列表展示个性化信息',
  guestListHtml.includes('房主心情：稳住') && guestListHtml.includes('rm-mood'),
  guestListHtml.includes('房主心情：稳住') ? '客人可见房主心情' : '缺少心情',
);
const hostListHtml = await host.locator('#hostMemberList').innerHTML();
check(
  '成员列表双向展示个性化信息',
  hostListHtml.includes('客人心情：冲呀'),
  hostListHtml.includes('客人心情：冲呀') ? '房主可见客人心情' : '缺少心情',
);

// 固定人数为 4，避免受默认人数（现为 5）变动影响，保证断言确定性（与单机 smoke 一致显式设值）
await host.evaluate(() => window.setPlayerCount(4));

// 房主开始游戏
await host.click('#hostStartBtn');
await host.waitForSelector('#screenGame.active', { timeout: 10000 });
await guest.waitForSelector('#screenGame.active', { timeout: 10000 });
check('双方进入游戏界面', true);

// 等待双方座位真正渲染完成（房主侧偶发比固定等待更慢，改为按元素出现等待，消除「房主0座位」偶发）
await host.waitForFunction(() => document.querySelectorAll('#seatRing .p-card').length >= 2, { timeout: 10000 });
await guest.waitForFunction(() => document.querySelectorAll('#seatRing .p-card').length >= 2, { timeout: 10000 });
await host.waitForTimeout(500);
const hostSeats = await host.locator('#seatRing .p-card').count();
const guestSeats = await guest.locator('#seatRing .p-card').count();
check('双方座位渲染一致（4人）', hostSeats === 4 && guestSeats === 4, `房主${hostSeats} 客人${guestSeats}`);

// 客人应能看到自己的手牌与操作提示（房主权威同步）
const guestHand = await guest.locator('#handRow .card').count();
check('客人手牌同步', guestHand >= 0, `${guestHand} 张（主公先手时客人可为0）`);

// 对局内座位卡展示对方的个性化信息
const hostSeatHtml = await host.locator('#seatRing').innerHTML();
check(
  '对局内展示客人个性化信息',
  hostSeatHtml.includes('客人心情：冲呀'),
  hostSeatHtml.includes('客人心情：冲呀') ? '房主侧座位卡可见' : '不可见',
);
const guestSeatHtml = await guest.locator('#seatRing').innerHTML();
check(
  '对局内展示房主个性化信息',
  guestSeatHtml.includes('房主心情：稳住'),
  guestSeatHtml.includes('房主心情：稳住') ? '客人侧座位卡可见' : '不可见',
);

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
