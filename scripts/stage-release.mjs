// 准备 Release 资产：node scripts/stage-release.mjs [dist目录] [输出目录]
// GitHub 会把含非 ASCII 字符的资产名重命名为 bundled.html / default.html 等占位名，
// 因此上传前统一复制为 ASCII 文件名，中文说明在 gh 上传时以 label 形式附带
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
const outDir = path.resolve(process.argv[3] || path.join(root, 'release'));

function fail(msg) {
  console.error(`[release] ${msg}`);
  process.exit(1);
}

const htmls = fs.existsSync(distDir)
  ? fs.readdirSync(distDir).filter((f) => f.toLowerCase().endsWith('.html'))
  : [];
if (htmls.length === 0) fail(`${distDir} 下没有 HTML 产物，请先执行 npm run build`);

const bundled = htmls.find((f) => f.includes('bundled'));
const cdn = htmls.find((f) => f !== bundled && !f.includes('bundled'));
if (!bundled || !cdn) {
  fail(`需要 CDN 与 bundled 两种产物，实际：${htmls.join(' / ')}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const staged = [];
for (const [src, dest, label] of [
  [cdn, 'xuetangsha.html', '学堂杀 · CDN 版（体积小，联机需联网）'],
  [bundled, 'xuetangsha.bundled.html', '学堂杀 · 完全离线版（内嵌 PeerJS，推荐）'],
]) {
  const from = path.join(distDir, src);
  const to = path.join(outDir, dest);
  fs.copyFileSync(from, to);
  const size = fs.statSync(to).size;
  if (size < 100 * 1024) fail(`${dest} 体积异常（${size} 字节），产物可能不完整`);
  const s = fs.readFileSync(to, 'utf8');
  if (!/<title>[^<]+<\/title>/.test(s)) fail(`${dest} 缺少 <title>，产物可能不完整`);
  if (!/<script[^>]*>[\s\S]{5000,}<\/script>/.test(s)) fail(`${dest} 未内联脚本，产物不是自包含单文件`);
  staged.push({ dest, label, size });
  console.log(`[release] ${src} -> ${dest}  ${(size / 1024).toFixed(1)} KB`);
}

// 题库资源目录：产物以相对路径 banks/... 按需注入加载，必须与 HTML 同级分发
const bankSrc = path.join(distDir, 'banks');
if (!fs.existsSync(bankSrc)) fail(`${distDir}/banks 缺失，请先执行 npm run build:banks && npm run build`);
fs.cpSync(bankSrc, path.join(outDir, 'banks'), { recursive: true });
let bankFiles = 0;
for (const g of fs.readdirSync(path.join(outDir, 'banks'))) {
  bankFiles += fs.readdirSync(path.join(outDir, 'banks', g)).filter((f) => f.endsWith('.js')).length;
}
if (bankFiles === 0) fail('release/banks 下没有题库分片，产物无法抽题');
console.log(`[release] banks/ -> release/banks  ${bankFiles} 个学科分片（必须与 HTML 同级分发）`);
// 打包为 banks.zip 单一 ASCII 资产上传，规避 GitHub 对非 ASCII 文件名的重命名；本地双击仍用 banks/ 目录
// CI（ubuntu）自带 zip；本地若无 zip 则回退为按 banks/ 目录上传（功能不变，仅资产名含中文）
let bankAsset = path.join(outDir, 'banks.zip');
try {
  execSync('zip -r "banks.zip" banks', { cwd: outDir, stdio: 'ignore' });
  console.log(`[release] banks.zip 已生成（${(fs.statSync(bankAsset).size / 1024).toFixed(1)} KB）`);
} catch {
  console.warn('[release] 未检测到 zip 工具，回退为按 banks/ 目录上传（CI ubuntu 环境会生成 banks.zip）');
  bankAsset = path.join(outDir, 'banks');
}

fs.writeFileSync(
  path.join(outDir, 'assets.txt'),
  staged.map((s) => `${path.join(outDir, s.dest)}#${s.label}`).join('\n') +
    `\n${bankAsset}#题库${bankAsset.endsWith('.zip') ? '分片压缩包' : '资源目录'}（${bankFiles} 个分片，解压/放置到与 HTML 同级目录）\n`,
  'utf8',
);
console.log('[release] 资产清单已写入 release/assets.txt（路径#中文说明）');