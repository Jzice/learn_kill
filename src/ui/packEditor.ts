/* ==================== 自定义扩展包 Web 表单编辑器 ====================
 * 让老师 / 学生无需写代码即可自制扩展包：
 *   - 元信息：id / 名称 / 作者 / 简介
 *   - 角色 / 锦囊：结构化表单「快捷添加」，效果用原语 JSON 填写（附模板）
 *   - 题目：按年级批量添加
 *   - 预览导出：实时 JSON、校验（含 PP 预算告警）、保存启用、导出 / 复制
 * 文本域 JSON 为唯一真源；结构化表单只是往 draft 里追加并重新序列化。
 */
import type { XtsPack, PackCharacter, PackCard } from '../data/packRegistry';
import { defaultPackTemplate, validatePack, installPack, removePack, getInstalledPacks } from '../data/packRegistry';
import { FACTIONS } from '../data/factions';
import { GRADE_ORDER } from '../data/grades';
import { escapeHtml } from '../core/dom';

let draft: XtsPack = defaultPackTemplate();
let editingId: string | null = null;

const SKILL_KINDS: { v: string; t: string }[] = [
  { v: 'active', t: '主动技（出牌阶段，需先答题）' },
  { v: 'trigger', t: '触发技（满足条件自动生效）' },
  { v: 'passive', t: '常驻被动（距离/手牌上限/免疫/转化等）' },
  { v: 'limit', t: '限定技（整局/每回合限一次）' },
  { v: 'awaken', t: '觉醒技' },
  { v: 'lord', t: '主公技' },
  { v: 'convert', t: '转化技（手牌当某牌用）' },
];
const TIMINGS: { v: string; t: string }[] = [
  { v: 'active', t: '出牌阶段主动发动' },
  { v: 'passive', t: '常驻状态' },
  { v: 'onTurnStart', t: '准备阶段' },
  { v: 'onDraw', t: '摸牌阶段' },
  { v: 'onTurnEnd', t: '回合结束' },
  { v: 'beforeJudge', t: '判定牌生效前' },
  { v: 'beforeDamage', t: '伤害结算前' },
  { v: 'onDamaged', t: '受到伤害后' },
  { v: 'onTargetSha', t: '成为杀的目标时' },
  { v: 'onUseShan', t: '使用/打出闪后' },
  { v: 'onShaHit', t: '杀造成伤害后' },
  { v: 'onUseTrick', t: '使用锦囊后' },
];

function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return el ? el.value : '';
}
function num(id: string): number {
  const n = Number(val(id));
  return Number.isFinite(n) ? n : 0;
}
function status(msg: string, kind: 'ok' | 'err' | 'warn' = 'ok'): void {
  const el = document.getElementById('peStatus');
  if (el) {
    el.textContent = msg;
    el.className = 'pe-status ' + kind;
  }
}

function factionOptions(): string {
  return Object.entries(FACTIONS)
    .map(([k, f]) => `<option value="${k}">${f.icon} ${f.name}</option>`)
    .join('');
}
function gradeOptions(): string {
  return GRADE_ORDER.map((g) => `<option value="${g}">${g}</option>`).join('');
}
function skillKindOptions(): string {
  return SKILL_KINDS.map((o) => `<option value="${o.v}">${o.t}</option>`).join('');
}
function timingOptions(): string {
  return TIMINGS.map((o) => `<option value="${o.v}">${o.t}</option>`).join('');
}

function syncJson(): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (ta) ta.value = JSON.stringify(draft, null, 2);
}

function renderEditor(): void {
  const body = document.getElementById('packEditorBody');
  if (!body) return;
  body.innerHTML = `
    <div class="pe-section">
      <h4>① 元信息</h4>
      <div class="pe-row"><label>包ID</label><input id="peId" class="pe-input" value="${escapeHtml(draft.id)}" placeholder="建议 custom_ 前缀，全局唯一"></div>
      <div class="pe-row"><label>名称</label><input id="peName" class="pe-input" value="${escapeHtml(draft.name)}" placeholder="展示名"></div>
      <div class="pe-row"><label>作者</label><input id="peAuthor" class="pe-input" value="${escapeHtml(draft.author || '')}"></div>
      <div class="pe-row"><label>简介</label><input id="peDesc" class="pe-input" value="${escapeHtml(draft.desc || '')}"></div>
      <button class="btn btn-sm" onclick="peApplyMeta()">应用元信息</button>
    </div>

    <div class="pe-section">
      <h4>② 快捷添加角色</h4>
      <div class="pe-row"><label>id</label><input id="pcId" class="pe-input" placeholder="角色ID，建议与包ID关联"></div>
      <div class="pe-row"><label>名称</label><input id="pcName" class="pe-input"></div>
      <div class="pe-row"><label>称号</label><input id="pcTitle" class="pe-input"></div>
      <div class="pe-row"><label>阵营</label><select id="pcFaction">${factionOptions()}</select></div>
      <div class="pe-row"><label>学科</label><input id="pcSubject" class="pe-input" placeholder="与阵营对应中文名"></div>
      <div class="pe-row"><label>体力</label><input id="pcHp" class="pe-input" type="number" min="2" max="5" value="4"></div>
      <div class="pe-row"><label>头像</label><input id="pcAvatar" class="pe-input" maxlength="4" placeholder="🧑"></div>
      <div class="pe-row"><label>年级</label><select id="pcGrade">${gradeOptions()}</select></div>
      <div class="pe-sub">技能 1</div>
      <div class="pe-row"><label>名</label><input id="pcS1Name" class="pe-input"></div>
      <div class="pe-row"><label>id</label><input id="pcS1Id" class="pe-input"></div>
      <div class="pe-row"><label>类型</label><select id="pcS1Kind">${skillKindOptions()}</select></div>
      <div class="pe-row"><label>时机</label><select id="pcS1Timing">${timingOptions()}</select></div>
      <div class="pe-row"><label>描述</label><input id="pcS1Desc" class="pe-input"></div>
      <div class="pe-row"><label>效果</label><textarea id="pcS1Fx" class="pe-ta" placeholder='[{"kind":"costCard","n":1},{"kind":"selfDraw","n":2}]'></textarea></div>
      <div class="pe-sub">技能 2（可选）</div>
      <div class="pe-row"><label>名</label><input id="pcS2Name" class="pe-input"></div>
      <div class="pe-row"><label>id</label><input id="pcS2Id" class="pe-input"></div>
      <div class="pe-row"><label>类型</label><select id="pcS2Kind">${skillKindOptions()}</select></div>
      <div class="pe-row"><label>时机</label><select id="pcS2Timing">${timingOptions()}</select></div>
      <div class="pe-row"><label>描述</label><input id="pcS2Desc" class="pe-input"></div>
      <div class="pe-row"><label>效果</label><textarea id="pcS2Fx" class="pe-ta" placeholder='留空则只加技能1'></textarea></div>
      <button class="btn btn-sm btn-accent" onclick="peAddCharacter()">➕ 添加到包</button>
    </div>

    <div class="pe-section">
      <h4>③ 快捷添加锦囊</h4>
      <div class="pe-row"><label>key</label><input id="pkKey" class="pe-input" placeholder="卡牌 sub，建议 custom_ 前缀"></div>
      <div class="pe-row"><label>名称</label><input id="pkName" class="pe-input"></div>
      <div class="pe-row"><label>学科</label><select id="pkSubject">${factionOptions()}<option value="campus">🏫 校园</option></select></div>
      <div class="pe-row"><label>玩法</label><select id="pkKind"><option value="strategy">策略（直接生效）</option><option value="quiz">答题（答对生效）</option></select></div>
      <div class="pe-row"><label>目标</label><select id="pkTarget"><option value="none">无需目标</option><option value="one">指定一名角色</option></select></div>
      <div class="pe-row"><label>投放</label><input id="pkDeck" class="pe-input" type="number" min="1" max="4" value="1"></div>
      <div class="pe-row"><label>描述</label><input id="pkDesc" class="pe-input"></div>
      <div class="pe-row"><label>答题学科</label><input id="pkQuiz" class="pe-input" placeholder="quiz 型填写，如 物理"></div>
      <div class="pe-row"><label>效果</label><textarea id="pkFx" class="pe-ta" placeholder='[{"kind":"allDraw","n":1}]'></textarea></div>
      <button class="btn btn-sm btn-accent" onclick="peAddCard()">➕ 添加到包</button>
    </div>

    <div class="pe-section">
      <h4>④ 快捷添加题目</h4>
      <div class="pe-row"><label>年级</label><select id="pqGrade">${gradeOptions()}</select></div>
      <div class="pe-row"><label>题干</label><input id="pqQ" class="pe-input"></div>
      <div class="pe-row"><label>选项</label><input id="pqO" class="pe-input" placeholder="逗号分隔，如 A,B,C,D"></div>
      <div class="pe-row"><label>正确</label><input id="pqA" class="pe-input" type="number" min="0" value="0"></div>
      <div class="pe-row"><label>科目</label><input id="pqS" class="pe-input" placeholder="如 物理"></div>
      <div class="pe-row"><label>知识点</label><input id="pqKp" class="pe-input"></div>
      <button class="btn btn-sm btn-accent" onclick="peAddQuestion()">➕ 添加到包</button>
    </div>

    <div class="pe-section">
      <h4>⑤ 预览 / 校验 / 导出</h4>
      <textarea id="peJson" class="pe-json" spellcheck="false"></textarea>
      <div class="opt-row" style="margin:6px 0;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="peLoadJson()">从上方 JSON 载入</button>
        <button class="btn btn-sm" onclick="peValidate()">🔍 校验</button>
        <button class="btn btn-sm" onclick="peCopy()">📋 复制</button>
        <button class="btn btn-sm" onclick="peExport()">💾 导出 .json</button>
        <button class="btn btn-sm btn-accent" onclick="peSave()">✅ 保存并启用</button>
      </div>
      <div id="peStatus" class="pe-status"></div>
    </div>
  `;
  syncJson();
}

/* ---------------- 全局处理函数（inline onclick 调用） ---------------- */

export function openPackEditor(id?: string): void {
  if (id) {
    const p = getInstalledPacks().find((x) => x.id === id);
    draft = p ? { ...p } : defaultPackTemplate();
    editingId = id;
  } else {
    draft = defaultPackTemplate();
    editingId = null;
  }
  renderEditor();
  document.getElementById('packEditorModal')!.classList.add('show');
}

export function closePackEditor(): void {
  document.getElementById('packEditorModal')!.classList.remove('show');
}

function parseEffects(id: string): { fx: any[]; err?: string } {
  const t = val(id).trim();
  if (!t) return { fx: [] };
  try {
    const fx = JSON.parse(t);
    if (!Array.isArray(fx)) return { fx: [], err: '效果必须是一个 JSON 数组' };
    return { fx };
  } catch (e) {
    return { fx: [], err: '效果 JSON 解析失败：' + (e as Error).message };
  }
}

(window as any).closePackEditor = closePackEditor;

(window as any).peApplyMeta = function (): void {
  draft.id = val('peId').trim() || 'my_pack';
  draft.name = val('peName').trim() || '我的扩展包';
  draft.author = val('peAuthor').trim();
  draft.desc = val('peDesc').trim();
  syncJson();
  status('元信息已应用', 'ok');
};

(window as any).peAddCharacter = function (): void {
  const id = val('pcId').trim();
  const name = val('pcName').trim();
  if (!id || !name) return status('角色 id 与名称必填', 'err');
  const skills: any[] = [];
  const s1Name = val('pcS1Name').trim();
  if (s1Name) {
    const e1 = parseEffects('pcS1Fx');
    if (e1.err) return status(e1.err, 'err');
    skills.push({
      id: val('pcS1Id').trim() || id + '_sk1',
      name: s1Name,
      kind: val('pcS1Kind'),
      timing: val('pcS1Timing'),
      desc: val('pcS1Desc').trim(),
      effects: e1.fx,
    });
  }
  const s2Name = val('pcS2Name').trim();
  if (s2Name) {
    const e2 = parseEffects('pcS2Fx');
    if (e2.err) return status(e2.err, 'err');
    skills.push({
      id: val('pcS2Id').trim() || id + '_sk2',
      name: s2Name,
      kind: val('pcS2Kind'),
      timing: val('pcS2Timing'),
      desc: val('pcS2Desc').trim(),
      effects: e2.fx,
    });
  }
  if (!skills.length) return status('至少需要一个技能', 'err');
  const c: PackCharacter = {
    id, name, title: val('pcTitle').trim() || name,
    faction: val('pcFaction') as any, subject: val('pcSubject').trim() || '综合',
    hp: num('pcHp') || 4, avatar: val('pcAvatar').trim() || '🧑',
    grade: val('pcGrade'), skills,
  };
  draft.characters = draft.characters || [];
  draft.characters.push(c);
  syncJson();
  status(`已添加角色「${name}」（当前角色 ${draft.characters.length}）`, 'ok');
};

(window as any).peAddCard = function (): void {
  const key = val('pkKey').trim();
  const name = val('pkName').trim();
  if (!key || !name) return status('锦囊 key 与名称必填', 'err');
  const e = parseEffects('pkFx');
  if (e.err) return status(e.err, 'err');
  const card: PackCard = {
    key, name, subject: val('pkSubject') as any, kind: val('pkKind') as any,
    target: val('pkTarget') as any, desc: val('pkDesc').trim(),
    deck: num('pkDeck') || 1, effects: e.fx,
  };
  if (val('pkQuiz').trim()) (card as any).quizSubject = val('pkQuiz').trim();
  draft.cards = draft.cards || [];
  draft.cards.push(card);
  syncJson();
  status(`已添加锦囊「${name}」（当前锦囊 ${draft.cards.length}）`, 'ok');
};

(window as any).peAddQuestion = function (): void {
  const g = val('pqGrade');
  const q = val('pqQ').trim();
  const o = val('pqO').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const a = num('pqA');
  if (!q || o.length < 2) return status('题干与至少 2 个选项必填', 'err');
  if (a < 0 || a >= o.length) return status('正确选项下标越界', 'err');
  draft.questions = draft.questions || {};
  draft.questions[g] = draft.questions[g] || [];
  draft.questions[g].push({ s: val('pqS').trim() || '综合', kp: val('pqKp').trim() || '综合', q, o, a });
  syncJson();
  status(`已添加题目到「${g}」（当前题 ${Object.values(draft.questions).reduce((s, x) => s + x.length, 0)}）`, 'ok');
};

(window as any).peLoadJson = function (): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (!ta) return;
  try {
    draft = JSON.parse(ta.value);
    status('已从 JSON 载入', 'ok');
  } catch (e) {
    status('JSON 解析失败：' + (e as Error).message, 'err');
  }
};

(window as any).peValidate = function (): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (!ta) return;
  let data: unknown;
  try {
    data = JSON.parse(ta.value);
  } catch (e) {
    return status('JSON 解析失败：' + (e as Error).message, 'err');
  }
  const r = validatePack(data);
  if (r.ok) {
    const w = r.warnings.length ? '⚠️ 告警：\n' + r.warnings.join('\n') : '✅ 校验通过，无告警';
    status('校验通过', 'ok');
    alert('✅ 校验通过\n\n' + (r.warnings.length ? r.warnings.join('\n') : '（无平衡性告警）'));
  } else {
    status('校验失败：' + r.errors.length + ' 项错误', 'err');
    alert('❌ 校验失败：\n' + r.errors.join('\n'));
  }
};

(window as any).peCopy = function (): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (ta && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => status('已复制到剪贴板', 'ok'));
};

(window as any).peExport = function (): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (!ta) return;
  const blob = new Blob([ta.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (draft.id || 'pack') + '.pack.json';
  a.click();
  URL.revokeObjectURL(url);
  status('已导出 ' + a.download, 'ok');
};

(window as any).peSave = function (): void {
  const ta = document.getElementById('peJson') as HTMLTextAreaElement | null;
  if (!ta) return;
  let data: unknown;
  try {
    data = JSON.parse(ta.value);
  } catch (e) {
    return status('JSON 解析失败：' + (e as Error).message, 'err');
  }
  // 若是编辑已有包，先移除旧版本再安装（避免 id 冲突叠加）
  if (editingId && editingId !== (data as any).id) removePack(editingId);
  const r = installPack(data);
  if (!r.ok) {
    status('保存失败', 'err');
    alert('❌ 保存失败：\n' + r.errors.join('\n'));
    return;
  }
  status('已保存并启用：' + r.pack!.name, 'ok');
  closePackEditor();
  // 刷新大厅的包列表与选将池
  const w = window as any;
  if (w.renderPackList) w.renderPackList();
  if (w.renderCharPicker) w.renderCharPicker();
  if (w.renderFactionPicker) w.renderFactionPicker();
  if (w.renderPacketPicker) w.renderPacketPicker();
};
