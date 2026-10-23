// 技能系统冒烟：校验技能登记表完整性 + 关键机制流程（观星 / 空城 / 出师表 / 转化技 / 限定技 / 咆哮 / 无双），
// 并跑通一局无头 AI 对战确认无 console error。
// 用法：node scripts/smoke-skills.mjs [html文件名]
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
const executablePath = findHeadlessShell();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', (d) => d.accept().catch(() => {}));

await page.goto(url, { waitUntil: 'networkidle' });

// 1. 登记表自检：81 角色、技能 id 唯一、无缺失定义、诸葛亮三技能
const audit = await page.evaluate(() => window.xtsSkillAudit());
check('81 名角色全部加载', audit.chars === 81, `${audit.chars}`);
check('技能定义数量充足（≥191）', audit.total >= 191, `${audit.total} 个`);
check('所有角色 / 主公技均有定义', audit.missing.length === 0, audit.missing.join(','));
check('技能 id 唯一', audit.duplicates.length === 0, audit.duplicates.join(','));

// 2. 诸葛亮三技能（唯一三技能角色）+ 观星 / 空城 / 出师表齐备
check('诸葛亮为三技能角色（观星 / 空城 / 出师表）',
  audit.zhuge.length === 3 && audit.zhuge.includes('zgl_gx') && audit.zhuge.includes('zgl_kc') && audit.zhuge.includes('zgl_csb'),
  audit.zhuge.join(','));
check('诸葛亮是全表唯一三技能角色', audit.multi.length === 1 && audit.multi[0] === 'zhugeliang', audit.multi.join(','));

// 2.1 高中扩展包 50 将（v2.7.0）
const pool = await page.evaluate(() => window.xtsSeniorPool());
check('高中扩展包角色数为 50', pool.count === 50, `${pool.count} 名`);
const SUBJECTS9 = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
check('九科均有 4~6 名高中角色',
  SUBJECTS9.every((s) => (pool.bySubject[s] || 0) >= 4 && (pool.bySubject[s] || 0) <= 6),
  SUBJECTS9.map((s) => `${s}${pool.bySubject[s] || 0}`).join(' '));
check('高中角色均为 2 技能', pool.chars.every((c) => c.skills.length === 2), '');
const seniorSkills = pool.chars.flatMap((c) => c.skills.map((s) => s.id));
check('高中技能无重复且全部有定义',
  new Set(seniorSkills).size === seniorSkills.length && pool.chars.every((c) => c.skills.every((s) => s.kind !== '')),
  `${seniorSkills.length} 个`);

// 3. 单局无头 AI 对战：从开局跑到 gameOver，无卡死、无 console error
const one = await page.evaluate((seats) => window.xtsAutoRun(1, seats), 5);
check('无头 AI 对战能正常打完一局', one.games === 1 && one.stalls === 0, `stalls=${one.stalls}`);
check('本局有角色战绩统计', Object.keys(one.byChar).length >= 4, `${Object.keys(one.byChar).length} 名角色`);

// 4. 汇总
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(40)}\n通过 ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log('❌ 失败项:');
  for (const f of failed) console.log(`   - ${f.name}${f.extra ? ' (' + f.extra + ')' : ''}`);
}
if (errors.length) {
  console.log(`❌ 控制台错误 ${errors.length} 条:`);
  for (const e of errors.slice(0, 20)) console.log('   ' + e);
} else {
  console.log('✅ 无 console error / pageerror');
}

await browser.close();
server.kill();
process.exit(failed.length || errors.length || one.stalls ? 1 : 0);
