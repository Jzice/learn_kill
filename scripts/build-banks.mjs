// 题库构建：读取 data/questions/<学期>/<科目>.tsv 与 data/knowledge/<学期>/<科目>[.rel].tsv
//   题目 TSV 列：题干 \t 单元 \t 知识点 \t 选项A \t 选项B \t 选项C \t 选项D \t 正确序号(0-3)
//   讲解 TSV 列：知识点 \t 单元 \t 概要 \t 要点(;; 分隔) \t 易错提示 \t 学科扩展 JSON
//   关系 TSV 列：源知识点 \t 目标知识点 \t 类型(prereq|contains|apply|contrast) \t 说明
// 产物：
//   public/banks/<学期>/<科目>.js —— 经典脚本，注入 window.__XTS_BANK__['<学期>/<科目>']
//     一次注入同时拿到题目 q / 讲解 k / 关系 r；用经典脚本而非 fetch，是为了 file:// 双击打开也能加载
//   src/data/banks/manifest.ts  —— 仅元数据（题数、单元、知识点清单），不含题干
//     主 HTML 体积因此与题量解耦，题库按需注入加载
// 选项重排：正确答案在 A/B/C/D 四个选项中均匀分布（见 redistributeOptions）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'data', 'questions');
const knowDir = path.join(root, 'data', 'knowledge');
const outDir = path.join(root, 'src', 'data', 'banks');
const pubBankDir = path.join(root, 'public', 'banks');
const MIN_PER_SUBJECT = Number(process.env.MIN_PER_SUBJECT || 50);
/** 每单元目标题量（用户约定：统一 30 题/单元） */
const TARGET_PER_UNIT = Number(process.env.TARGET_PER_UNIT || 30);

if (!fs.existsSync(srcDir)) {
  console.error('缺少题源目录：data/questions/');
  process.exit(1);
}

const GRADE_ORDER = [
  '初一上','初一下','初二上','初二下','初三上','初三下',
  '高一上','高一下','高二上','高二下','高三上','高三下',
];
const SUBJECTS = ['语文','数学','英语','物理','化学','生物','历史','地理','政治'];
const REL_TYPES = ['prereq', 'contains', 'apply', 'contrast'];

const result = [];
const problems = [];
const pending = [];
let grandTotal = 0;
let grandNotes = 0;
let grandRels = 0;

/** 读取讲解 TSV：知识点 -> KnowledgeNote */
function readNotes(grade, subject) {
  const file = path.join(knowDir, grade, `${subject}.tsv`);
  if (!fs.existsSync(file)) return { notes: {}, bad: [] };
  const bad = [];
  const notes = {};
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((line, i) => {
      const c = line.split('\t').map((x) => x.trim());
      const [kp, unit, summary, points, pitfall, ext] = c;
      if (!kp) {
        bad.push(`${grade}/${subject}.tsv 第${i + 1}行缺少知识点名`);
        return;
      }
      // 同名知识点会静默覆盖前一条讲解，必须显式报错，避免内容丢失
      if (notes[kp]) {
        bad.push(`${grade}/${subject}.tsv 第${i + 1}行知识点重复: ${kp}（已存在同名讲解，请改名或合并）`);
      }
      let parsedExt;
      if (ext) {
        try {
          parsedExt = JSON.parse(ext);
        } catch {
          bad.push(`${grade}/${subject}.tsv 第${i + 1}行扩展字段不是合法 JSON: ${ext.slice(0, 40)}`);
        }
      }
      notes[kp] = {
        s: subject,
        u: unit || '综合',
        kp,
        summary: summary || '',
        points: (points || '').split(';;').map((x) => x.trim()).filter(Boolean),
        ...(pitfall ? { pitfall } : {}),
        ...(parsedExt ? { ext: parsedExt } : {}),
      };
    });
  return { notes, bad };
}

/** 读取关系 TSV */
function readRelations(grade, subject, notes) {
  const file = path.join(knowDir, grade, `${subject}.rel.tsv`);
  if (!fs.existsSync(file)) return { relations: [], bad: [] };
  const bad = [];
  const relations = [];
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((line, i) => {
      const c = line.split('\t').map((x) => x.trim());
      const [from, to, type, note] = c;
      if (!from || !to) {
        bad.push(`${grade}/${subject}.rel.tsv 第${i + 1}行缺少端点`);
        return;
      }
      if (!REL_TYPES.includes(type)) {
        bad.push(`${grade}/${subject}.rel.tsv 第${i + 1}行关系类型非法: ${type}`);
        return;
      }
      if (!notes[from]) bad.push(`${grade}/${subject}.rel.tsv 第${i + 1}行起点知识点无讲解: ${from}`);
      if (!notes[to]) bad.push(`${grade}/${subject}.rel.tsv 第${i + 1}行终点知识点无讲解: ${to}`);
      relations.push({ s: subject, from, to, type, ...(note ? { note } : {}) });
    });
  return { relations, bad };
}

for (const grade of GRADE_ORDER) {
  const dir = path.join(srcDir, grade);
  const all = [];
  const perSubject = {};
  const subjectMeta = {};
  if (!fs.existsSync(dir)) {
    pending.push(`${grade}（全部 9 科待补充题源）`);
    result.push({ grade, questions: all, perSubject, subjectMeta });
    continue;
  }
  const seen = new Set();
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
    const { notes, bad: badNotes } = readNotes(grade, subject);
    problems.push(...badNotes);
    const { relations, bad: badRels } = readRelations(grade, subject, notes);
    problems.push(...badRels);
    grandNotes += Object.keys(notes).length;
    grandRels += relations.length;

    // 单元题量：不足目标记为"待补充"（不阻断构建，便于逐学期滚动扩充）
    const unitCount = {};
    for (const it of items) unitCount[it.u] = (unitCount[it.u] || 0) + 1;
    for (const [u, n] of Object.entries(unitCount)) {
      if (n < TARGET_PER_UNIT) pending.push(`${grade}/${subject}/${u} ${n}/${TARGET_PER_UNIT} 题`);
    }
    // 讲解覆盖率：有题目但无讲解的知识点
    const kpSet = new Set(items.map((it) => it.kp));
    for (const kp of kpSet) {
      if (!notes[kp]) pending.push(`${grade}/${subject}/${kp} 缺讲解`);
    }

    perSubject[subject] = (perSubject[subject] || 0) + items.length;
    subjectMeta[subject] = {
      count: items.length,
      units: Object.keys(unitCount).sort(),
      kps: [...kpSet].sort(),
    };
    all.push(...items);
  }
  for (const s of SUBJECTS) {
    const n = perSubject[s] || 0;
    if (!n) problems.push(`${grade}/${s} 缺少题目`);
    else if (n < MIN_PER_SUBJECT) pending.push(`${grade}/${s} 仅 ${n} 题（要求 ≥ ${MIN_PER_SUBJECT}，待补充）`);
  }
  result.push({ grade, questions: all, perSubject, subjectMeta });
  grandTotal += all.length;
}

// ---- 选项重排：使正确答案在 A/B/C/D 中均匀分布 ----
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

// ---- 产出：public/banks/<学期>/<科目>.js（经典脚本） ----
// 不做整目录删除：部分环境下 rmSync 会被"安全删除"策略拦截，且本脚本所有产物都是同名覆盖写，
// 旧分片与旧 manifest 会被自然替换（如需彻底清理，先手动删除 public/banks 与 src/data/banks）。
fs.mkdirSync(outDir, { recursive: true });

const dist = { A: 0, B: 0, C: 0, D: 0 };
const base = 'banks/';
const manifestEntries = [];
const subjectEntries = [];
const slugOf = (g) => 'g' + String(GRADE_ORDER.indexOf(g) + 1).padStart(2, '0');

for (const g of result) {
  const d = redistributeOptions(g.questions);
  for (let i = 0; i < 4; i++) dist[['A', 'B', 'C', 'D'][i]] += d[i];
  const bySub = {};
  for (const [subject] of Object.entries(g.perSubject)) {
    const items = g.questions.filter((q) => q.s === subject);
    const { notes } = readNotes(g.grade, subject);
    const { relations } = readRelations(g.grade, subject, notes);
    const payload = { q: items, k: notes, r: relations };
    const dir = path.join(pubBankDir, g.grade);
    fs.mkdirSync(dir, { recursive: true });
    const body =
      `// 由 scripts/build-banks.mjs 生成，请勿手改；经典脚本，注入 window.__XTS_BANK__\n` +
      `(function(){var B=window.__XTS_BANK__||(window.__XTS_BANK__={});` +
      `B[${JSON.stringify(g.grade + '/' + subject)}]=${JSON.stringify(payload)};})();\n`;
    fs.writeFileSync(path.join(dir, `${subject}.js`), body, 'utf8');
    bySub[subject] = payload.q.length;
    subjectEntries.push(
      `  ${JSON.stringify(g.grade + '/' + subject)}: { grade: ${JSON.stringify(g.grade)}, subject: ${JSON.stringify(subject)}, count: ${payload.q.length}, units: ${JSON.stringify(g.subjectMeta[subject]?.units ?? [])}, kps: ${JSON.stringify(g.subjectMeta[subject]?.kps ?? [])} },`,
    );
  }
  manifestEntries.push(
    `  { grade: ${JSON.stringify(g.grade)}, count: ${g.questions.length}, bySubject: ${JSON.stringify(bySub)} },`,
  );
}

const manifest = `// 本文件由 scripts/build-banks.mjs 生成，请勿手改
// 只含元数据（题数 / 单元 / 知识点清单），不含题干：主文件体积与题量解耦

/** 内置题库学期清单（供大厅渲染，无需加载题目本身） */
export interface GradeBankMeta {
  grade: string;
  count: number;
  bySubject: Record<string, number>;
}

/** 学期 + 学科粒度的元数据（供知识图谱骨架与题数展示） */
export interface SubjectBankMeta {
  grade: string;
  subject: string;
  count: number;
  units: string[];
  kps: string[];
}

export const GRADE_BANK_META: GradeBankMeta[] = [
${manifestEntries.join('\n')}
];

export const SUBJECT_BANK_META: Record<string, SubjectBankMeta> = {
${subjectEntries.join('\n')}
};

/** 题库资源根路径（相对产物 HTML；public/banks 在 dev 与 build 下均挂载于此） */
export const BANK_BASE = ${JSON.stringify(base)};

/** 学期 → 学科列表（按固定学科顺序，过滤掉无题学科） */
export function subjectsOf(grade: string): string[] {
  return ${JSON.stringify(SUBJECTS)}.filter((s) => !!SUBJECT_BANK_META[grade + '/' + s]);
}
`;
fs.writeFileSync(path.join(outDir, 'manifest.ts'), manifest, 'utf8');

console.log(`学期 ${result.length} 个，题目总计 ${grandTotal} 题，讲解 ${grandNotes} 条，关系 ${grandRels} 条`);
console.log(`答案分布 A/B/C/D: ${dist.A} / ${dist.B} / ${dist.C} / ${dist.D}`);
for (const g of result) {
  console.log(
    `  ${g.grade}: ${g.questions.length} 题  ${Object.entries(g.perSubject).map(([k, v]) => `${k}${v}`).join(' ')}`,
  );
}
if (pending.length) {
  console.log(`\n⏳ 待补充 ${pending.length} 项（不阻断构建）：`);
  pending.slice(0, 20).forEach((p) => console.log('  - ' + p));
  if (pending.length > 20) console.log(`  … 其余 ${pending.length - 20} 项省略`);
}
if (problems.length) {
  console.log(`\n⚠ 错误 ${problems.length} 项：`);
  problems.slice(0, 30).forEach((p) => console.log('  - ' + p));
  process.exitCode = 1;
} else {
  console.log('\n✅ 题库编目通过（题目/讲解/关系格式校验）');
}
