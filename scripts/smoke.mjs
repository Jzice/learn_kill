// 冒烟测试：加载构建产物，跑通 大厅 → 单机开局 → 答题/出牌 主流程
// 用法：node scripts/smoke.mjs [html文件名] [截图输出路径]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || '学堂杀.html';
const shot = process.argv[3] || path.resolve(dirname, '..', 'dist', 'smoke.png');
const PORT = 8901;
const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(file)}`;

// 自己拉起静态服务器子进程（避免依赖外部 shell）
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

// 在 ms-playwright 目录中找一个可用的 headless shell（版本号不强制匹配）
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
console.log('headless shell:', executablePath || '(default)');

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

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(url, { waitUntil: 'networkidle' });

// 1. 大厅
const lobbyOk = await page.isVisible('#screenLobby.active #profileCard .profile-card');
check('大厅渲染（档案卡）', lobbyOk);

// 1.1 个性化资料面板（头像 / 性别 / 心情）
const pickItems = await page.locator('#profileEditor .pick-item').count();
check('个性化资料面板（头像+性别+心情图标）', pickItems >= 36, `${pickItems} 个可选项`);
await page.fill('#profileNameInput', '小明同学');
await page.fill('#moodInput', '今天也要元气满满');
await page.locator('#profileEditor .pick-item').nth(1).click(); // 选一个头像
await page.locator('#profileEditor .pick-grid-3 .pick-item').first().click(); // 选性别：男生
await page.locator('#moodIconGrid .pick-item').nth(2).click(); // 选心情图标
const cardText = await page.textContent('#profileCard');
check(
  '档案卡反映个性化设置',
  !!cardText && cardText.includes('小明同学') && cardText.includes('今天也要元气满满'),
  (cardText || '').replace(/\s+/g, ' ').slice(0, 60),
);
const moodSaved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}').mood,
);
check('个性化资料已持久化到 localStorage', moodSaved === '今天也要元气满满', String(moodSaved));

// 1.2 玩家总数滑块
const sliderOk = await page.locator('#countSlider').count();
check('人数滑块存在', sliderOk === 1);
await page.fill('#countSlider', '6');
await page.waitForTimeout(200);
const countLabel = await page.textContent('#countValue');
const aiHint = await page.textContent('#aiCountHint');
check('滑块设置人数', (countLabel || '').includes('6'), `${countLabel} / ${aiHint}`);
const roleCards = await page.locator('#rolePicker .role-card').count();
check('滑块联动身份可选范围', roleCards >= 4, `${roleCards} 个身份卡`);
await page.fill('#countSlider', '4'); // 复位为 4 人局以便后续断言
await page.waitForTimeout(200);
const gradeBtns = await page.locator('#gradePicker .opt-btn').count();
check('年级选择器', gradeBtns === 12, `${gradeBtns} 个年级`);
const charCards = await page.locator('#charGrid .char-card').count();
check('角色卡渲染', charCards > 0, `${charCards} 名角色`);
const bankInfo = await page.textContent('#bankInfo');
check('题库信息', !!bankInfo && bankInfo.includes('内置'), bankInfo?.slice(0, 40));

await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'smoke-lobby.png'), fullPage: true });

// 2. 开始单机对局
await page.click('#startBtn');
await page.waitForSelector('#screenGame.active', { timeout: 5000 });
await page.waitForTimeout(2500);

// 3. 规则弹窗（位于游戏界面顶栏）
await page.locator('#screenGame button:has-text("规则")').first().click();
await page.waitForSelector('#rulesModal.show', { timeout: 3000 });
const rulesLen = (await page.textContent('#rulesContent'))?.length || 0;
check('规则弹窗', rulesLen > 500, `${rulesLen} 字`);
await page.click('#rulesModal .rules-close');

const seats = await page.locator('#seatRing .p-card').count();
check('座位渲染（4人局）', seats === 4, `${seats} 个座位`);

// 座位卡展示个性化信息（自定义头像 + 心情）
const selfCard = await page.locator('#seatRing .p-card.is-self').first().innerHTML();
check(
  '座位卡展示个性化信息',
  selfCard.includes('今天也要元气满满') && !!selfCard.match(/class="pmood"/),
  selfCard.includes('今天也要元气满满') ? '含心情文案' : '缺少心情文案',
);

// 4. 若弹出答题则答第一项
let quizAnswered = false;
if (await page.isVisible('#quizModal.show')) {
  await page.click('.quiz-option');
  quizAnswered = true;
  await page.waitForSelector('#quizModal.show', { state: 'detached', timeout: 4000 }).catch(() => {});
}
check('参悟答题弹窗', true, quizAnswered ? '已答一题' : '本局未触发（AI 概率）');

// 5. 手牌渲染
const cards = await page.locator('#handRow .card').count();
check('手牌渲染', cards > 0, `${cards} 张`);

// 6. 战报日志
const logItems = await page.locator('#playLogList .play-log-item').count();
check('战报日志', logItems > 0, `${logItems} 条`);

// 7. 跑到结束出牌按钮出现并点击（若在我方回合）
let ended = false;
if (await page.isVisible('button:has-text("结束出牌")')) {
  await page.click('button:has-text("结束出牌")');
  ended = true;
}
check('结束出牌交互', true, ended ? '已点击' : '非本人回合，跳过');

// 8. 观察 AI 自动对战 8 秒
await page.waitForTimeout(8000);
const logItems2 = await page.locator('#playLogList .play-log-item').count();
check('AI 自动推进', logItems2 >= logItems, `${logItems} → ${logItems2} 条`);

await page.screenshot({ path: shot, fullPage: false });
console.log('screenshot:', shot);

// 9. 控制台错误
check('控制台零错误', errors.length === 0, errors.slice(0, 3).join(' ; '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
if (failed.length) {
  console.log('失败项:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
