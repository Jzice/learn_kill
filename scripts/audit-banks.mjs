// 题库数据质量审计：
//   1) 全量装载 data/questions/<年级>/<科目>.tsv（原版基线题已迁移为各科 TSV 首段，见 CHANGELOG v1.7.4）；
//   2) 检查字段缺失/异常短、选项重复、同年级重复、跨年级重复、答案越界、知识点/单元缺失统计；
//   3) 输出可修复清单
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'data', 'questions');
const GRADE_ORDER = ['初一上','初一下','初二上','初二下','初三上','初三下','高一上','高一下','高二上','高二下','高三上','高三下'];
const SUBJECTS = ['语文','数学','英语','物理','化学','生物','历史','地理','政治'];

const issues = { shortQ: [], emptyKp: [], emptyUnit: [], dupInGrade: [], dupCross: [], badOpt: [], subjectKnown: [] };
const globalSeen = new Map(); // 题干 → [年级…]
let total = 0;

for (const grade of GRADE_ORDER) {
  const seen = new Set();
  const load = (q, subject, src) => {
    total++;
    const where = `${grade}/${subject} ${src}`;
    if (!q.q || q.q.trim().length < 6) issues.shortQ.push(`${where}: 「${(q.q || '').slice(0, 20)}」`);
    if (!q.kp || q.kp === '综合') issues.emptyKp.push(`${where}: 「${(q.q || '').slice(0, 16)}」`);
    if (!q.u || q.u === '综合') issues.emptyUnit.push(where);
    if (!q.o || new Set(q.o).size !== (q.o || []).length) issues.badOpt.push(`${where}: 选项重复`);
    if (q.o && q.o.some((o) => !o || o.trim().length === 0)) issues.badOpt.push(`${where}: 空选项`);
    if (Number.isInteger(q.a) && (q.a < 0 || q.a > 3)) issues.badOpt.push(`${where}: 答案越界 ${q.a}`);
    if (subject && !SUBJECTS.includes(subject)) issues.subjectKnown.push(`${where}: 学科「${subject}」不在枚举`);
    if (seen.has(q.q)) issues.dupInGrade.push(`${where}: 年级内重复「${q.q.slice(0, 24)}」`);
    seen.add(q.q);
    if (globalSeen.has(q.q)) {
      globalSeen.get(q.q).push(grade);
    } else globalSeen.set(q.q, [grade]);
  };
  const dir = path.join(srcDir, grade);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.tsv')).sort()) {
      const subject = path.basename(f, '.tsv');
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      lines.forEach((line, i) => {
        const c = line.split('\t').map((x) => x.trim());
        if (c.length < 8) { issues.badOpt.push(`${grade}/${f} 第${i + 1}行字段不足(${c.length})`); return; }
        const [q, unit, kp, o1, o2, o3, o4, aStr] = c;
        const a = Number(aStr);
        load({ q, u: unit, kp, o: [o1, o2, o3, o4], a: Number.isInteger(a) ? a : -1 }, subject, `第${i + 1}行`);
      });
    }
  }
}
const crossDup = [...globalSeen.entries()].filter(([, g]) => new Set(g).size > 1);
console.log(`总题量 ${total}`);
console.log(`\n[异常短题干] ${issues.shortQ.length}`);
issues.shortQ.slice(0, 15).forEach((x) => console.log('  ' + x));
console.log(`\n[选项异常] ${issues.badOpt.length}`);
issues.badOpt.slice(0, 15).forEach((x) => console.log('  ' + x));
console.log(`\n[年级内重复] ${issues.dupInGrade.length}`);
issues.dupInGrade.slice(0, 10).forEach((x) => console.log('  ' + x));
console.log(`\n[跨年级重复] ${crossDup.length}`);
crossDup.slice(0, 20).forEach(([q, g]) => console.log(`  「${q.slice(0, 30)}」→ ${g.join(',')}`));
console.log(`\n[知识点缺失(=综合)] ${issues.emptyKp.length}`);
console.log(`[单元缺失(=综合)] ${issues.emptyUnit.length}`);
console.log(`[学科枚举外] ${issues.subjectKnown.length}`);
issues.subjectKnown.slice(0, 10).forEach((x) => console.log('  ' + x));
