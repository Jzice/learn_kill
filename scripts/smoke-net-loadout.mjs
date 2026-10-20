// 联机配装同步冒烟：房主/客人各自携带局前配装 → 房主开局时注入双方装备与道具
// 并校验这些配装通过 start_game / state_sync 同步到双方座位与道具栏。
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const PORT = 8919;
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
const results = [];
function check(n, ok, x = '') { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`); }
if (!(await waitServer())) { console.error('❌ 服务器未启动'); server.kill(); process.exit(1); }
const exe = findHeadlessShell();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

// 房主：武器=木剑(eq_wpn_1) + 道具温故符；客人：防具=布甲(eq_arm_1) + 道具护身符
const hostProfile = {
  name: '房主甲', gender: 'female', mood: '房主心情：稳住',
  credits: 9999, unlockedEquips: ['eq_wpn_1', 'eq_arm_1'],
  loadout: { weapon: 'eq_wpn_1', armor: null, horsePlus: null, horseMinus: null, items: { it_reset: 1 } },
};
const guestProfile = {
  name: '客人乙', gender: 'male', mood: '客人心情：冲呀',
  credits: 9999, unlockedEquips: ['eq_wpn_1', 'eq_arm_1'],
  loadout: { weapon: null, armor: 'eq_arm_1', horsePlus: null, horseMinus: null, items: { it_shield: 1 } },
};
const seed = (p) => localStorage.setItem('xuetangsha_profile_v1', JSON.stringify(p));
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctxA.addInitScript(seed, hostProfile);
await ctxB.addInitScript(seed, guestProfile);
const host = await ctxA.newPage();
const guest = await ctxB.newPage();
const errsA = [], errsB = [];
host.on('pageerror', (e) => errsA.push(e.message));
guest.on('pageerror', (e) => errsB.push(e.message));
host.on('dialog', (d) => d.accept().catch(() => {}));
guest.on('dialog', (d) => d.accept().catch(() => {}));
await host.goto(url, { waitUntil: 'networkidle' });
await guest.goto(url, { waitUntil: 'networkidle' });

// 房主建房
await host.click('#modePicker .mode-card[data-mode="net"]');
await host.click('#createRoomBtn');
await host.waitForFunction(() => /(\d{6})/.test(document.getElementById('roomInfo')?.innerHTML || ''), { timeout: 20000 });
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
await guest.waitForFunction(() => (document.getElementById('joinStatus')?.textContent || '').includes('已连接房主'), { timeout: 20000 });
check('客人加入房间', true);
await host.waitForFunction(() => document.querySelectorAll('#hostMemberList .rm-item').length === 2, { timeout: 10000 });
check('双方成员列表同步（2人）', (await guest.locator('#guestMemberList .rm-item').count()) === 2);

// 房主开局
await host.click('#hostStartBtn');
await host.waitForSelector('#screenGame.active', { timeout: 10000 });
await guest.waitForSelector('#screenGame.active', { timeout: 10000 });
check('双方进入游戏界面', true);
await host.waitForTimeout(1500);

// 房主侧：自身武器（木剑）+ 远程客人防具（布甲，由房主依 guest_pref 注入）
const hostRing = (await host.locator('#seatRing').textContent()) || '';
check('房主侧·自身武器已注入（木剑）', hostRing.includes('木剑'));
check('房主侧·远程客人防具已注入（布甲）', hostRing.includes('布甲'));
const hostItem = (await host.locator('#itemBar').textContent()) || '';
check('房主侧·自身道具栏（温故符）', hostItem.includes('温故符'), hostItem.slice(0, 30));

// 客人侧：房主武器（木剑）与自身防具（布甲）均经 start_game 同步
const guestRing = (await guest.locator('#seatRing').textContent()) || '';
check('客人侧·房主武器已同步（木剑）', guestRing.includes('木剑'));
check('客人侧·自身防具已同步（布甲）', guestRing.includes('布甲'));
const guestItem = (await guest.locator('#itemBar').textContent()) || '';
check('客人侧·自身道具栏（护身符）', guestItem.includes('护身符'), guestItem.slice(0, 30));

check('房主页面无JS错误', errsA.length === 0, errsA.slice(0, 2).join(' ; '));
check('客人页面无JS错误', errsB.length === 0, errsB.slice(0, 2).join(' ; '));

await browser.close();
server.kill();
const pass = results.filter(Boolean).length;
console.log(`\n===== ${pass}/${results.length} 通过 =====`);
process.exit(pass === results.length ? 0 : 1);
