// 验证 dist 产物：单文件完整性 + PeerJS 双模式差异
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
for (const f of fs.readdirSync(dist)) {
  const s = fs.readFileSync(path.join(dist, f), 'utf8');
  const extScripts = s.match(/<script[^>]+src="[^"]+"/g) || [];
  const extLinks = s.match(/<link[^>]+href="[^"]+"/g) || [];
  console.log('===', f, `(${(s.length / 1024).toFixed(1)} KB) ===`);
  console.log('  peerjs CDN tag :', s.includes('unpkg.com/peerjs'));
  console.log('  inline <style> :', s.includes('<style>'));
  console.log('  inline <script>(big):', /<script>[\s\S]{5000,}<\/script>/.test(s));
  console.log('  external scripts:', extScripts.length ? extScripts.join(' | ') : '(none)');
  console.log('  external links  :', extLinks.length ? extLinks.join(' | ') : '(none)');
  console.log('  title           :', (s.match(/<title>(.*?)<\/title>/) || [])[1]);
  console.log('  screenLobby     :', s.includes('screenLobby'));
  console.log('  quizModal       :', s.includes('quizModal'));
  console.log('  rulesModal      :', s.includes('rulesModal'));
  console.log('  BUILTIN bank    :', s.includes('初一上') && s.includes('高三下'));
  console.log('  CHARACTERS      :', s.includes('鲁迅') && s.includes('卢瑟福'));
}
