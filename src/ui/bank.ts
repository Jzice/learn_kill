/* ==================== 题库浏览界面（顶栏入口） ====================
 * 年级切换 → 懒加载该年级 → 按科目 / 单元分组渲染题干 + 选项 + 答案。
 * 不依赖 lobby.ts，避免循环引用（屏幕切换在此处内联实现）。
 */
import type { Question } from '../core/types';
import { escapeHtml } from '../core/dom';
import { Sound } from '../core/sound';
import { QUESTION_BANK, loadGrade, sortedGrades } from '../data/bankLoader';
import { SUBJECT_ICON } from '../data/factions';

const state = { grade: '', search: '', subject: '' as string };

/** 打开题库浏览前的界面（用于返回按钮回到原界面） */
let prevScreen = 'screenLobby';

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function bankItemHtml(q: Question, i: number): string {
  const opts = q.o
    .map((o, j) => `<div class="bo ${j === q.a ? 'ans' : ''}">${'ABCD'[j]}. ${escapeHtml(o)}${j === q.a ? ' ✓' : ''}</div>`)
    .join('');
  return `<div class="bank-item"><div>${i + 1}. ${escapeHtml(q.q)}</div>${opts}` +
    `<div class="bkp">${escapeHtml(q.u || '综合')} · ${escapeHtml(q.kp || '')}</div></div>`;
}

function renderBody(): void {
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
    void openBankBrowser();
  };
}

function renderSubjectFilter(): void {
  const sel = document.getElementById('bankSubjectFilter') as HTMLSelectElement | null;
  if (!sel) return;
  const qs = QUESTION_BANK[state.grade] || [];
  const present = [...new Set(qs.map((q) => q.s))];
  const cur = present.includes(state.subject) ? state.subject : '';
  sel.innerHTML = '<option value="">全部科目</option>' + present.map((s) => `<option>${escapeHtml(s)}</option>`).join('');
  sel.value = cur;
}

export function openBankBrowser(): void {
  Sound.play('click');
  const cur = document.querySelector<HTMLElement>('.screen.active');
  prevScreen = cur ? cur.id : 'screenLobby';
  showScreen('screenBank');
  renderGradePicker();
  void loadGrade(state.grade).then(() => {
    renderSubjectFilter();
    renderBody();
  });
}

/** 返回打开题库前的界面（大厅或游戏） */
export function closeBankBrowser(): void {
  Sound.play('click');
  showScreen(prevScreen);
}

/** 在 init 中调用一次：绑定搜索框与科目筛选 */
export function bindBankBrowser(): void {
  document.getElementById('bankSearch')?.addEventListener('input', (e) => {
    state.search = (e.target as HTMLInputElement).value.trim();
    renderBody();
  });
  document.getElementById('bankSubjectFilter')?.addEventListener('change', (e) => {
    state.subject = (e.target as HTMLSelectElement).value;
    renderBody();
  });
}
