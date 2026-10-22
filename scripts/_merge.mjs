// 临时合并脚本：把 tmp-add/ 与 tmp-add-know/ 下的增量内容（|| 分隔）追加到正式 TSV（\t 分隔）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const addQ = path.join(root, 'tmp-add');
const addK = path.join(root, 'tmp-add-know');
const dstQ = path.join(root, 'data', 'questions');
const dstK = path.join(root, 'data', 'knowledge');

let nq = 0;
let nk = 0;
const warns = [];

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const grade of fs.readdirSync(dir)) {
    const gd = path.join(dir, grade);
    if (!fs.statSync(gd).isDirectory()) continue;
    for (const f of fs.readdirSync(gd).filter((x) => x.endsWith('.tsv'))) {
      cb(grade, f, path.join(gd, f));
    }
  }
}

const existingQ = new Set();
for (const grade of fs.readdirSync(dstQ)) {
  const gd = path.join(dstQ, grade);
  if (!fs.statSync(gd).isDirectory()) continue;
  for (const f of fs.readdirSync(gd).filter((x) => x.endsWith('.tsv'))) {
    for (const l of fs.readFileSync(path.join(gd, f), 'utf8').split('\n')) {
      const t = l.trim();
      if (t && !t.startsWith('#')) existingQ.add(t.split('\t')[0].trim());
    }
  }
}

const pendingQ = [];
walk(addQ, (grade, f, file) => {
  const target = path.join(dstQ, grade, f);
  if (!fs.existsSync(target)) {
    warns.push(`目标文件不存在：${grade}/${f}`);
    return;
  }
  const lines = [];
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    const c = t.split('||').map((x) => x.trim());
    if (c.length !== 8) {
      warns.push(`${grade}/${f} 字段数 ${c.length}（应为 8）: ${t.slice(0, 40)}`);
      continue;
    }
    const a = Number(c[7]);
    if (!Number.isInteger(a) || a < 0 || a > 3) {
      warns.push(`${grade}/${f} 答案序号非法: ${c[7]} @ ${t.slice(0, 30)}`);
      continue;
    }
    const opts = [c[3], c[4], c[5], c[6]];
    if (new Set(opts).size !== 4) warns.push(`${grade}/${f} 选项重复: ${opts.join('|')}`);
    if (existingQ.has(c[0])) {
      warns.push(`${grade}/${f} 题干与已有重复: ${c[0].slice(0, 30)}`);
      continue;
    }
    existingQ.add(c[0]);
    lines.push(c.join('\t'));
    nq++;
  }
  if (!lines.length) return;
  pendingQ.push([target, lines]);
});

const pendingK = [];
walk(addK, (grade, f, file) => {
  const target = path.join(dstK, grade, f);
  if (!fs.existsSync(target)) {
    warns.push(`讲解目标文件不存在：${grade}/${f}`);
    return;
  }
  const have = new Set(
    fs.readFileSync(target, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t')[0].trim()),
  );
  const lines = [];
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    const c = t.split('||').map((x) => x.trim());
    if (c.length < 4) {
      warns.push(`${grade}/${f} 讲解字段不足: ${t.slice(0, 40)}`);
      continue;
    }
    if (have.has(c[0])) continue;
    have.add(c[0]);
    lines.push(c.join('\t'));
    nk++;
  }
  if (!lines.length) return;
  pendingK.push([target, lines]);
});

for (const [target, lines] of pendingQ) {
  const cur = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, (cur.endsWith('\n') ? cur : cur + '\n') + lines.join('\n') + '\n', 'utf8');
}
for (const [target, lines] of pendingK) {
  const cur = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, (cur.endsWith('\n') ? cur : cur + '\n') + lines.join('\n') + '\n', 'utf8');
}

console.log(`追加题目 ${nq} 题，讲解 ${nk} 条`);
if (warns.length) {
  fs.writeFileSync(path.join(root, 'tmp-warn.txt'), warns.join('\n'), 'utf8');
  console.log(`⚠ 警告 ${warns.length} 项，详见 tmp-warn.txt：`);
  warns.slice(0, 15).forEach((w) => console.log('  - ' + w));
}
for (const [g, f, file] of []) void g, f, file;
walk(addQ, (g, f, file) => fs.renameSync(file, file + '.merged'));
walk(addK, (g, f, file) => fs.renameSync(file, file + '.merged'));
