// 从 docs/学堂杀.html 提取 BUILTIN_QUESTION_BANK 字面量，按年级拆分为可懒加载的配置文件
// 产物：src/data/banks/g01..gNN.ts（每年级一个模块）+ src/data/banks/manifest.ts（年级清单与动态加载器）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(root, 'docs', '学堂杀.html'), 'utf8');

const m = src.match(/const BUILTIN_QUESTION_BANK=(\{[\s\S]*?\n\});/);
if (!m) throw new Error('BUILTIN_QUESTION_BANK literal not found');

const bank = new Function('return ' + m[1])();
const grades = Object.keys(bank);
const outDir = path.join(root, 'src', 'data', 'banks');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. 每个年级一个独立模块（默认导出题目数组）
const files = grades.map((grade, i) => {
  const slug = 'g' + String(i + 1).padStart(2, '0');
  const body = `// 由 scripts/extract-bank.mjs 从原版单文件游戏 1:1 提取，请勿手改题目数据
// 年级：${grade}（${bank[grade].length} 题）—— 按需动态加载
import type { Question } from '../../core/types';

const QUESTIONS: Question[] = ${JSON.stringify(bank[grade], null, 2)};

export default QUESTIONS;
`;
  fs.writeFileSync(path.join(outDir, slug + '.ts'), body, 'utf8');
  return { slug, grade, count: bank[grade].length };
});

// 2. 清单：仅含年级名与题数（供大厅零成本渲染），以及按年级名的动态加载器
const meta = files
  .map((f) => `  { grade: '${f.grade}', count: ${f.count} },`)
  .join('\n');
const loaders = files
  .map((f) => `  '${f.grade}': () => import('./${f.slug}'),`)
  .join('\n');

const manifest = `// 本文件由 scripts/extract-bank.mjs 生成，请勿手改
import type { Question } from '../../core/types';

/** 内置题库年级清单（含题数，供大厅渲染，无需加载题目本身） */
export interface GradeBankMeta {
  grade: string;
  count: number;
}

export const GRADE_BANK_META: GradeBankMeta[] = [
${meta}
];

/**
 * 年级 → 动态加载器。使用静态可分析的 import() 映射，
 * 使打包器能按年级代码分割；运行时仅在需要该年级题目时才真正加载解析。
 */
export const GRADE_LOADERS: Record<string, () => Promise<{ default: Question[] }>> = {
${loaders}
};
`;
fs.writeFileSync(path.join(outDir, 'manifest.ts'), manifest, 'utf8');

// 3. 清理旧的整体打包文件
const legacy = path.join(root, 'src', 'data', 'questionBankData.ts');
if (fs.existsSync(legacy)) fs.unlinkSync(legacy);

const total = files.reduce((s, f) => s + f.count, 0);
console.log('grades:', files.length, 'questions:', total, 'files:', files.map((f) => `${f.slug}=${f.count}`).join(' '));
