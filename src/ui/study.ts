/* ==================== 首页：我的学习情况（知识点掌握 + 错题复习） ====================
 * 数据全部来自本地学习档案 PROFILE.quizRec（见 profile/quizbook.ts）：
 * · 知识点掌握：按「学科 + 知识点」聚合，显示已掌握 x/y 与进度
 * · 待复习错题：答错且尚未掌握（连对 < MASTER_STREAK），点击可展开原题解析
 * · 已攻克错题：曾经答错但已连对达标，单独折叠列表
 * 展开解析时才按年级懒加载题库（首屏不加载任何年级题库，保持懒加载不变式）
 */
import type { Question, QuizRec } from '../core/types';
import { escapeHtml } from '../core/dom';
import { addCredits, CREDIT_RULE } from '../profile/credits';
import { Sound } from '../core/sound';
import { shuffledIndices } from '../core/shuffle';
import { SUBJECT_ICON } from '../data/factions';
import { PROFILE } from '../profile/profile';
import {
  MASTER_STREAK,
  buildReviewSet,
  findQuestionByText,
  kpStats,
  markReviewed,
  masteredCount,
  masteredWrongList,
  recByKey,
  wrongByKp,
  wrongList,
} from '../profile/quizbook';
import { loadGrade } from '../data/bankLoader';

/** 已展开解析的错题 key */
const expanded = new Set<string>();
/** 复习面板每题的洗牌顺序缓存：展开期间保持稳定便于对照，收起即清除 */
const shuffleCache = new Map<string, number[]>();

/** 取该错题当前的洗牌顺序（判断题/四选一均按原始下标排列）；收起后重开换新顺序 */
function orderFor(key: string, n: number): number[] {
  let o = shuffleCache.get(key);
  if (!o || o.length !== n) {
    o = shuffledIndices(n);
    shuffleCache.set(key, o);
  }
  return o;
}
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
      const order = orderFor(key, q.o.length);
      const correctPos = order.indexOf(q.a);
      const opts = order
        .map((oi, i) => {
          const ok = i === correctPos;
          return `<div class="si-opt ${ok ? 'ok' : ''}">${String.fromCharCode(65 + i)}. ${escapeHtml(q.o[oi])}${ok ? ' ✅' : ''}</div>`;
        })
        .join('');
      body = `<div class="si-detail">${opts}
        <div class="si-ans">正确答案 <b>${String.fromCharCode(65 + correctPos)}</b> ｜ 知识点 ${escapeHtml(q.kp || '综合')}${q.u ? ` ｜ 单元 ${escapeHtml(q.u)}` : ''}</div></div>`;
    }
    if (!done) {
      body += `<div class="si-actions">
        <button class="btn btn-sm si-mark" onclick="event.stopPropagation();markStudyReviewed('${key}')">✅ 我已复习（掌握 +1）</button>
        <button class="btn btn-sm si-review" onclick="event.stopPropagation();startReviewByKey('${key}')">🔁 复习此知识点</button>
      </div>`;
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
    `<div class="study-sub study-sub-row"><span>📕 待复习错题（${wrong.length}）</span>${
      wrong.length ? '<button class="btn btn-sm study-review-btn" onclick="startReview()">📝 随机复习一组</button>' : ''
    }</div>${wrongBody}` +
    `<div class="study-sub">🎓 已攻克错题</div>${masteredHtml()}`;
}

/** 展开 / 收起某条错题的解析（首次展开时按年级懒加载题库） */
export function toggleStudyItem(key: string): void {
  Sound.play('click');
  if (expanded.has(key)) {
    expanded.delete(key);
    shuffleCache.delete(key); // 收起后重开换新顺序
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
  addCredits(CREDIT_RULE.perWrongFixed, 'wrongfix');
  expanded.delete(key);
  shuffleCache.delete(key);
  Sound.play('click');
  renderStudyPanel();
}

/** 学习档案被清空时同步重置展开状态 */
export function resetStudyPanel(): void {
  expanded.clear();
  shuffleCache.clear();
  detail.clear();
  showMastered = false;
  renderStudyPanel();
}

/* ==================== 首页复习模式（独立、仅练习不计入掌握度） ==================== */

interface ReviewItem {
  q: Question;
  /** 显示位置 i -> 原始下标 */
  order: number[];
  /** 正确项在当前显示顺序中的位置 */
  correctPos: number;
}

/** 复习队列与进度（模块级，关闭时重置） */
let reviewQueue: ReviewItem[] = [];
let reviewIdx = 0;
let reviewCorrect = 0;

/** 顶部「随机复习一组」：随机挑一个知识点的题组 */
export function startReview(kp?: string, s?: string): void {
  void runReview(kp, s);
}

/** 每条错题「复习此知识点」：由哈希 key 反查知识点后出题 */
export function startReviewByKey(key: string): void {
  const rec = recByKey(key);
  if (!rec) return;
  startReview(rec.kp || '综合', rec.s || '综合');
}

async function runReview(kp?: string, s?: string): Promise<void> {
  const groups = wrongByKp();
  if (!groups.length) {
    flashReviewMsg('暂无可复习的错题，先去对局里答题吧～');
    return;
  }
  const target = (kp && s && groups.find((g) => g.s === s && g.kp === kp)) || groups[Math.floor(Math.random() * groups.length)];
  const set = await buildReviewSet(target.s, target.kp, { limit: 6 });
  if (!set.length) {
    flashReviewMsg('该知识点暂无可复习题目（可能来自外部题库且未导入）');
    return;
  }
  reviewQueue = set.map((q) => {
    const order = shuffledIndices(q.o.length);
    return { q, order, correctPos: order.indexOf(q.a) };
  });
  reviewIdx = 0;
  reviewCorrect = 0;
  openReviewModal();
  renderReviewQuestion();
}

/** 打开复习弹窗（复用 #reviewModal 结构） */
function openReviewModal(): void {
  document.getElementById('reviewModal')?.classList.add('show');
}

/** 关闭复习：隐藏弹窗并刷新首页面板（掌握度未变，仅重置展开/缓存） */
export function closeReview(): void {
  document.getElementById('reviewModal')?.classList.remove('show');
  reviewQueue = [];
  reviewIdx = 0;
  reviewCorrect = 0;
  renderStudyPanel();
}

/** 渲染当前复习题（选项随机打乱） */
function renderReviewQuestion(): void {
  const item = reviewQueue[reviewIdx];
  if (!item) return;
  const q = item.q;
  const total = reviewQueue.length;
  document.getElementById('reviewIcon')!.textContent = SUBJECT_ICON[q.s] || '📖';
  document.getElementById('reviewSubject')!.textContent = `${q.s} · 知识点复习`;
  document.getElementById('reviewProgress')!.textContent = `第 ${reviewIdx + 1} / ${total} 题 · 知识点 ${q.kp || '综合'}`;
  document.getElementById('reviewKP')!.textContent = '知识点：' + (q.kp || '综合');
  document.getElementById('reviewQuestion')!.textContent = q.q;
  const opts = document.getElementById('reviewOptions')!;
  opts.innerHTML = item.order
    .map((oi, i) => `<button class="quiz-option" data-i="${i}" onclick="answerReview(${i})"><span class="tag">${String.fromCharCode(65 + i)}</span>${escapeHtml(q.o[oi])}</button>`)
    .join('');
  document.getElementById('reviewFeedback')!.textContent = '';
}

/** 作答：仅做展示判定（高亮正确答案 / 标记误选），不写入错题本与掌握度 */
export function answerReview(pos: number): void {
  const item = reviewQueue[reviewIdx];
  if (!item) return;
  const opts = document.getElementById('reviewOptions')!;
  const btns = [...opts.querySelectorAll('.quiz-option')] as HTMLButtonElement[];
  if (btns.every((b) => b.disabled)) return; // 已作答，避免重复
  btns.forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.i) === item.correctPos) b.classList.add('correct');
  });
  const chosen = btns[pos];
  const correct = pos >= 0 && item.order[pos] === item.q.a;
  if (!correct && chosen) chosen.classList.add('wrong');
  if (correct) {
    reviewCorrect++;
    addCredits(CREDIT_RULE.perReview, 'review');
  }
  const fb = document.getElementById('reviewFeedback')!;
  fb.style.color = correct ? '#1e7a3a' : '#a02020';
  fb.innerHTML = correct
    ? '✓ 答对！巩固得不错'
    : `✗ 正确答案 ${String.fromCharCode(65 + item.correctPos)}`;
  setTimeout(() => reviewNext(), 1500);
}

/** 进入下一题或小结 */
function reviewNext(): void {
  if (reviewIdx < reviewQueue.length - 1) {
    reviewIdx++;
    renderReviewQuestion();
  } else {
    renderReviewSummary();
  }
}

/** 题组答完后的小结 */
function renderReviewSummary(): void {
  const total = reviewQueue.length;
  document.getElementById('reviewIcon')!.textContent = '🎓';
  document.getElementById('reviewSubject')!.textContent = '复习完成';
  document.getElementById('reviewProgress')!.textContent = '';
  document.getElementById('reviewKP')!.textContent = '';
  document.getElementById('reviewQuestion')!.textContent = `本次复习 ${total} 题，答对 ${reviewCorrect} 题`;
  document.getElementById('reviewOptions')!.innerHTML = '';
  document.getElementById('reviewFeedback')!.innerHTML =
    `<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">` +
    `<button class="btn btn-sm" onclick="startReview()">📝 再来一组</button>` +
    `<button class="btn btn-sm" onclick="closeReview()">关闭</button></div>`;
}

/** 无题组时直接在弹窗内给出友好提示 */
function flashReviewMsg(text: string): void {
  openReviewModal();
  document.getElementById('reviewIcon')!.textContent = '📚';
  document.getElementById('reviewSubject')!.textContent = '复习';
  document.getElementById('reviewProgress')!.textContent = '';
  document.getElementById('reviewKP')!.textContent = '';
  document.getElementById('reviewQuestion')!.textContent = text;
  document.getElementById('reviewOptions')!.innerHTML = '';
  document.getElementById('reviewFeedback')!.innerHTML =
    `<div style="text-align:center;margin-top:8px"><button class="btn btn-sm" onclick="closeReview()">关闭</button></div>`;
}
