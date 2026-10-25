/* ==================== 化学式 / 数学公式排版 ====================
 * 背景：题库以纯文本存储，化学式与数学符号直接使用 Unicode 上下标字符——
 *   H₂O 的 ₂ 是 U+2082，Fe³⁺ 的 ⁺ 是 U+207A，x² 的 ² 是 U+00B2。
 * 桌面端（微软雅黑 / 苹方）通常覆盖这些码位，但手机浏览器、微信 / QQ 内置
 * WebView 的字体普遍不含 U+2070–209F 上下标块，缺字形时会渲染成 notdef
 * 豆腐块（方框中有 ×），表现就是「只有化学式、公式乱码，其它文字正常」。
 * 同理，√（U+221A）只有根号符号本身，不含覆盖被开方数的上横线（vinculum），
 * 所以 √(b²−4ac) 看上去是「根号加一对括号」而非根式。
 *
 * 方案：渲染前把这些字符转成原生 HTML 标签 / CSS 上划线——
 *   H₂O      → H<sub>2</sub>O
 *   Fe³⁺     → Fe<sup>3+</sup>
 *   √41      → <span class="fx-sqrt">…上划线覆盖 41…</span>
 * 这样只依赖普通数字 / 字母字形，任何字体都能显示，且排版更接近真实书写。
 *
 * 约束（务必遵守）：
 *   1) 只处理 innerHTML 场景的正文，不要用于 title 属性、onclick 的 JS 字符串、
 *      SVG <text> 等纯文本上下文（标签会被当作字面量显示）。
 *   2) 优先使用 fmtFormula()——它内部先 escapeHtml 再排版；
 *      formulaHtml() 只接受**已转义**的文本。
 *   3) 不改变源数据：题库 TSV、联机协议里的题目文本维持原样，两端渲染一致。
 */
import { escapeHtml } from './dom';

/** 上标字符 → 普通字符 */
const SUP_MAP: Record<string, string> = {
  '⁰': '0',
  'ⁱ': 'i',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  'ⁿ': 'n',
  '¹': '1', // U+00B9
  '²': '2', // U+00B2
  '³': '3', // U+00B3
};

/** 下标字符 → 普通字符 */
const SUB_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
};

interface Radicand {
  /** 被开方数结束之后的下标（不含） */
  end: number;
  /** 被开方数原文 */
  body: string;
}

function charClass(map: Record<string, string>): string {
  return Object.keys(map).join('');
}

function wrapRun(run: string, map: Record<string, string>, tag: 'sub' | 'sup'): string {
  let out = '';
  for (const ch of run) out += map[ch] ?? ch;
  return `<${tag}>${out}</${tag}>`;
}

const SUP_RE = new RegExp(`[${charClass(SUP_MAP)}]+`, 'g');
const SUB_RE = new RegExp(`[${charClass(SUB_MAP)}]+`, 'g');
const HAS_SUP = new RegExp(`[${charClass(SUP_MAP)}]`);
const HAS_SUB = new RegExp(`[${charClass(SUB_MAP)}]`);

/** 根号内的多位数字（含小数） */
const RAD_NUMBER = /^\d+(?:\.\d+)?/;
/** 根号内的单个字母：拉丁字母与希腊字母块（α β π θ … 常见于公式） */
const RAD_LETTER = /^[A-Za-z\u0370-\u03FF]/;

/** 取 √ 之后的平衡括号内容（返回不含外层括号的原文）；括号不配对则返回 null */
function matchParen(s: string, start: number): Radicand | null {
  if (s[start] !== '(') return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { end: i + 1, body: s.slice(start + 1, i) };
    }
  }
  return null;
}

/**
 * 识别 √ 后的被开方数：优先平衡括号（去掉外层括号），其次连续数字、单个字母。
 * 无法判定（空格、中文、运算符等）时返回 null，保持原来的纯文本观感。
 */
function radicandAt(s: string, at: number): Radicand | null {
  if (at >= s.length) return null;
  const paren = matchParen(s, at);
  if (paren) return paren;
  const num = RAD_NUMBER.exec(s.slice(at));
  if (num) return { end: at + num[0].length, body: num[0] };
  const one = RAD_LETTER.exec(s.slice(at));
  if (one) return { end: at + 1, body: one[0] };
  return null;
}

/** 渲染根式：depth 用于防御嵌套过深 */
function renderSqrt(s: string, depth = 0): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const at = s.indexOf('√', i);
    if (at < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, at);
    const r = radicandAt(s, at + 1);
    if (!r) {
      // 无法判定被开方数：原样输出，保证最坏情况等于改动前
      out += '√';
      i = at + 1;
      continue;
    }
    const body = r.body.includes('√') && depth < 3 ? renderSqrt(r.body, depth + 1) : r.body;
    out += `<span class="fx-sqrt"><span class="fx-rad">√</span><span class="fx-body">${body}</span></span>`;
    i = r.end;
  }
  return out;
}

/**
 * 化学式 / 公式排版：把已转义文本中的 Unicode 上下标与根号转成 HTML 结构。
 * 输入**必须**是 escapeHtml() 之后的文本；无相关字符时原样返回。
 */
export function formulaHtml(escaped: string): string {
  if (!escaped) return escaped;
  let s = escaped;
  if (s.includes('√')) s = renderSqrt(s);
  if (HAS_SUP.test(s)) s = s.replace(SUP_RE, (m) => wrapRun(m, SUP_MAP, 'sup'));
  if (HAS_SUB.test(s)) s = s.replace(SUB_RE, (m) => wrapRun(m, SUB_MAP, 'sub'));
  return s;
}

/** 便捷入口：先转义再排版，供所有 innerHTML 场景直接调用 */
export function fmtFormula(raw: unknown): string {
  return formulaHtml(escapeHtml(raw));
}
