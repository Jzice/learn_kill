/* ==================== 题库浏览界面（顶栏入口） ====================
 * 年级切换 → 懒加载该年级 → 按科目 / 单元分组渲染题干 + 选项 + 答案。
 * 不依赖 lobby.ts，避免循环引用（屏幕切换在此处内联实现）。
 */
import type { Question } from '../core/types';
import { escapeHtml } from '../core/dom';
import { fmtFormula } from '../core/formula';
import { Sound } from '../core/sound';
import { QUESTION_BANK, loadGrade, sortedGrades } from '../data/bankLoader';
import { SUBJECT_ICON } from '../data/factions';
import { renderKpMap, renderKpNotes } from './knowledge';

/** 题库页视图：题目 / 知识点讲解 / 知识脑图 */
type BankView = 'q' | 'k' | 'map';
const VIEWS: { id: BankView; label: string }[] = [
  { id: 'q', label: '📖 题目' },
  { id: 'k', label: '📘 讲解' },
  { id: 'map', label: '🧠 脑图' },
];
const state = { grade: '', search: '', subject: '' as string, view: 'q' as BankView };

/** 打开题库浏览前的界面（用于返回按钮回到原界面） */
let prevScreen = 'screenLobby';

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function bankItemHtml(q: Question, i: number): string {
  const opts = q.o
    .map((o, j) => `<div class="bo ${j === q.a ? 'ans' : ''}">${'ABCD'[j]}. ${fmtFormula(o)}${j === q.a ? ' ✓' : ''}</div>`)
    .join('');
  return `<div class="bank-item"><div>${i + 1}. ${fmtFormula(q.q)}</div>${opts}` +
    `<div class="bkp">${escapeHtml(q.u || '综合')} · ${escapeHtml(q.kp || '')}</div></div>`;
}

async function renderBody(): Promise<void> {
  // 讲解 / 脑图视图：展示知识图谱（讲解随题库分片一起懒加载）
  if (state.view !== 'q') {
    const body = document.getElementById('bankBody');
    if (!body) return;
    body.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:12px;text-align:center">加载中…</div>';
    body.innerHTML =
      state.view === 'k'
        ? await renderKpNotes(state.grade, state.subject)
        : await renderKpMap(state.grade, state.subject);
    return;
  }
  const list = (QUESTION_BANK[state.grade] || []).filter((q) => {
    if (state.subject && q.s !== state.subject) return false;
    if (state.search) {
      const k = state.search.toLowerCase();
      if (!(`${q.q} ${q.kp || ''} ${q.u || ''}`.toLowerCase().includes(k))) return false;
    }
    return true;
  });
  const body = document.getElementById('bankBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:12px;text-align:center">未找到匹配题目</div>';
    return;
  }
  const bySubject = new Map<string, Question[]>();
  for (const q of list) {
    const arr = bySubject.get(q.s) || [];
    arr.push(q);
    bySubject.set(q.s, arr);
  }
  body.innerHTML = [...bySubject.entries()]
    .map(([s, arr]) => {
      const byUnit = new Map<string, Question[]>();
      for (const q of arr) {
        const k = q.u || '综合';
        const a2 = byUnit.get(k) || [];
        a2.push(q);
        byUnit.set(k, a2);
      }
      return (
        `<div class="bank-subject"><h4>${SUBJECT_ICON[s] || '📘'} ${escapeHtml(s)}（${arr.length} 题）</h4>` +
        [...byUnit.entries()]
          .map(([u, a2]) => `<div class="bank-unit"><h5>${escapeHtml(u)}</h5>${a2.map(bankItemHtml).join('')}</div>`)
          .join('') +
        '</div>'
      );
    })
    .join('');
}

function renderGradePicker(): void {
  const box = document.getElementById('bankGradePicker');
  if (!box) return;
  const grades = sortedGrades();
  if (!state.grade) state.grade = grades[0] || '';
  box.innerHTML = grades
    .map((g) => `<button class="opt-btn ${g === state.grade ? 'active' : ''}" data-grade="${g}">${g}</button>`)
    .join('');
  box.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b || !b.dataset.grade) return;
    state.grade = b.dataset.grade;
    Sound.play('click');
    // 切换年级：仅刷新内容，不重设返回目标（避免 prevScreen 被题库页自身覆盖）
    renderGradePicker();
    void loadGrade(state.grade).then(() => {
      renderSubjectFilter();
      void renderBody();
    });
  };
}

/** 视图切换：题目 / 知识点讲解 / 知识脑图 */
function renderViewPicker(): void {
  const box = document.getElementById('bankViewPicker');
  if (!box) return;
  box.innerHTML = VIEWS.map(
    (v) => `<button class="opt-btn ${v.id === state.view ? 'active' : ''}" data-view="${v.id}">${v.label}</button>`,
  ).join('');
  box.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b || !b.dataset.view) return;
    state.view = b.dataset.view as BankView;
    Sound.play('click');
    renderViewPicker();
    syncToolbar();
    void renderBody();
  };
}

/** 搜索框只在题目视图下有意义 */
function syncToolbar(): void {
  const bar = document.getElementById('bankToolbar');
  if (bar) bar.style.display = state.view === 'q' ? '' : 'none';
}

function renderSubjectFilter(): void {
  const box = document.getElementById('bankSubjectPicker');
  if (!box) return;
  const qs = QUESTION_BANK[state.grade] || [];
  const present = [...new Set(qs.map((q) => q.s))];
  const cur = present.includes(state.subject) ? state.subject : '';
  const all = `<button class="opt-btn ${cur === '' ? 'active' : ''}" data-subject="">全部</button>`;
  box.innerHTML =
    all +
    present
      .map(
        (s) =>
          `<button class="opt-btn ${s === cur ? 'active' : ''}" data-subject="${escapeHtml(s)}">${SUBJECT_ICON[s] || '📘'} ${escapeHtml(s)}</button>`,
      )
      .join('');
  box.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b) return;
    state.subject = b.dataset.subject || '';
    Sound.play('click');
    renderSubjectFilter();
    void renderBody();
  };
}

export function openBankBrowser(): void {
  Sound.play('click');
  const cur = document.querySelector<HTMLElement>('.screen.active');
  // 仅在真正「从别的界面进入」时记录返回目标；题库页内部切换不得覆盖，否则返回会原地不动
  if (cur && cur.id !== 'screenBank') prevScreen = cur.id;
  showScreen('screenBank');
  renderGradePicker();
  renderViewPicker();
  syncToolbar();
  void loadGrade(state.grade).then(() => {
    renderSubjectFilter();
    void renderBody();
  });
}

/** 从知识点讲解 / 脑图跳回题目视图并搜索该知识点（由 knowledge.ts 的卡片按钮调用） */
export function bankSearchKp(kp: string): void {
  state.search = kp;
  state.view = 'q';
  const input = document.getElementById('bankSearch') as HTMLInputElement | null;
  if (input) input.value = kp;
  Sound.play('click');
  renderViewPicker();
  syncToolbar();
  void renderBody();
}

/** 返回打开题库前的界面（大厅或游戏） */
export function closeBankBrowser(): void {
  Sound.play('click');
  // 兜底：任何异常情况下都不允许「返回」停在题库页自己
  showScreen(prevScreen && prevScreen !== 'screenBank' ? prevScreen : 'screenLobby');
}

/** 刷题入口上下文：当前浏览的学期与科目筛选（供 drill.ts 抽题） */
export function bankDrillContext(): { grade: string; subject: string } {
  return { grade: state.grade, subject: state.subject };
}

/** 在 init 中调用一次：绑定搜索框（科目筛选改为选项按钮，事件在 renderSubjectFilter 内委托） */
export function bindBankBrowser(): void {
  document.getElementById('bankSearch')?.addEventListener('input', (e) => {
    state.search = (e.target as HTMLInputElement).value.trim();
    void renderBody();
  });
}
