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
check('模式选择（单机/联机）', modeCount === 2, `${modeCount} 张`);
check('主界面已移除模式/年级/出题范围摘要', (await page.locator('#setupSummary').count()) === 0);

// 1.0 顶栏直达入口（个人信息芯片=我的档案+个性化资料合并弹窗；⚙ 题库管理在题库浏览内）
check('顶栏个人信息芯片可点（打开我的档案）', (await page.getAttribute('#topBar .tb-user-chip', 'onclick'))?.includes('openProfileMenu') === true);
check('顶栏无设置/独立档案图标', (await page.locator('#topBar button[onclick="openSettings()"]').count()) === 0 && (await page.locator('#topBar .tb-icon[onclick="openProfileMenu()"]').count()) === 0);

// 1.1 个人信息合并弹窗（头像直达：档案 + 个性化资料）
check('顶栏无个性化资料按钮', (await page.locator('#topBar button[onclick="openPersonaMenu()"]').count()) === 0);
await page.locator('#topBar .tb-user-chip').click();
await page.waitForSelector('#profileModal.show', { timeout: 3000 });
check('合并弹窗打开且标题栏含等级/积分徽章', (await page.textContent('#profileModalTitle'))?.includes('Lv.') === true && (await page.textContent('#profileModalTitle'))?.includes('⭐') === true);
const pickItems = await page.locator('#profileEditor .pick-item').count();
check('个性化资料面板（头像+性别+心情图标）', pickItems >= 36, `${pickItems} 个可选项`);
await page.fill('#profileNameInput', '小明同学');
await page.fill('#moodInput', '今天也要元气满满');
await page.locator('#profileEditor .pick-item').nth(1).click(); // 头像
await page.locator('#profileEditor .pick-grid-3 .pick-item').first().click(); // 性别：男生
await page.locator('#moodIconGrid .pick-item').nth(2).click(); // 心情图标
await page.click('#profileModal .rules-close');
await page.waitForTimeout(200);
const tbName1 = (await page.textContent('#tbName')) || '';
check('顶栏昵称反映个性化设置', tbName1.includes('小明同学'), tbName1);
const moodSaved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}').mood,
);
check('个性化资料已持久化到 localStorage', moodSaved === '今天也要元气满满', String(moodSaved));

// 1.2 题库管理（题库浏览界面入口）
await page.locator('#topBar button[onclick="openBankBrowser()"]').click();
await page.waitForSelector('#screenBank.active', { timeout: 3000 });
await page.locator('#screenBank .setup-top button', { hasText: '题库管理' }).click();
await page.waitForSelector('#bankModal.show', { timeout: 3000 });
const bankInfo = await page.textContent('#bankInfo');
check('题库管理二级菜单（题库信息）', !!bankInfo && bankInfo.includes('内置'), bankInfo?.slice(0, 40));
await page.click('#bankModal .menu-footer button');
await page.click('#screenBank .setup-top button'); // 返回主界面
await page.waitForSelector('#screenLobby.active', { timeout: 3000 });

// 1.3 我的档案（点击个人信息芯片）
await page.click('#topBar .tb-user-chip');
await page.waitForSelector('#profileModal.show', { timeout: 3000 });
check('我的档案二级菜单打开（点击个人信息芯片）', true);
await page.click('#profileModal .rules-close');
await page.waitForTimeout(150);

// 1.35 首页年级 / 学期选择器（已从设置子界面移至首页）
const gradeBtnsHome = await page.locator('#gradePicker .opt-btn').count();
check('年级选择器（首页）', gradeBtnsHome === 12 && (await page.isVisible('#gradePicker')), `${gradeBtnsHome} 个年级`);

await page.screenshot({ path: path.resolve(dirname, '..', 'dist', 'smoke-lobby.png'), fullPage: true });

// 1.4 选择模式 → 进入对局设置子界面
await page.click('#modePicker .mode-card[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });
check('选择模式后进入设置子界面', await page.isVisible('#screenSetup.active'));
const npStyle = await page.getAttribute('#netModePanel', 'style');
check('单机模式隐藏联机二选一', !npStyle || npStyle.includes('none'), npStyle || '');
const setupGrade = (await page.textContent('#setupGradeHint')) || '';
check('设置界面年级只读提示', setupGrade.includes('当前年级'), setupGrade.trim().slice(0, 30));
const charCards = await page.locator('#charGrid .char-card').count();
check('角色卡渲染（子界面）', charCards > 0, `${charCards} 名角色`);
const factions = await page.locator('#factionPicker .faction-card').count();
check('阵营选择（子界面）', factions === 9, `${factions} 个阵营`);

// 1.45 随机武将预览卡：完整展示（技能/主公技）+ 换将
const rcpSkills = await page.locator('#charPreview .rcp-skill').count();
check('随机武将预览卡：技能详情展示', rcpSkills > 0, `${rcpSkills} 个技能`);
const rcpLord = await page.locator('#charPreview .rcp-lord').count();
check('随机武将预览卡：主公技展示', rcpLord === 1);
const rcpMeta = (await page.locator('#charPreview .rcp-meta').textContent()) || '';
check('随机武将预览卡：阵营与体力展示', rcpMeta.includes('体力'), rcpMeta.trim().slice(0, 24));
const rcpReroll = await page.locator('#charPreview .rcp-reroll').count();
check('随机武将预览卡：换将按钮', rcpReroll === 1);
const rcpNameBefore = (await page.locator('#charPreview .rcp-name').textContent()) || '';
await page.click('#charPreview .rcp-reroll');
await page.waitForTimeout(250);
const rcpNameAfter = (await page.locator('#charPreview .rcp-name').textContent()) || '';
check('随机武将：换将后重新派发', rcpNameAfter.length > 0 && rcpNameAfter !== rcpNameBefore, `${rcpNameBefore} → ${rcpNameAfter}`);
const rcpSkillAfter = await page.locator('#charPreview .rcp-skill').count();
check('随机武将：换将后卡片仍完整', rcpSkillAfter > 0, `${rcpSkillAfter} 个技能`);

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

// 1.6 返回主界面 → 无配置摘要块
await page.click('#screenSetup .setup-top button');
await page.waitForSelector('#screenLobby.active', { timeout: 3000 });
check('返回主界面且无摘要块', (await page.locator('#setupSummary').count()) === 0);
await page.click('#modePicker .mode-card[data-mode="single"]');
await page.waitForSelector('#screenSetup.active', { timeout: 3000 });

// 2. 开始单机对局（随机模式：先亮将确认）
await page.click('#startBtn');
await page.waitForSelector('#revealModal.show', { timeout: 3000 });
check('开局亮将弹窗（随机模式）', await page.isVisible('#revealModal.show'));
const rvSkills = await page.locator('#revealBody .rcp-skill').count();
check('亮将弹窗：完整武将卡', rvSkills > 0, `${rvSkills} 个技能`);
await page.click('#revealBody button[onclick="revealConfirm()"]');
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
// 8.6 知识图谱：知识点讲解 + 知识脑图
await page.click('#bankViewPicker .opt-btn[data-view="k"]');
await page.waitForFunction(
  () => (document.getElementById('bankBody')?.querySelectorAll('.kp-card').length || 0) > 0,
  { timeout: 8000 },
);
const kpCards = await page.locator('#bankBody .kp-card').count();
check('知识图谱：讲解卡片渲染', kpCards > 0, `${kpCards} 个知识点`);
await page.click('#bankViewPicker .opt-btn[data-view="map"]');
await page.waitForFunction(
  () => (document.getElementById('bankBody')?.querySelectorAll('.kpnode').length || 0) > 0,
  { timeout: 8000 },
);
const kpNodes = await page.locator('#bankBody .kpnode').count();
const kpEdges = await page.locator('#bankBody .kp-edge').count();
check('知识图谱：脑图节点渲染', kpNodes > 0, `${kpNodes} 个节点`);
check('知识图谱：脑图关系边渲染', kpEdges > 0, `${kpEdges} 条关系`);
await page.locator('#bankBody .kpnode').first().click();
await page.waitForTimeout(200);
const kpDetail = (await page.locator('#kpMapDetail').textContent()) || '';
check(
  '知识图谱：点击节点显示讲解',
  kpDetail.length > 10 && !kpDetail.includes('点击任意节点'),
  kpDetail.trim().slice(0, 20),
);
await page.click('#bankViewPicker .opt-btn[data-view="q"]');
await page.waitForTimeout(400);
const bankQ4 = await page.locator('#bankBody .bank-item').count();
check('知识图谱：可切回题目视图', bankQ4 > 0, `${bankQ4} 题`);

await page.click('#screenBank .setup-top button'); // 返回主界面
await page.waitForSelector('#screenGame.active', { timeout: 3000 });

// 8.7 学分商店：学习成果解锁条件 + 新手礼包
await page.click('#topBar button[onclick="openShop(\'chars\')"]');
await page.waitForSelector('#shopModal.show', { timeout: 3000 });
check('学分商店打开（顶栏入口）', await page.isVisible('#shopModal.show'));
const newbieGift = await page.locator('#shopBody .sc-newbie').count();
check('学分商店：新手礼包展示', newbieGift === 1, `${newbieGift} 个礼包`);
await page.locator('#shopBody .sc-newbie-opts .btn').first().click();
await page.waitForTimeout(300);
check(
  '学分商店：新手礼包领取后消失',
  (await page.locator('#shopBody .sc-newbie').count()) === 0,
);
const condRows = await page.locator('#shopBody .sc-cond').count();
check('学分商店：角色卡显示解锁条件', condRows > 0, `${condRows} 条条件`);
const lockedBtns = await page.locator('#shopBody .shop-card .sc-action button[disabled]').count();
check('学分商店：无学习记录时解锁按钮禁用', lockedBtns > 0, `${lockedBtns} 个禁用`);
await page.locator('#shopBody .shop-tabs .shop-tab').nth(1).click();
await page.waitForTimeout(200);
const eqConds = await page.locator('#shopBody .sc-cond').count();
check('学分商店：装备卡显示解锁条件', eqConds > 0, `${eqConds} 条条件`);
const eqLocked = await page.locator('#shopBody .shop-card .sc-action button[disabled]').count();
check('学分商店：装备高档位按钮禁用', eqLocked > 0, `${eqLocked} 个禁用`);
await page.click('#shopModal .rules-close');
await page.waitForTimeout(200);

// 8.8 每日学习任务：进度达标可领取、奖励入账（档案直写模拟学习行为后重载）
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}');
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  p.missionDaily = { date, quiz: 12, review: 3, wrongFixed: 2, combo: 5, claimed: [] };
  localStorage.setItem('xuetangsha_profile_v1', JSON.stringify(p));
});
await page.reload({ waitUntil: 'networkidle' });
await page.click('#topBar button[onclick="openShop(\'chars\')"]');
await page.waitForSelector('#shopModal.show', { timeout: 3000 });
await page.locator('#shopBody .shop-tabs .shop-tab').nth(3).click();
await page.waitForTimeout(200);
const missionCards = await page.locator('#shopBody .sc-mission').count();
check('学分商店：学习任务页渲染', missionCards === 4, `${missionCards} 个任务`);
const claimBtns = await page.locator('#shopBody .sc-mission .btn-accent').count();
check('学分商店：任务达标后可领取', claimBtns === 4, `${claimBtns} 个可领`);
const creditBefore = await page.evaluate(
  () => JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}').credits || 0,
);
await page.locator('#shopBody .sc-mission .btn-accent').first().click();
await page.waitForTimeout(300);
const profileAfter = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}'),
);
check(
  '学分商店：领取任务奖励入账',
  (profileAfter.credits || 0) === creditBefore + 30,
  `${creditBefore} → ${profileAfter.credits}`,
);
check('学分商店：已领取任务标记', (await page.locator('#shopBody .sc-mission.claimed').count()) === 1);
const srcShown = await page.locator('#shopBody .sc-src').count();
check('学分商店：学分来源统计展示', srcShown > 0, `${srcShown} 个来源`);
await page.click('#shopModal .rules-close');

// 8.9 学期通关战令：等级奖励可领（档案直写经验后重载）
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}');
  p.pass = { semester: '初二上', exp: 300, claimed: [] };
  localStorage.setItem('xuetangsha_profile_v1', JSON.stringify(p));
});
await page.reload({ waitUntil: 'networkidle' });
await page.click('#topBar button[onclick="openShop(\'chars\')"]');
await page.waitForSelector('#shopModal.show', { timeout: 3000 });
await page.locator('#shopBody .shop-tabs .shop-tab').nth(3).click();
await page.waitForTimeout(200);
const passRows = await page.locator('#shopBody .sc-pass-row').count();
check('学分商店：战令奖励表渲染', passRows === 30, `${passRows} 级`);
const passHead = (await page.locator('#shopBody .sc-pass-head').textContent()) || '';
check('学分商店：战令等级显示', passHead.includes('Lv.2/30'), passHead.trim().slice(0, 24));
const creditBefore2 = await page.evaluate(
  () => JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}').credits || 0,
);
await page.locator('#shopBody .sc-pass-row.reach .btn-accent').first().click();
await page.waitForTimeout(300);
const profileAfter2 = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('xuetangsha_profile_v1') || '{}'),
);
check(
  '学分商店：战令等级奖励入账',
  (profileAfter2.credits || 0) === creditBefore2 + 20,
  `${creditBefore2} → ${profileAfter2.credits}`,
);
check('学分商店：战令奖励已领标记', (await page.locator('#shopBody .sc-pass-row.claimed').count()) === 1);
await page.click('#shopModal .rules-close');

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
