// 组装 GitHub Pages 站点目录：node scripts/build-pages.mjs [dist目录] [输出目录]
// bundled 产物（自包含、离线可玩）作为站点 index.html，另一模式作为同源下载文件
// 由 .github/workflows/pages.yml 调用；亦可本地执行预览将要发布的站点
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
const outDir = path.resolve(process.argv[3] || path.join(root, '_site'));

function fail(msg) {
  console.error(`[pages] ${msg}`);
  process.exit(1);
}

const htmls = fs.existsSync(distDir)
  ? fs.readdirSync(distDir).filter((f) => f.toLowerCase().endsWith('.html'))
  : [];
if (htmls.length === 0) {
  fail(`${distDir} 下没有 HTML 产物，请先执行 npm run build:bundled`);
}

// bundled 产物作为站点入口：自包含、离线可玩
const bundled = htmls.find((f) => f.includes('bundled'));
if (!bundled) {
  fail(`未找到 bundled 产物（文件名需含 "bundled"），实际产物：${htmls.join(' / ')}`);
}
const downloads = htmls.filter((f) => f !== bundled);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(distDir, bundled), path.join(outDir, 'index.html'));
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
for (const f of downloads) {
  if (f === 'index.html') continue;
  fs.copyFileSync(path.join(distDir, f), path.join(outDir, f));
}

// 自检：站点入口必须是完整单文件（内联脚本 + 标题）
const entry = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
if (!/<title>[^<]+<\/title>/.test(entry)) fail('站点 index.html 缺少 <title>，产物可能不完整');
if (!/<script[^>]*>[\s\S]{5000,}<\/script>/.test(entry)) fail('站点 index.html 未内联脚本，产物可能不完整');

console.log(`[pages] 源目录 ${distDir}`);
for (const f of fs.readdirSync(outDir)) {
  const size = fs.statSync(path.join(outDir, f)).size;
  console.log(`  ${f}  ${(size / 1024).toFixed(1)} KB`);
}
console.log(`[pages] 站点入口 index.html = ${bundled}`);