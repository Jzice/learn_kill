/* ==================== 知识图谱：知识点讲解 + 知识脑图 ====================
 * 数据全部来自题库分片里随题目一起注入的 k（讲解）与 r（关系）：
 *   public/banks/<学期>/<学科>.js → window.__XTS_BANK__['<学期>/<学科>'] = { q, k, r }
 * 因此与题库懒加载保持一致：切到讲解 / 脑图视图时才加载对应学科分片，首屏不加载。
 *
 * 两个视图：
 *   · 讲解（renderKpNotes）：按「学科 → 单元」分组的知识点卡片，展开看概要 / 要点 / 易错 / 关系
 *   · 脑图（renderKpMap）：SVG 关系图，节点为知识点，边按 前置 / 包含 / 应用 / 对比 分色，
 *                          按前置关系分层布局（前置在上、后继在下），点击节点看讲解
 */
import type { KnowledgeNote, KpRelation, KpRelationType } from '../core/types';
import { escapeHtml } from '../core/dom';
import { Sound } from '../core/sound';
import {
  getNotes,
  getRelations,
  loadSubject,
  QUESTION_BANK,
  subjectsOf,
} from '../data/bankLoader';
import { SUBJECT_ICON } from '../data/factions';
import { kpStats } from '../profile/quizbook';

/** 关系类型的中文名与配色（与 build-banks 的 prereq/contains/apply/contrast 对应） */
const TYPE_LABEL: Record<KpRelationType, string> = {
  prereq: '前置',
  contains: '包含',
  apply: '应用',
  contrast: '对比',
};
const TYPE_COLOR: Record<KpRelationType, string> = {
  prereq: '#f5c542',
  contains: '#8fd0ff',
  apply: '#7ee2a8',
  contrast: '#e88b7f',
};
/** 边的线型：前置实线，包含虚线，应用点线，对比点划线 */
const TYPE_DASH: Record<KpRelationType, string> = {
  prereq: '',
  contains: '6 4',
  apply: '2 4',
  contrast: '8 3 2 3',
};

/** 脑图里一个知识点节点 */
interface MapNode {
  kp: string;
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
}

/** 当前脑图的运行态（供点击节点后查讲解与关系） */
interface MapState {
  grade: string;
  subject: string;
  notes: Record<string, KnowledgeNote>;
  rels: KpRelation[];
  nodes: MapNode[];
  /** `${学科}|${知识点}` -> 题量 */
  counts: Map<string, number>;
  /** `${学科}|${知识点}` -> 掌握情况 */
  mastery: Map<string, { total: number; mastered: number; wrong: number }>;
}

let cur: MapState | null = null;

/** 该学期该学科分片的讲解条数（需已加载分片） */
function noteCountOf(grade: string, subject: string): number {
  return Object.keys(getNotes(grade, subject)).length;
}

/** 收集题量与掌握度（与学科无关的全局信息），并确保相关分片已加载 */
async function prepare(grade: string, subjects: string[]): Promise<{
  counts: Map<string, number>;
  mastery: Map<string, { total: number; mastered: number; wrong: number }>;
}> {
  await Promise.all(subjects.map((s) => loadSubject(grade, s)));
  const counts = new Map<string, number>();
  for (const q of QUESTION_BANK[grade] ?? []) {
    const k = `${q.s}|${q.kp || '综合'}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const mastery = new Map<string, { total: number; mastered: number; wrong: number }>();
  for (const st of kpStats()) mastery.set(`${st.s}|${st.kp}`, st);
  return { counts, mastery };
}

/** 该知识点在本学期的题量与掌握度小标签 */
function badgesHtml(subject: string, kp: string, s: MapState | null): string {
  if (!s) return '';
  const n = s.counts.get(`${subject}|${kp}`) ?? 0;
  const m = s.mastery.get(`${subject}|${kp}`);
  let out = `<span class="kp-badge">${n} 题</span>`;
  if (m && m.total) {
    out +=
      m.wrong > 0
        ? `<span class="kp-badge bad">掌握 ${m.mastered}/${m.total} · 错 ${m.wrong}</span>`
        : `<span class="kp-badge ${m.mastered === m.total ? 'ok' : ''}">掌握 ${m.mastered}/${m.total}</span>`;
  }
  return out;
}

/** 关系文字：前置：A｜应用：B */
function relTextHtml(rels: KpRelation[], kp: string): string {
  if (!rels.length) return '';
  const groups = new Map<KpRelationType, string[]>();
  for (const r of rels) {
    if (r.type === 'prereq') {
      if (r.to === kp) push(groups, 'prereq', r.from);
      else if (r.from === kp) push(groups, 'apply', r.to); // 作为别人的前置，等价于本点的应用方向
    } else if (r.from === kp) {
      push(groups, r.type, r.to);
    } else if (r.to === kp) {
      push(groups, r.type, r.from);
    }
  }
  const parts: string[] = [];
  for (const t of ['prereq', 'contains', 'apply', 'contrast'] as KpRelationType[]) {
    const arr = groups.get(t);
    if (arr?.length) {
      parts.push(
        `<span class="kp-rel" style="color:${TYPE_COLOR[t]}">${TYPE_LABEL[t]}：${arr
          .map(escapeHtml)
          .join('、')}</span>`,
      );
    }
  }
  return parts.length ? `<div class="kp-rels">🔗 ${parts.join(' ｜ ')}</div>` : '';
}

function push(m: Map<KpRelationType, string[]>, t: KpRelationType, v: string): void {
  const arr = m.get(t) ?? [];
  if (!arr.includes(v)) arr.push(v);
  m.set(t, arr);
}

/** 讲解正文（概要 + 要点 + 易错） */
function noteBodyHtml(n: KnowledgeNote): string {
  const points = n.points?.length
    ? `<ul class="kp-points">${n.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
    : '';
  const pit = n.pitfall ? `<div class="kp-pit">⚠ 易错：${escapeHtml(n.pitfall)}</div>` : '';
  return `<div class="kp-sum">${escapeHtml(n.summary || '')}</div>${points}${pit}`;
}

/* ==================== 视图一：知识点讲解 ==================== */

/** 渲染「知识点讲解」视图（学科为空则展示该学期全部学科） */
export async function renderKpNotes(grade: string, subject: string): Promise<string> {
  const subs = subject ? [subject] : subjectsOf(grade);
  const { counts, mastery } = await prepare(grade, subs);
  const blocks: string[] = [];
  let totalNotes = 0;
  let totalRels = 0;

  for (const s of subs) {
    const notes = getNotes(grade, s);
    const rels = getRelations(grade, s);
    const list = Object.values(notes).sort((a, b) => (a.u || '').localeCompare(b.u || '', 'zh') || a.kp.localeCompare(b.kp, 'zh'));
    if (!list.length) continue;
    totalNotes += list.length;
    totalRels += rels.length;
    const st: MapState = { grade, subject: s, notes, rels, nodes: [], counts, mastery };
    const byUnit = new Map<string, KnowledgeNote[]>();
    for (const n of list) {
      const arr = byUnit.get(n.u || '综合') ?? [];
      arr.push(n);
      byUnit.set(n.u || '综合', arr);
    }
    const units = [...byUnit.entries()]
      .map(
        ([u, arr]) =>
          `<div class="kp-unit"><h5>${escapeHtml(u)}</h5>${arr
            .map(
              (n) => `<details class="kp-card">
            <summary><span class="kpct">${escapeHtml(n.kp)}</span>${badgesHtml(s, n.kp, st)}</summary>
            <div class="kp-body">${noteBodyHtml(n)}${relTextHtml(rels, n.kp)}
              <div class="kp-ops"><button class="btn btn-sm" onclick="bankSearchKp('${escapeHtml(n.kp)}')">🔍 相关题目</button></div>
            </div>
          </details>`,
            )
            .join('')}</div>`,
      )
      .join('');
    blocks.push(
      `<div class="kp-subject"><h4>${SUBJECT_ICON[s] || '📘'} ${escapeHtml(s)}（${list.length} 个知识点）</h4>${units}</div>`,
    );
  }

  if (!blocks.length) {
    return `<div class="wb-empty">该学期暂无知识点讲解数据（知识图谱仍在建设中），可以先看题目视图</div>`;
  }
  const tip = `<div class="kp-tip">共 ${totalNotes} 个知识点 · ${totalRels} 条关系；点击卡片展开讲解要点与易错提示</div>`;
  return tip + blocks.join('');
}

/* ==================== 视图二：知识脑图 ==================== */

const NODE_H = 34;
const ROW_GAP = 64;
const COL_GAP = 16;

/** 按前置关系计算层级（有环时按 0 处理，避免死循环） */
function computeLevels(kps: string[], rels: KpRelation[]): Map<string, number> {
  const parents = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== 'prereq') continue;
    const arr = parents.get(r.to) ?? [];
    arr.push(r.from);
    parents.set(r.to, arr);
  }
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const lv = (kp: string): number => {
    const hit = level.get(kp);
    if (hit !== undefined) return hit;
    if (visiting.has(kp)) return 0; // 环：直接按 0 处理
    visiting.add(kp);
    const ps = (parents.get(kp) ?? []).filter((p) => kps.includes(p));
    const v = ps.length ? Math.max(...ps.map(lv)) + 1 : 0;
    visiting.delete(kp);
    level.set(kp, v);
    return v;
  };
  for (const kp of kps) lv(kp);
  return level;
}

/** 分层布局（无前置关系时退化为网格布局） */
function layout(kps: string[], rels: KpRelation[]): MapNode[] {
  const level = computeLevels(kps, rels);
  const wOf = (kp: string): number => Math.min(190, 26 + kp.length * 13);
  const maxLevel = Math.max(0, ...[...level.values()]);
  const nodes: MapNode[] = [];

  if (maxLevel === 0) {
    // 网格布局：列数取 √n，避免一行过长
    const cols = Math.max(1, Math.ceil(Math.sqrt(kps.length)));
    const rows = Math.ceil(kps.length / cols);
    const cellW = Math.max(...kps.map(wOf)) + COL_GAP;
    for (let i = 0; i < kps.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowCount = Math.min(cols, kps.length - r * cols);
      const rowW = rowCount * cellW - COL_GAP;
      const start = (Math.max(720, cellW * cols) - rowW) / 2;
      nodes.push({
        kp: kps[i],
        x: start + c * cellW,
        y: 24 + r * (NODE_H + ROW_GAP),
        w: wOf(kps[i]),
        h: NODE_H,
        level: 0,
      });
    }
    void rows;
    return nodes;
  }

  // 分层布局：同层横向均布，整行居中
  const byLevel = new Map<number, string[]>();
  for (const kp of kps) {
    const l = level.get(kp) ?? 0;
    const arr = byLevel.get(l) ?? [];
    arr.push(kp);
    byLevel.set(l, arr);
  }
  let maxW = 720;
  for (const arr of byLevel.values()) {
    const rowW = arr.reduce((s, kp) => s + wOf(kp), 0) + COL_GAP * (arr.length - 1);
    maxW = Math.max(maxW, rowW + 40);
  }
  for (const [l, arr] of byLevel) {
    arr.sort((a, b) => a.localeCompare(b, 'zh'));
    const rowW = arr.reduce((s, kp) => s + wOf(kp), 0) + COL_GAP * (arr.length - 1);
    let x = (maxW - rowW) / 2;
    for (const kp of arr) {
      const w = wOf(kp);
      nodes.push({ kp, x, y: 24 + l * (NODE_H + ROW_GAP), w, h: NODE_H, level: l });
      x += w + COL_GAP;
    }
  }
  return nodes;
}

/** 两个节点之间的连线锚点与路径 */
function edgePath(a: MapNode, b: MapNode): string {
  const dy = b.y - a.y;
  if (Math.abs(dy) > 1) {
    // 跨层：由上一节点底边到下一节点顶边
    const down = dy > 0;
    const x1 = a.x + a.w / 2;
    const y1 = down ? a.y + a.h : a.y;
    const x2 = b.x + b.w / 2;
    const y2 = down ? b.y : b.y + b.h;
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
  }
  // 同层：向上凸起的弧线，避免与节点重叠
  const right = a.x < b.x;
  const x1 = right ? a.x + a.w : a.x;
  const x2 = right ? b.x : b.x + b.w;
  const y1 = a.y + a.h / 2;
  const y2 = b.y + b.h / 2;
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 34} ${x2} ${y2}`;
}

function markersHtml(): string {
  return (Object.keys(TYPE_COLOR) as KpRelationType[])
    .map(
      (t) =>
        `<marker id="kparrow-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${TYPE_COLOR[t]}"/></marker>`,
    )
    .join('');
}

function nodeText(kp: string, w: number): string {
  const max = Math.max(3, Math.floor((w - 16) / 13));
  return kp.length > max ? `${kp.slice(0, max - 1)}…` : kp;
}

/** 渲染「知识脑图」视图（单学科；未选学科时自动挑一个有讲解的学科） */
export async function renderKpMap(grade: string, subject: string): Promise<string> {
  let sub = subject;
  if (!sub) {
    sub = subjectsOf(grade).find((s) => noteCountOf(grade, s) > 0) ?? '';
  }
  const { counts, mastery } = await prepare(grade, sub ? [sub] : subjectsOf(grade));
  if (!sub) return `<div class="wb-empty">该学期暂无知识图谱数据</div>`;
  const notes = getNotes(grade, sub);
  const rels = getRelations(grade, sub);
  const kps = Object.keys(notes);
  if (!kps.length) {
    return `<div class="wb-empty">${escapeHtml(sub)} 暂无知识图谱数据（该学科讲解仍在建设中）</div>`;
  }
  const nodes = layout(kps, rels);
  cur = { grade, subject: sub, notes, rels, nodes, counts, mastery };

  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const W = Math.max(720, maxX + 30);
  const H = maxY + 30;
  const pos = new Map(nodes.map((n) => [n.kp, n]));

  const edges = rels
    .map((r) => {
      const a = pos.get(r.from);
      const b = pos.get(r.to);
      if (!a || !b) return '';
      return `<path class="kp-edge" d="${edgePath(a, b)}" fill="none" stroke="${TYPE_COLOR[r.type]}" stroke-width="1.6"${TYPE_DASH[r.type] ? ` stroke-dasharray="${TYPE_DASH[r.type]}"` : ''} marker-end="url(#kparrow-${r.type})" opacity="0.85"><title>${escapeHtml(r.from)} → ${TYPE_LABEL[r.type]} → ${escapeHtml(r.to)}${r.note ? `（${escapeHtml(r.note)}）` : ''}</title></path>`;
    })
    .join('');

  const nodeEls = nodes
    .map((n) => {
      const m = mastery.get(`${sub}|${n.kp}`);
      const done = !!m && m.total > 0 && m.mastered === m.total && m.wrong === 0;
      const warn = !!m && m.wrong > 0;
      const cls = done ? ' done' : warn ? ' warn' : '';
      return `<g class="kpnode${cls}" data-kp="${escapeHtml(n.kp)}" onclick="selectKpNode('${escapeHtml(n.kp)}')">
        <title>${escapeHtml(n.kp)}</title>
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7" ry="7"/>
        <text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" text-anchor="middle" font-size="12">${escapeHtml(nodeText(n.kp, n.w))}</text>
      </g>`;
    })
    .join('');

  const legend = (Object.keys(TYPE_LABEL) as KpRelationType[])
    .map(
      (t) =>
        `<span class="kp-lg"><i style="background:${TYPE_COLOR[t]}"></i>${TYPE_LABEL[t]}（${rels.filter((r) => r.type === t).length}）</span>`,
    )
    .join('');

  const auto = !subject ? `<div class="kp-tip">脑图按单学科展示，已自动选择「${escapeHtml(sub)}」</div>` : '';
  return (
    auto +
    `<div class="kp-map-wrap"><svg class="kp-map" viewBox="0 0 ${W} ${H}" width="100%" height="${Math.min(460, H)}" preserveAspectRatio="xMidYMin meet">
      <defs>${markersHtml()}</defs>${edges}${nodeEls}
    </svg></div>
    <div class="kp-legend">${legend}</div>
    <div class="kp-detail" id="kpMapDetail">点击任意节点查看讲解、关系与相关题目</div>`
  );
}

/** 点击脑图节点：高亮该节点并在下方展示讲解详情 */
export function selectKpNode(kp: string): void {
  Sound.play('click');
  const box = document.getElementById('kpMapDetail');
  document.querySelectorAll<HTMLElement>('.kpnode').forEach((el) => {
    el.classList.toggle('active', el.dataset.kp === kp);
  });
  if (!box || !cur) return;
  const n = cur.notes[kp];
  if (!n) {
    box.innerHTML = `<div class="kp-detail-title">${escapeHtml(kp)}</div><div class="kp-sum">暂无该知识点的讲解</div>`;
    return;
  }
  const c = cur.counts.get(`${cur.subject}|${kp}`) ?? 0;
  box.innerHTML =
    `<div class="kp-detail-title">${SUBJECT_ICON[cur.subject] || '📘'} ${escapeHtml(n.kp)}<span class="kp-badge">${c} 题</span></div>` +
    `<div class="kp-detail-unit">${escapeHtml(n.u || '综合')}</div>` +
    noteBodyHtml(n) +
    relTextHtml(cur.rels, kp) +
    `<div class="kp-ops"><button class="btn btn-sm" onclick="bankSearchKp('${escapeHtml(n.kp)}')">🔍 相关题目</button></div>`;
}
