// 临时统计脚本：输出各学期各科目题量、单元/知识点分布（UTF-8）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const qDir = path.join(root, 'data', 'questions');
const kDir = path.join(root, 'data', 'knowledge');
const GRADES = process.argv.slice(2);
const TARGET = 100;
const out = [];

for (const g of GRADES) {
  out.push(`===== ${g} =====`);
  const dir = path.join(qDir, g);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.tsv')).sort()) {
    const subject = path.basename(f, '.tsv');
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const units = {};
    const kps = new Set();
    for (const l of lines) {
      const c = l.split('\t');
      const u = (c[1] || '').trim() || '综合';
      const kp = (c[2] || '').trim() || '综合';
      units[u] = (units[u] || 0) + 1;
      kps.add(kp);
    }
    const kFile = path.join(kDir, g, `${subject}.tsv`);
    let noted = new Set();
    if (fs.existsSync(kFile)) {
      noted = new Set(fs.readFileSync(kFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')[0].trim()));
    }
    const gap = Math.max(0, TARGET - lines.length);
    out.push(`--- ${subject}: ${lines.length} 题 (缺口 ${gap})`);
    out.push(`  单元: ${Object.entries(units).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    out.push(`  知识点: ${[...kps].join(' | ')}`);
    const miss = [...kps].filter((k) => !noted.has(k));
    if (miss.length) out.push(`  无讲解: ${miss.join(' | ')}`);
  }
}
fs.writeFileSync(path.join(root, 'tmp-stat.txt'), out.join('\n'), 'utf8');
console.log('written');
