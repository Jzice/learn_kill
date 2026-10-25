/* ==================== 题库刷题（练题赚学分） ====================
 * 入口：题库浏览界面「📝 刷题」按钮。按当前浏览的学期（+ 科目筛选）抽一组题逐题作答：
 *   - 答对按年级梯度获得学分（quizCreditFor），连对达标另有奖励；
 *   - 仅练习，不写入错题本 / 掌握度，也不影响对局。
 * 结构镜像首页复习弹窗（复用 .quiz-* 样式），但队列来自题库而非错题本。
 */
import type { Question } from '../core/types';
import { fmtFormula } from '../core/formula';
import { Sound } from '../core/sound';
import { shuffledIndices } from '../core/shuffle';
import { SUBJECT_ICON } from '../data/factions';
import { QUESTION_BANK, loadGrade } from '../data/bankLoader';
import {
  addCredits,
  credits,
  CREDIT_RULE,
  earnedToday,
  quizCreditFor,
} from '../profile/credits';
import { bankDrillContext } from './bank';
import { bumpMission } from '../profile/missions';
import { addPassExp } from '../profile/pass';
import { checkLearningAchievements } from '../profile/learningAch';
import { PROFILE, saveProfile } from '../profile/profile';

/** 每组题数 */
export const DRILL_SIZE = 10;
/** 连对奖励：每连对 COMBO_STEP 题额外奖励 COMBO_BONUS 学分 */
const COMBO_STEP = 3;
const COMBO_BONUS = 2;

interface DrillItem {
  q: Question;
  order: number[];
  correctPos: number;
}

/** 刷题队列与进度（模块级，关闭即重置） */
let queue: DrillItem[] = [];
let idx = 0;
let correct = 0;
let combo = 0;
let gained = 0;
let grade = '';
let subject = '';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setText(id: string, v: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

/** 题干含化学式 / 公式时需要 innerHTML（fmtFormula 内部已完成转义） */
function setHtml(id: string, v: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = v;
}

/** 开始一组刷题（按题库浏览当前的学期 / 科目筛选抽题） */
export async function startDrill(): Promise<void> {
  const ctx = bankDrillContext();
  grade = ctx.grade;
  subject = ctx.subject;
  await loadGrade(grade); // 按需懒加载该学期题库
  const pool = (QUESTION_BANK[grade] || []).filter((q) => !subject || q.s === subject);
  if (!pool.length) {
    flashDrillMsg('该范围暂无可刷的题目（可切换学期 / 科目，或到首页导入题库）');
    return;
  }
  queue = shuffle(pool)
    .slice(0, DRILL_SIZE)
    .map((q) => {
      const order = shuffledIndices(q.o.length);
      return { q, order, correctPos: order.indexOf(q.a) };
    });
  idx = 0;
  correct = 0;
  combo = 0;
  gained = 0;
  document.getElementById('drillModal')?.classList.add('show');
  renderDrillQuestion();
}

/** 渲染当前刷题（选项随机打乱） */
function renderDrillQuestion(): void {
  const item = queue[idx];
  if (!item) return;
  const q = item.q;
  setText('drillIcon', SUBJECT_ICON[q.s] || '📖');
  setText('drillSubject', `${q.s} · ${grade}${subject ? ' · ' + subject : ''} 刷题`);
  setText('drillProgress', `第 ${idx + 1} / ${queue.length} 题 · 答对 ${correct} · 连对 ${combo}`);
  setText('drillKP', '知识点：' + (q.kp || '综合'));
  setHtml('drillQuestion', fmtFormula(q.q));
  const opts = document.getElementById('drillOptions');
  if (opts) {
    opts.innerHTML = item.order
      .map(
        (oi, i) =>
          `<button class="quiz-option" data-i="${i}" onclick="answerDrill(${i})"><span class="tag">${String.fromCharCode(65 + i)}</span>${fmtFormula(q.o[oi])}</button>`,
      )
      .join('');
  }
  setText('drillFeedback', '');
}

/** 作答：判定 + 音效 + 学分（答对按年级梯度，连对达标额外奖励） */
export function answerDrill(pos: number): void {
  const item = queue[idx];
  if (!item) return;
  const opts = document.getElementById('drillOptions');
  if (!opts) return;
  const btns = [...opts.querySelectorAll('.quiz-option')] as HTMLButtonElement[];
  if (btns.every((b) => b.disabled)) return; // 已作答，避免重复
  btns.forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.i) === item.correctPos) b.classList.add('correct');
  });
  const chosen = btns[pos];
  const ok = pos >= 0 && item.order[pos] === item.q.a;
  Sound.play(ok ? 'correct' : 'wrong');
  if (!ok && chosen) chosen.classList.add('wrong');

  const fb = document.getElementById('drillFeedback');
  if (ok) {
    correct++;
    combo++;
    bumpMission('quiz'); // 每日任务埋点（日课·答对）
    bumpMission('combo', combo); // 日课·连对（取当日最大值）
    addPassExp(2); // 战令经验：答对 +2
    let add = quizCreditFor(item.q.g || grade);
    let bonus = 0;
    if (combo % COMBO_STEP === 0) {
      bonus = COMBO_BONUS;
      add += bonus;
    }
    const got = addCredits(add, 'drill'); // 受每日上限约束，触顶则入账被截断
    gained += got;
    if (fb) {
      fb.style.color = '#1e7a3a';
      const hitCap = got < add;
      fb.innerHTML =
        `✓ 答对！+${got} 学分${bonus ? `（连对 ${combo} 奖励 +${bonus}）` : ''}` +
        (hitCap ? '<br><span style="font-size:10.5px;color:#8a6a10">今日学分已到上限，多余部分未入账</span>' : '');
    }
  } else {
    combo = 0;
    if (fb) {
      fb.style.color = '#a02020';
      fb.innerHTML = `✗ 正确答案 ${String.fromCharCode(65 + item.correctPos)}`;
    }
  }
  setTimeout(() => {
    idx++;
    if (idx < queue.length) renderDrillQuestion();
    else renderDrillSummary();
  }, 1400);
}

/** 一组刷完的小结 */
function renderDrillSummary(): void {
  // 刷题连对也计入最高连击（成就「十连绝世」口径）
  if (combo > (PROFILE.maxCombo || 0)) {
    PROFILE.maxCombo = combo;
    saveProfile();
  }
  checkLearningAchievements();
  setText('drillIcon', '🎓');
  setText('drillSubject', '刷题完成');
  setText('drillProgress', '');
  setText('drillKP', '');
  setText('drillQuestion', `本次 ${queue.length} 题，答对 ${correct} 题`);
  const opts = document.getElementById('drillOptions');
  if (opts) opts.innerHTML = '';
  const fb = document.getElementById('drillFeedback');
  if (fb) {
    fb.style.color = '#8a6a10';
    fb.innerHTML =
      `<div>获得学分 <b style="color:#f5c542">+${gained}</b>（当前学分 ${credits()}，今日 ${earnedToday()}/${CREDIT_RULE.dailyCap}）</div>` +
      `<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">` +
      `<button class="btn btn-sm btn-accent" onclick="startDrill()">📝 再来一组</button>` +
      `<button class="btn btn-sm" onclick="closeDrill()">关闭</button></div>`;
  }
}

/** 无题可刷时在弹窗内给出友好提示 */
function flashDrillMsg(text: string): void {
  document.getElementById('drillModal')?.classList.add('show');
  setText('drillIcon', '📚');
  setText('drillSubject', '刷题');
  setText('drillProgress', '');
  setText('drillKP', '');
  setText('drillQuestion', text);
  const opts = document.getElementById('drillOptions');
  if (opts) opts.innerHTML = '';
  const fb = document.getElementById('drillFeedback');
  if (fb) {
    fb.style.color = 'var(--muted)';
    fb.innerHTML = `<div style="text-align:center;margin-top:8px"><button class="btn btn-sm" onclick="closeDrill()">关闭</button></div>`;
  }
}

/** 关闭刷题弹窗 */
export function closeDrill(): void {
  document.getElementById('drillModal')?.classList.remove('show');
  queue = [];
  idx = 0;
  correct = 0;
  combo = 0;
  gained = 0;
}
