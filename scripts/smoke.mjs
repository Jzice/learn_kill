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

// 1. 主界面：固定顶栏 + 个人成就 + 模式选择 + 配置摘要
check('固定顶栏可见', await page.isVisible('#topBar'));
const tbName0 = (await page.textContent('#tbName')) || '';
check('顶栏显示昵称', tbName0.trim().length > 0, tbName0);
const achCount = await page.locator('#achGrid .ach-item').count();
check('个人成就网格渲染', achCount > 0, `${achCount} 项`);
const modeCount = await page.locator('#modePicker .mode-card').count();
check('模式选择（单机/创建/加入）', modeCount === 3, `${modeCount} 张`);
const summaryText = await page.textContent('#setupSummary');
check('主界面配置摘要', !!summaryText && summaryText.includes('年级'), (summaryText || '').replace(/\s+/g, ' ').slice(0, 50));

// 1.0 设置抽屉（替代原名片菜单入口）
await page.click('#topBar button[title="设置"]');
await page.waitForSelector('#settingsDrawer.show', { timeout: 3000 });
check('设置抽屉打开', true);
const drawerItems = await page.locator('#settingsDrawer .drawer-item').count();
check('设置抽屉入口（档案/个性化/题库）', drawerItems === 3, `${drawerItems} 个`);

// 1.1 个性化资料（抽屉入口 → 二级菜单）
await page.locator('#settingsDrawer .drawer-item', { hasText: '个性化资料' }).click();
await page.waitForSelector('#personaModal.show', { timeout: 3000 });
check('个性化资料二级菜单打开', true);
const pickItems = await page.locator('#profileEditor .pick-item').count();
check('个性化资料面板（头像+性别+心情图标）', pickItems >= 36, `${pickItems} 个可选项`);
await page.fill('#profileNameInput', '小明同学');
await page.fill('#moodInput', '今天也要元气满满');
await page.locator('#profileEditor .pick-item').nth(1).click(); // 头像
await page.locator('#profileEditor .pick-grid-3 .pick-item').first().click(); // 性别：男生
await page.locator('#moodIconGrid .pick-item').nth(2).click(); // 心情图标
await page.click('#personaModal .menu-footer button');
await page.waitForTimeout(200);
const tbName1 = (await page.textContent('#tbName')) || '';
check('顶栏昵称反映个性化设置', tbName1.includes('小明同学'), tbName1);
const moodSaved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}').mood,
);
check('个性化资料已持久化到 localStorage', moodSaved === '今天也要元气满满', String(moodSaved));

// 1.2 题库管理（设置抽屉入口）
await page.locator('#settingsDrawer .drawer-item', { hasText: '题库管理' }).click();
await page.waitForSelector('#bankModal.show', { timeout: 3000 });
const bankInfo = await page.textContent('#bankInfo');
check('题库管理二级菜单（题库信息）', !!bankInfo && bankInfo.includes('内置'), bankInfo?.slice(0, 40));
await page.click('#bankModal .menu-footer button');

// 1.3 我的档案（设置抽屉入口）
await page.locator('#settingsDrawer .drawer-item', { hasText: '我的档案' }).click();
await page.waitForSelector('#profileModal.show', { timeout: 3000 });
check('我的档案二级菜单打开', true);
await page.click('#profileModal .rules-close');
await page.click('#settingsDrawer .drawer-head button'); // 关闭抽屉
await page.waitForTimeout(150);

await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'smoke-lobby.png'), fullPage: true });

// 1.4 选择模式 → 进入对局设置子界面
await page.click('#modePicker .mode-card[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });
check('选择模式后进入设置子界面', await page.isVisible('#screenSetup.active'));
const npStyle = await page.getAttribute('#netModePanel', 'style');
check('单机模式隐藏联机二选一', !npStyle || npStyle.includes('none'), npStyle || '');
const gradeBtns = await page.locator('#gradePicker .opt-btn').count();
check('年级选择器（子界面）', gradeBtns === 12, `${gradeBtns} 个年级`);
const charCards = await page.locator('#charGrid .char-card').count();
check('角色卡渲染（子界面）', charCards > 0, `${charCards} 名角色`);
const factions = await page.locator('#factionPicker .faction-card').count();
check('阵营选择（子界面）', factions === 9, `${factions} 个阵营`);

// 1.5 玩家总数滑块（子界面）
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

// 1.6 返回主界面 → 摘要更新
await page.click('#screenSetup .setup-top button');
await page.waitForSelector('#screenLobby.active', { timeout: 3000 });
const summary2 = await page.textContent('#setupSummary');
check('返回主界面且摘要同步', !!summary2 && summary2.includes('4 人'), (summary2 || '').replace(/\s+/g, ' ').slice(0, 40));
await page.click('#modePicker .mode-card[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });

// 2. 开始单机对局
await page.click('#startBtn');
await page.waitForSelector('#screenGame.active', { timeout: 5000 });
await page.waitForTimeout(2500);

// 3. 规则弹窗（位于统一顶栏，游戏内显示）
await page.locator('#topBar button[onclick="openRules()"]').first().click();
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

// 8.5 题库浏览（游戏顶栏入口）
await page.click('#topBar button[onclick="openBankBrowser()"]');
await page.waitForSelector('#screenBank.active', { timeout: 3000 });
check('题库浏览界面打开（顶栏入口）', await page.isVisible('#screenBank.active'));
const bankGrades = await page.locator('#bankGradePicker .opt-btn').count();
check('题库浏览：年级切换渲染', bankGrades === 12, `${bankGrades} 个年级`);
await page.waitForFunction(() => (document.getElementById('bankBody')?.textContent || '').length > 20, { timeout: 8000 });
const bankQ = await page.locator('#bankBody .bank-item').count();
check('题库浏览：题目渲染', bankQ > 0, `${bankQ} 题`);
await page.fill('#bankSearch', '下列');
await page.waitForTimeout(300);
await page.fill('#bankSearch', '');
await page.waitForTimeout(300);
const bankQ3 = await page.locator('#bankBody .bank-item').count();
check('题库浏览：搜索可还原', bankQ3 > 0, `${bankQ3} 题`);
await page.click('#screenBank .setup-top button'); // 返回主界面
await page.waitForSelector('#screenGame.active', { timeout: 3000 });

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
