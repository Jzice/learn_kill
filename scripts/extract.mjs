// 一次性脚本：从 docs/学堂杀.html 提取 <style> 与 <body> markup，生成 src/style.css 与 src/index.html
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'docs', '学堂杀.html');
const src = fs.readFileSync(srcPath, 'utf8');

const bad = (src.match(/\uFFFD/g) || []).length;
console.log('U+FFFD count:', bad);

const cssMatch = src.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) throw new Error('style block not found');
const css = cssMatch[1];

const titleMatch = src.match(/<title>([\s\S]*?)<\/title>/);
const title = titleMatch ? titleMatch[1] : '学堂杀';

const bodyStart = src.indexOf('<body>') + '<body>'.length;
const scriptIdx = src.indexOf('\n<script>', bodyStart);
if (scriptIdx < 0) throw new Error('main script not found');
const body = src.slice(bodyStart, scriptIdx);

fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'style.css'), css.replace(/^\n+/, '').replace(/\s+$/, '') + '\n', 'utf8');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>${title}</title>
<script type="module" src="/src/main.ts"></script>
</head>
<body>${body}</body>
</html>
`;
fs.writeFileSync(path.join(root, 'src', 'index.html'), html, 'utf8');
console.log('title:', title);
console.log('css bytes:', css.length, 'body bytes:', body.length);
console.log('done');
