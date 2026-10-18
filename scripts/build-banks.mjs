// 题库构建：读取 data/questions/<年级>/<科目>.tsv，生成按年级懒加载的配置模块
//   TSV 列：题干 \t 单元 \t 知识点 \t 选项A \t 选项B \t 选项C \t 选项D \t 正确序号(0-3)
// 产物：src/data/banks/gNN.ts（每年级一个模块）+ src/data/banks/manifest.ts（年级清单、科目题数、动态加载器）
// 选项重排：正确答案在 A/B/C/D 四个选项中均匀分布（见 redistributeOptions）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'data', 'questions');
const outDir = path.join(root, 'src', 'data', 'banks');
const MIN_PER_SUBJECT = Number(process.env.MIN_PER_SUBJECT || 50);

if (!fs.existsSync(srcDir)) {
  console.error('缺少题源目录：data/questions/');
  process.exit(1);
}

const GRADE_ORDER = [
  '初一上','初一下','初二上','初二下','初三上','初三下',
  '高一上','高一下','高二上','高二下','高三上','高三下',
];
const SUBJECTS = ['语文','数学','英语','物理','化学','生物','历史','地理','政治'];

// 基线：原版单文件游戏中的内置题库（1:1 保留，保证原内容不丢失）
const html = fs.readFileSync(path.join(root, 'docs', '学堂杀.html'), 'utf8');
const m = html.match(/const BUILTIN_QUESTION_BANK=(\{[\s\S]*?\n\});/);
if (!m) throw new Error('BUILTIN_QUESTION_BANK literal not found in docs/学堂杀.html');
const baseline = new Function('return ' + m[1])();

// 读取：data/questions/<年级>/<科目>.tsv
const grades = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && GRADE_ORDER.includes(d.name))
  .map((d) => d.name)
  .sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));

const result = [];
const problems = [];
const pending = [];
let grandTotal = 0;

for (const grade of GRADE_ORDER) {
  const dir = path.join(srcDir, grade);
  const all = [];
  const perSubject = {};
  // 1) 基线题（无单元信息，归入"综合"）
  for (const q of baseline[grade] || []) {
    all.push({ s: q.s, u: '综合', kp: q.kp || '综合', q: q.q, o: q.o.slice(), a: q.a });
    perSubject[q.s] = (perSubject[q.s] || 0) + 1;
  }
  if (!fs.existsSync(dir)) {
    // 该年级尚无题源目录：仅保留基线题，标记为"待补充"
    pending.push(`${grade}（全部 9 科待补充题源）`);
    result.push({ grade, questions: all, perSubject });
    grandTotal += all.length;
    continue;
  }
  // 2) 新增题（按科目分文件）
  const seen = new Set(all.map((x) => x.q));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.tsv')).sort()) {
    const subject = path.basename(file, '.tsv');
    const lines = fs
      .readFileSync(path.join(dir, file), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    const items = [];
    lines.forEach((line, i) => {
      const c = line.split('\t').map((x) => x.trim());
      if (c.length < 8) {
        problems.push(`${grade}/${file} 第${i + 1}行字段不足(${c.length}): ${line.slice(0, 40)}`);
        return;
      }
      const [q, unit, kp, o1, o2, o3, o4, aStr] = c;
      const a = Number(aStr);
      if (!Number.isInteger(a) || a < 0 || a > 3) {
        problems.push(`${grade}/${file} 第${i + 1}行正确答案序号非法: ${aStr}`);
        return;
      }
      const opts = [o1, o2, o3, o4];
      if (new Set(opts).size !== 4) {
        problems.push(`${grade}/${file} 第${i + 1}行选项重复: ${opts.join('|')}`);
      }
      if (seen.has(q)) {
        problems.push(`${grade}/${file} 第${i + 1}行与已有题目重复: ${q.slice(0, 24)}`);
        return;
      }
      seen.add(q);
      items.push({ s: subject, u: unit || '综合', kp: kp || '综合', q, o: opts, a });
    });
    perSubject[subject] = (perSubject[subject] || 0) + items.length;
    all.push(...items);
  }
  for (const s of SUBJECTS) {
    const n = perSubject[s] || 0;
    if (!n) problems.push(`${grade}/${s} 缺少题目`);
    else if (n < MIN_PER_SUBJECT) pending.push(`${grade}/${s} 仅 ${n} 题（要求 ≥ ${MIN_PER_SUBJECT}，待补充）`);
  }
  result.push({ grade, questions: all, perSubject });
  grandTotal += all.length;
}

// ---- 选项重排：使正确答案在 A/B/C/D 中均匀分布 ----
// 正确项按生成序号轮转落位（每 4 题恰好 A/B/C/D 各一次，最多 ±1），
// 干扰项以「科目|题干」为种子的确定性 Fisher-Yates 洗牌，避免出现可预测模式；
// 重建结果可复现，题目内容不丢失（仅改变选项排列与正确项下标）。
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function redistributeOptions(questions) {
  let seq = 0;
  const dist = [0, 0, 0, 0];
  for (const q of questions) {
    if (!q.o || q.o.length !== 4 || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) continue;
    const target = seq++ % 4;
    const rand = mulberry32(hashSeed(q.s + '|' + q.q));
    const correct = q.o[q.a];
    const others = q.o.filter((_, i) => i !== q.a);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const o = [];
    let k = 0;
    for (let i = 0; i < 4; i++) o.push(i === target ? correct : others[k++]);
    q.o = o;
    q.a = target;
    dist[target]++;
  }
  return dist;
}

// 生成年级模块
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const files = result.map((g, i) => {
  const dist = redistributeOptions(g.questions);
  const slug = 'g' + String(i + 1).padStart(2, '0');
  const body = `// 由 scripts/build-banks.mjs 从 data/questions/${g.grade}/ 生成，请勿手改题目数据
// 年级：${g.grade}（${g.questions.length} 题）—— 按需动态加载
import type { Question } from '../../core/types';

const QUESTIONS: Question[] = ${JSON.stringify(g.questions)};

export default QUESTIONS;
`;
  fs.writeFileSync(path.join(outDir, slug + '.ts'), body, 'utf8');
  return { slug, grade: g.grade, count: g.questions.length, perSubject: g.perSubject, dist };
});

const meta = files
  .map(
    (f) =>
      `  { grade: '${f.grade}', count: ${f.count}, bySubject: ${JSON.stringify(f.perSubject)} },`,
  )
  .join('\n');
const loaders = files.map((f) => `  '${f.grade}': () => import('./${f.slug}'),`).join('\n');

const manifest = `// 本文件由 scripts/build-banks.mjs 生成，请勿手改
import type { Question } from '../../core/types';

/** 内置题库年级清单（含题数与分科目题数，供大厅渲染，无需加载题目本身） */
export interface GradeBankMeta {
  grade: string;
  count: number;
  bySubject: Record<string, number>;
}

export const GRADE_BANK_META: GradeBankMeta[] = [
${meta}
];

/**
 * 年级 → 动态加载器（静态可分析的 import() 映射，使打包器能按年级代码分割）
 */
export const GRADE_LOADERS: Record<string, () => Promise<{ default: Question[] }>> = {
${loaders}
};
`;
fs.writeFileSync(path.join(outDir, 'manifest.ts'), manifest, 'utf8');

console.log(`年级 ${files.length} 个，题目总计 ${grandTotal} 题`);
for (const f of files) {
  console.log(`  ${f.grade}: ${f.count} 题  ${Object.entries(f.perSubject).map(([k, v]) => `${k}${v}`).join(' ')}`);
  console.log(`    答案分布 A/B/C/D: ${f.dist.join(' / ')}`);
}
if (pending.length) {
  console.log(`\n⏳ 待补充 ${pending.length} 项（不阻断构建）：`);
  pending.slice(0, 30).forEach((p) => console.log('  - ' + p));
}
if (problems.length) {
  console.log(`\n⚠ 错误 ${problems.length} 项：`);
  problems.slice(0, 30).forEach((p) => console.log('  - ' + p));
  process.exitCode = 1;
} else {
  console.log('\n✅ 已编目年级科目题量达标');
}
