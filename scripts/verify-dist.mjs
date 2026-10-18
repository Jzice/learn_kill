// 验证 dist 产物：单文件完整性 + PeerJS 双模式差异
// 同时作为 CI 门禁：关键项不满足时以非零退出码失败
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const files = fs
  .readdirSync(dist)
  .filter((f) => f.toLowerCase().endsWith('.html'))
  .sort();

if (files.length === 0) {
  console.error('[verify-dist] dist/ 下没有 HTML 产物，请先执行 npm run build');
  process.exit(1);
}

const failures = [];

for (const f of files) {
  const s = fs.readFileSync(path.join(dist, f), 'utf8');
  const extScripts = s.match(/<script[^>]+src="[^"]+"/g) || [];
  const extLinks = s.match(/<link[^>]+href="[^"]+"/g) || [];
  const isBundled = f.includes('bundled');
  const hasCdnTag = s.includes('unpkg.com/peerjs');
  // 产物脚本标签带属性（<script type="module" crossorigin>），正则需允许属性
  const hasInlineScript = /<script[^>]*>[\s\S]{5000,}<\/script>/.test(s);
  const title = (s.match(/<title>(.*?)<\/title>/) || [])[1];

  console.log('===', f, `(${(s.length / 1024).toFixed(1)} KB) ===`);
  console.log('  peerjs CDN tag :', hasCdnTag);
  console.log('  inline <style> :', s.includes('<style>'));
  console.log('  inline <script>(big):', hasInlineScript);
  console.log('  external scripts:', extScripts.length ? extScripts.join(' | ') : '(none)');
  console.log('  external links  :', extLinks.length ? extLinks.join(' | ') : '(none)');
  console.log('  title           :', title);
  console.log('  screenLobby     :', s.includes('screenLobby'));
  console.log('  quizModal       :', s.includes('quizModal'));
  console.log('  rulesModal      :', s.includes('rulesModal'));
  console.log('  BUILTIN bank    :', s.includes('初一上') && s.includes('高三下'));
  console.log('  CHARACTERS      :', s.includes('鲁迅') && s.includes('卢瑟福'));

  const check = (ok, msg) => {
    if (!ok) failures.push(`${f}: ${msg}`);
  };
  check(!!title, '缺少 <title>');
  check(hasInlineScript, '未内联脚本，产物不是自包含单文件');
  check(extLinks.length === 0, `存在外部样式引用：${extLinks.join(' | ')}`);
  // 仅 CDN 版允许外链 peerjs；bundled 版必须完全自包含
  const allowedExtScripts = isBundled ? 0 : extScripts.length;
  check(
    extScripts.length === allowedExtScripts,
    `外链脚本数量异常（bundled=0，cdn=1）实际 ${extScripts.length}`,
  );
  check(hasCdnTag === !isBundled, isBundled ? 'bundled 产物不应含 peerjs CDN 标签' : 'CDN 产物缺少 peerjs CDN 标签');
  check(s.includes('screenLobby') && s.includes('quizModal'), '缺少界面标记，产物可能不完整');
  check(s.includes('初一上') && s.includes('高三下'), '缺少内置题库标记');
}

if (failures.length) {
  console.error('\n[verify-dist] 校验失败：');
  failures.forEach((x) => console.error('  ✗ ' + x));
  process.exit(1);
}
console.log('\n[verify-dist] 全部产物通过自包含单文件校验');