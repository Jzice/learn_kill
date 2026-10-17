// 一次性脚本：从 docs/学堂杀.html 提取 BUILTIN_QUESTION_BANK 字面量，生成 src/data/questionBankData.ts
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(root, 'docs', '学堂杀.html'), 'utf8');

const m = src.match(/const BUILTIN_QUESTION_BANK=(\{[\s\S]*?\n\});/);
if (!m) throw new Error('BUILTIN_QUESTION_BANK literal not found');

const out = `// 本文件由 scripts/extract-bank.mjs 从原版单文件游戏 1:1 提取，请勿手改题目数据
import type { QuestionBank } from '../core/types';

export const BUILTIN_QUESTION_BANK: QuestionBank = ${m[1]};
`;
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'questionBankData.ts'), out, 'utf8');

const grades = (m[1].match(/^'[^']+':\[/gm) || []).length;
console.log('grades:', grades, 'bytes:', out.length);
