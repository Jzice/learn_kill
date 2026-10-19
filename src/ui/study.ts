/* ==================== 首页：我的学习情况（知识点掌握 + 错题复习） ====================
 * 数据全部来自本地学习档案 PROFILE.quizRec（见 profile/quizbook.ts）：
 * · 知识点掌握：按「学科 + 知识点」聚合，显示已掌握 x/y 与进度
 * · 待复习错题：答错且尚未掌握（连对 < MASTER_STREAK），点击可展开原题解析
 * · 已攻克错题：曾经答错但已连对达标，单独折叠列表
 * 展开解析时才按年级懒加载题库（首屏不加载任何年级题库，保持懒加载不变式）
 */
import type { Question, QuizRec } from '../core/types';
import { escapeHtml } from '../core/dom';
import { Sound } from '../core/sound';
import { PROFILE } from '../profile/profile';
import {
  MASTER_STREAK,
  findQuestionByText,
  kpStats,
  markReviewed,
  masteredCount,
  masteredWrongList,
  recByKey,
  wrongList,
} from '../profile/quizbook';
import { loadGrade } from '../data/bankLoader';

/** 已展开解析的错题 key */
const expanded = new Set<string>();
/** 解析缓存：value 为 null 表示题库中未找到 */
const detail = new Map<string, Question | null>();
/** 已攻克错题列表是否展开 */
let showMastered = false;
/** 列表展示上限（避免首屏过长） */
const KP_LIMIT = 12;
const WRONG_LIMIT = 20;

function pctOf(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

/** 统计条：累计作答 / 正确率 / 已掌握题 / 待复习错题 */
function statsHtml(wrong: number): string {
  const total = PROFILE.totalQuiz || 0;
  const correct = PROFILE.correctQuiz || 0;
  const cells: [string, string][] = [
    [String(total), '累计作答'],
    [`${pctOf(correct, total)}%`, '正确率'],
    [String(masteredCount()), '已掌握题'],
    [String(wrong), '待复习错题'],
  ];
  return `<div class="study-stats">${cells
    .map(([v, l]) => `<div class="study-cell"><b>${v}</b><span>${l}</span></div>`)
    .join('')}</div>`;
}

/** 知识点掌握列表 */
function kpHtml(): string {
  const list = kpStats();
  if (!list.length) {
    return `<div class="wb-empty">还没有学习记录，开局答题后这里会统计各知识点的掌握情况</div>`;
  }
  const rows = list
    .slice(0, KP_LIMIT)
    .map((st) => {
      const done = st.mastered === st.total;
      return `<div class="kp-item ${done ? 'done' : ''}" title="${escapeHtml(st.s + ' · ' + st.kp)}">
        <div class="kp-top"><span class="kp-name">${escapeHtml(st.s)} · ${escapeHtml(st.kp)}</span>
          <span class="kp-num">${done ? '✅ 已掌握' : `${st.mastered}/${st.total}`}${st.wrong ? ` <span class="kp-wrong">错题${st.wrong}</span>` : ''}</span></div>
        <div class="kp-bar"><i style="width:${st.pct}%"></i></div>
      </div>`;
    })
    .join('');
  const more =
    list.length > KP_LIMIT
      ? `<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:4px">仅显示前 ${KP_LIMIT} 个，共 ${list.length} 个知识点</div>`
      : '';
  return `<div class="kp-list">${rows}</div>${more}`;
}

/** 单条错题（可点击展开解析） */
function wrongItemHtml(key: string, rec: QuizRec, done: boolean): string {
  const open = expanded.has(key);
  const head = `<div class="si-top">${escapeHtml(rec.g || '综合')} · ${escapeHtml(rec.s)} · ${escapeHtml(rec.kp)}
      <span class="wb-tag">错 ${rec.w} 次</span>
      <span class="wb-tag ${done ? 'ok' : ''}">${done ? '已攻克' : `掌握 ${rec.c}/${MASTER_STREAK}`}</span>
      <span class="si-arrow">${open ? '▴' : '▾'}</span></div>
    <div class="wb-q">${escapeHtml(rec.text)}</div>`;
  let body = '';
  if (open) {
    const q = detail.get(key);
    if (q === undefined) {
      body = `<div class="si-detail">⏳ 正在加载题目解析…</div>`;
    } else if (q === null) {
      body = `<div class="si-detail">⚠️ 当前题库中未找到该题（可能来自外部题库或题目已调整），仅可回顾题干与知识点</div>`;
    } else {
      const opts = q.o
        .map((t, i) => {
          const ok = i === q.a;
          return `<div class="si-opt ${ok ? 'ok' : ''}">${String.fromCharCode(65 + i)}. ${escapeHtml(t)}${ok ? ' ✅' : ''}</div>`;
        })
        .join('');
      body = `<div class="si-detail">${opts}
        <div class="si-ans">正确答案 <b>${String.fromCharCode(65 + q.a)}</b> ｜ 知识点 ${escapeHtml(q.kp || '综合')}${q.u ? ` ｜ 单元 ${escapeHtml(q.u)}` : ''}</div></div>`;
    }
    if (!done) {
      body += `<button class="btn btn-sm si-mark" onclick="event.stopPropagation();markStudyReviewed('${key}')">✅ 我已复习（掌握 +1）</button>`;
    }
  }
  return `<div class="si-item ${done ? 'done' : ''}" onclick="toggleStudyItem('${key}')">${head}${body}</div>`;
}

function masteredHtml(): string {
  const list = masteredWrongList();
  const toggle = `<button class="btn btn-sm" onclick="toggleMasteredWrongs()">${showMastered ? '▴ 收起' : '▾ 展开'}（${list.length}）</button>`;
  if (!list.length) return `<div class="wb-empty">暂无已攻克错题${masteredCount() ? `（已掌握 ${masteredCount()} 道题）` : ''}</div>`;
  if (!showMastered) return `<div class="si-toggle">${toggle}</div>`;
  return `<div class="si-toggle">${toggle}</div><div class="study-list">${list
    .map(({ key, rec }) => wrongItemHtml(key, rec, true))
    .join('')}</div>`;
}

/** 渲染首页「我的学习情况」面板 */
export function renderStudyPanel(): void {
  const box = document.getElementById('studyPanel');
  if (!box) return;
  const wrong = wrongList();
  const tip = `<div class="study-tip">答错自动入错题本，同一知识点累计答对 ${MASTER_STREAK} 次即掌握；开始对局时错题会被优先抽到。</div>`;
  const wrongBody = wrong.length
    ? `<div class="study-list">${wrong
        .slice(0, WRONG_LIMIT)
        .map(({ key, rec }) => wrongItemHtml(key, rec, false))
        .join('')}</div>${
        wrong.length > WRONG_LIMIT
          ? `<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:4px">仅显示前 ${WRONG_LIMIT} 条，共 ${wrong.length} 条</div>`
          : ''
      }`
    : `<div class="wb-empty">🎉 暂无待复习错题，继续保持！</div>`;

  box.innerHTML =
    statsHtml(wrong.length) +
    tip +
    `<div class="study-sub">📚 知识点掌握</div>${kpHtml()}` +
    `<div class="study-sub">📕 待复习错题（${wrong.length}）</div>${wrongBody}` +
    `<div class="study-sub">🎓 已攻克错题</div>${masteredHtml()}`;
}

/** 展开 / 收起某条错题的解析（首次展开时按年级懒加载题库） */
export function toggleStudyItem(key: string): void {
  Sound.play('click');
  if (expanded.has(key)) {
    expanded.delete(key);
    renderStudyPanel();
    return;
  }
  expanded.add(key);
  renderStudyPanel();
  if (!detail.has(key)) void loadDetail(key);
}

async function loadDetail(key: string): Promise<void> {
  const rec = recByKey(key);
  if (!rec) return;
  let q = findQuestionByText(rec.text, rec.g);
  if (!q && rec.g) {
    await loadGrade(rec.g);
    q = findQuestionByText(rec.text, rec.g);
  }
  detail.set(key, q || null);
  if (expanded.has(key)) renderStudyPanel();
}

/** 展开 / 收起「已攻克错题」列表 */
export function toggleMasteredWrongs(): void {
  Sound.play('click');
  showMastered = !showMastered;
  renderStudyPanel();
}

/** 标记该题已复习：推进掌握进度一次，达标后自动移入「已攻克错题」 */
export function markStudyReviewed(key: string): void {
  const r = markReviewed(key);
  if (!r) return;
  expanded.delete(key);
  Sound.play('click');
  renderStudyPanel();
}

/** 学习档案被清空时同步重置展开状态 */
export function resetStudyPanel(): void {
  expanded.clear();
  detail.clear();
  showMastered = false;
  renderStudyPanel();
}
