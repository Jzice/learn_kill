// 题源清洗：剔除字段不全、选项重复、与原版基线重复的行，并去除选项两侧多余引号
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'data', 'questions');
const html = fs.readFileSync(path.join(root, 'docs', '学堂杀.html'), 'utf8');
const m = html.match(/const BUILTIN_QUESTION_BANK=(\{[\s\S]*?\n\});/);
const baseline = new Function('return ' + m[1])();
const baselineQ = new Set(Object.values(baseline).flat().map((q) => q.q));

let removed = 0;
let kept = 0;
for (const grade of fs.readdirSync(srcDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = path.join(srcDir, grade.name);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.tsv'))) {
    const p = path.join(dir, file);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    const out = [];
    const seen = new Set();
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        out.push(line);
        continue;
      }
      const c = line.split('\t').map((x) => x.trim().replace(/^"(.*)"$/, '$1'));
      const ok =
        c.length === 8 &&
        c[0] &&
        Number.isInteger(Number(c[7])) &&
        Number(c[7]) >= 0 &&
        Number(c[7]) <= 3 &&
        new Set(c.slice(3, 7)).size === 4 &&
        !seen.has(c[0]) &&
        !baselineQ.has(c[0]);
      if (ok) {
        seen.add(c[0]);
        out.push(c.join('\t'));
        kept++;
      } else {
        removed++;
      }
    }
    fs.writeFileSync(p, out.join('\n') + '\n', 'utf8');
  }
}
console.log(`清洗完成：保留 ${kept} 题，移除 ${removed} 行（字段不全/选项重复/与基线重复）`);
