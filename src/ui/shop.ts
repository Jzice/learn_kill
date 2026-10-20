/* ==================== 学分商店 & 局前配装 ====================
 * 全屏弹窗 #shopModal：学分概览 / 学期筛选 / 角色·装备·道具 三页签。
 * 局前配装：renderLoadoutBar() 渲染到开局界面的 #loadoutBar 容器。
 */
import { escapeHtml } from '../core/dom';
import { GRADE_ORDER, gradeSortKey } from '../data/grades';
import { addLog } from '../game/log';
import {
  EXPANSION_CHARS,
  EXPANSION_EQUIPS,
  EXPANSION_ITEMS,
  CHAR_PRICE,
  EQUIP_PRICE,
  expansionCharById,
  expansionEquipById,
  expansionItemById,
} from '../data/expansion';
import {
  PROFILE,
  saveProfile,
} from '../profile/profile';
import {
  addItem,
  addLoadoutItem,
  buyEquip,
  charPrice,
  clearLoadout,
  credits,
  dailyCapReached,
  earnedToday,
  creditSources,
  equipPrice,
  grantEquip,
  isCharUnlocked,
  isEquipUnlocked,
  loadoutEquipCount,
  loadoutItemCount,
  missionCapReached,
  missionEarnedToday,
  removeLoadoutItem,
  setLoadoutSlot,
  spendCredits,
  unlockChar,
  CREDIT_RULE,
  LOADOUT_EQUIP_LIMIT,
  LOADOUT_ITEM_LIMIT,
  quizCreditFor,
} from '../profile/credits';
import type { MasterySnapshot, UnlockCond } from '../profile/unlockCondition';
import {
  charConditions,
  condsOk,
  equipConditions,
  firstBlocked,
  masterySnapshot,
} from '../profile/unlockCondition';
import { openBankBrowser } from './bank';
import { claimMission, missionProgress } from '../profile/missions';

/** 道具学分定价（消耗类，可重复购买） */
export const ITEM_PRICE: Record<string, number> = {
  it_reset: 50,
  it_shield: 60,
  it_draw: 70,
  it_peek: 60,
  it_peek2: 90,
  it_wall: 100,
};

/** 装备档位名 */
const TIER_NAME: Record<number, string> = { 1: '普通', 2: '精良', 3: '稀有', 4: '史诗' };

/** 学分来源标识 → 展示名 */
const SOURCE_LABEL: Record<string, string> = {
  quiz: '答题',
  review: '复习',
  wrongfix: '攻克错题',
  drill: '刷题',
  mission: '任务',
  pass: '战令',
};

type Tab = 'chars' | 'equips' | 'items' | 'missions';
let curTab: Tab = 'chars';
let curGrade = GRADE_ORDER[0];

function creditOverview(): string {
  const earned = earnedToday();
  const missionEarned = missionEarnedToday();
  const cap = CREDIT_RULE.dailyCap;
  const mcap = CREDIT_RULE.missionDailyCap;
  const pct = Math.min(100, Math.round((earned / cap) * 100));
  const mpct = Math.min(100, Math.round((missionEarned / mcap) * 100));
  const reached = dailyCapReached();
  const src = creditSources();
  const srcHtml = Object.keys(src).length
    ? Object.entries(src)
        .map(([k, v]) => `<span class="sc-src">${SOURCE_LABEL[k] || k} +${v}</span>`)
        .join('')
    : '<span class="sc-src">今日暂无学习记录</span>';
  return `
    <div class="shop-credit">
      <div class="sc-main"><span class="sc-num" id="shopCreditNum">${credits()}</span><span class="sc-label">学分</span></div>
      <div class="sc-bar">
        <div class="sc-bar-top"><span>今日答题获取 ${earned} / ${cap}</span>${reached ? '<span class="sc-cap">已达上限</span>' : ''}</div>
        <div class="sc-track"><i style="width:${pct}%"></i></div>
      </div>
      <div class="sc-bar">
        <div class="sc-bar-top"><span>今日任务宝箱 ${missionEarned} / ${mcap}</span>${missionCapReached() ? '<span class="sc-cap">已达上限</span>' : ''}</div>
        <div class="sc-track"><i class="mission" style="width:${mpct}%"></i></div>
      </div>
      <div class="sc-srcs">${srcHtml}</div>
      <div class="sc-tip">答对题 / 刷题 +${quizCreditFor('初一上')}~${quizCreditFor('高三下')} 学分（随年级递增，日上限 ${cap}）｜ 复习 +${CREDIT_RULE.perReview} ｜ 攻克错题 +${CREDIT_RULE.perWrongFixed} ｜ 每日任务宝箱额外上限 ${mcap}（见「🎯 学习任务」页签）</div>
    </div>`;
}

function gradeCapsules(): string {
  return `<div class="shop-grades">${GRADE_ORDER.map(
    (g) => `<button class="shop-grade ${g === curGrade ? 'active' : ''}" onclick="shopSetGrade('${g}')">${g}</button>`,
  ).join('')}</div>`;
}

function tabBar(): string {
  const mk = (t: Tab, label: string) =>
    `<button class="shop-tab ${curTab === t ? 'active' : ''}" onclick="shopSetTab('${t}')">${label}</button>`;
  return `<div class="shop-tabs">${mk('chars', '角色')}${mk('equips', '装备')}${mk('items', '道具')}${mk('missions', '🎯 学习任务')}</div>`;
}

/** 每日学习任务页（固定 4 项，零随机；奖励走任务类独立额度） */
function missionCards(): string {
  const rows = missionProgress();
  const claimable = rows.filter((m) => m.done && !m.claimed).length;
  return `<div class="sc-missions">
    <div class="sc-mission-tip">每日 0 点重置 ｜ 奖励走任务类独立额度（${CREDIT_RULE.missionDailyCap} 学分/日）${
      claimable ? ` ｜ <b style="color:var(--green)">${claimable} 个可领取</b>` : ''
    }</div>
    ${rows
      .map(
        (m) => `<div class="sc-mission ${m.claimed ? 'claimed' : m.done ? 'done' : ''}">
      <div class="sc-mission-l">${escapeHtml(m.def.label)}</div>
      <div class="sc-mission-p"><i style="width:${Math.round((m.cur / m.def.target) * 100)}%"></i><span>${m.cur}/${m.def.target}</span></div>
      <div class="sc-mission-a">${
        m.claimed
          ? '<span class="sc-owned">✓ 已领取</span>'
          : m.done
            ? `<button class="btn btn-sm btn-accent" onclick="shopClaimMission('${m.def.id}')">领取 ${m.def.reward} 学分</button>`
            : '进行中'
      }</div>
    </div>`,
      )
      .join('')}
  </div>`;
}

/** 单条解锁条件行（credit/must 必须满足；either 组内任一满足即可，行首标「或」） */
function condRow(c: UnlockCond): string {
  const mark = c.ok ? '✓' : '✗';
  const or = c.group === 'either' ? '<span class="sc-cond-or">或</span> ' : '';
  const jump =
    !c.ok && c.jump
      ? ` <button class="sc-cond-jump" onclick="shopJumpBank()">去学习 →</button>`
      : '';
  return `<div class="sc-cond ${c.ok ? 'ok' : 'no'}">${or}${mark} ${escapeHtml(c.label)} <b>${c.cur}/${c.need}</b>${jump}</div>`;
}

function condsHtml(conds: UnlockCond[]): string {
  return `<div class="sc-conds">${conds.map(condRow).join('')}</div>`;
}

/** 首个未达标条件的提示文案（按钮 tooltip 用） */
function blockedTip(conds: UnlockCond[]): string {
  const b = firstBlocked(conds);
  return b ? `还需：${b.label} ${b.cur}/${b.need}` : '';
}

function charCards(snap: MasterySnapshot): string {
  const list = EXPANSION_CHARS.filter((c) => c.grade === curGrade);
  return `<div class="shop-grid">${list
    .map((c) => {
      const unlocked = isCharUnlocked(c.id);
      const price = CHAR_PRICE[c.id] ?? 0;
      const conds = charConditions(c, snap);
      const can = !unlocked && condsOk(conds) && credits() >= price && !dailyCapReached();
      const sk = c.skills[0];
      return `<div class="shop-card ${unlocked ? 'unlocked' : ''}">
        <div class="sc-avatar">${c.avatar}</div>
        <div class="sc-info">
          <div class="sc-name">${escapeHtml(c.name)} <span class="sc-title">${escapeHtml(c.title)}</span></div>
          <div class="sc-sub">${c.subject} ｜ ${c.grade} ｜ 体力 ${c.hp}</div>
          <div class="sc-skill"><b>${escapeHtml(sk.name)}</b>（${sk.type === 'active' ? '主动' : '触发'}）${escapeHtml(sk.desc)}</div>
          ${condsHtml(conds)}
        </div>
        <div class="sc-action">
          ${
            unlocked
              ? '<span class="sc-owned">✓ 已解锁</span>'
              : `<button class="btn btn-sm ${can ? 'btn-accent' : ''}" ${can ? '' : 'disabled'} title="${escapeHtml(blockedTip(conds))}" onclick="shopUnlockChar('${c.id}')">解锁 ${price}</button>`
          }
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

function equipCards(snap: MasterySnapshot): string {
  return `<div class="shop-grid">${EXPANSION_EQUIPS.map((e) => {
    const owned = isEquipUnlocked(e.id);
    const price = EQUIP_PRICE[e.tier] ?? 0;
    // 年级门槛：达到装备要求年级才可购买（未达到时展示为目标激励）
    const gradeOk = gradeSortKey(e.grade) <= gradeSortKey(curGrade);
    const conds = equipConditions(e, snap);
    const can = !owned && gradeOk && condsOk(conds) && credits() >= price && !dailyCapReached();
    return `<div class="shop-card ${owned ? 'unlocked' : ''}">
      <div class="sc-avatar">${e.icon}</div>
      <div class="sc-info">
        <div class="sc-name">${escapeHtml(e.name)} <span class="sc-title">${e.slot === 'weapon' ? '武器' : e.slot === 'armor' ? '防具' : e.slot === 'horsePlus' ? '+1马' : '-1马'}</span></div>
        <div class="sc-sub">${TIER_NAME[e.tier] || '普通'} ｜ ${escapeHtml(e.grade)}起</div>
        <div class="sc-skill">${escapeHtml(e.desc)}</div>
        ${owned || gradeOk ? '' : `<div class="sc-skill" style="color:#e08a7a">🔒 需达到 ${escapeHtml(e.grade)}（当前 ${escapeHtml(curGrade)}）</div>`}
        ${condsHtml(conds)}
      </div>
      <div class="sc-action">
        ${
          owned
            ? '<span class="sc-owned">✓ 已拥有</span>'
            : `<button class="btn btn-sm ${can ? 'btn-accent' : ''}" ${can ? '' : 'disabled'} title="${escapeHtml(blockedTip(conds))}" onclick="shopBuyEquip('${e.id}')">${gradeOk ? `购买 ${price}` : `🔒 ${escapeHtml(e.grade)}`}</button>`
        }
      </div>
    </div>`;
  }).join('')}</div>`;
}

function itemCards(): string {
  return `<div class="shop-grid">${EXPANSION_ITEMS.map((it) => {
    const price = ITEM_PRICE[it.id] ?? 50;
    const owned = PROFILE.items?.[it.id] || 0;
    const can = credits() >= price && !dailyCapReached() && owned < it.maxCarry;
    return `<div class="shop-card">
      <div class="sc-avatar">${it.icon}</div>
      <div class="sc-info">
        <div class="sc-name">${escapeHtml(it.name)} <span class="sc-title">持有 ${owned}/${it.maxCarry}</span></div>
        <div class="sc-skill">${escapeHtml(it.desc)}</div>
      </div>
      <div class="sc-action">
        <button class="btn btn-sm ${can ? 'btn-accent' : ''}" ${can ? '' : 'disabled'} onclick="shopBuyItem('${it.id}',1)">购买 ${price}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/** 新手礼包：首次进店免费领 1 件 tier1 装备（一次性、确定性） */
function newbieGiftHtml(): string {
  if (PROFILE.newbieGift) return '';
  const opts = EXPANSION_EQUIPS.filter((e) => e.tier === 1)
    .map(
      (e) =>
        `<button class="btn btn-sm btn-accent" onclick="shopGrantNewbie('${e.id}')">${e.icon} ${escapeHtml(e.name)}</button>`,
    )
    .join('');
  return `<div class="sc-newbie">
      <div class="sc-newbie-t">🎁 新手学习礼包：免费领取 1 件初始装备（仅一次）</div>
      <div class="sc-newbie-opts">${opts}</div>
    </div>`;
}

function renderBody(): void {
  const body = document.getElementById('shopBody');
  if (!body) return;
  // 一次渲染内共享掌握度快照（kpStats 只遍历一次 quizRec）
  const snap = masterySnapshot();
  let html = creditOverview() + newbieGiftHtml() + gradeCapsules() + tabBar();
  if (curTab === 'chars') html += charCards(snap);
  else if (curTab === 'equips') html += equipCards(snap);
  else if (curTab === 'missions') html += missionCards();
  else html += itemCards();
  body.innerHTML = html;
}

export function openShop(tab: Tab = 'chars'): void {
  curTab = tab;
  // 默认定位到当前年级（开局界面选定后回填）
  const sel = (window as unknown as { SELECTED_GRADE?: string }).SELECTED_GRADE;
  if (sel && GRADE_ORDER.includes(sel)) curGrade = sel;
  renderBody();
  document.getElementById('shopModal')?.classList.add('show');
}

export function closeShop(): void {
  document.getElementById('shopModal')?.classList.remove('show');
}

export function shopSetTab(t: Tab): void {
  curTab = t;
  renderBody();
}
export function shopSetGrade(g: string): void {
  curGrade = g;
  renderBody();
}
export function shopUnlockChar(id: string): void {
  if (unlockChar(id)) {
    const c = expansionCharById(id);
    if (c) flashUnlock(c.name);
    renderBody();
    window.dispatchEvent(new CustomEvent('credits-updated'));
  }
}
export function shopBuyEquip(id: string): void {
  if (buyEquip(id, curGrade)) {
    renderBody();
    window.dispatchEvent(new CustomEvent('credits-updated'));
  }
}
export function shopBuyItem(id: string, n = 1): void {
  const price = (ITEM_PRICE[id] ?? 50) * n;
  if (spendCredits(price, `buyitem:${id}`)) {
    addItem(id, n);
    renderBody();
    window.dispatchEvent(new CustomEvent('credits-updated'));
  }
}

/** 领取新手礼包（tier1 装备 1 件，不扣学分，一次性） */
export function shopGrantNewbie(id: string): void {
  if (PROFILE.newbieGift) return;
  const e = expansionEquipById(id);
  if (!e || e.tier !== 1) return;
  if (grantEquip(id)) {
    PROFILE.newbieGift = true;
    saveProfile();
    addLog(`🎁 领取新手礼包【${e.name}】`, 'reward');
  }
  renderBody();
  window.dispatchEvent(new CustomEvent('credits-updated'));
}

/** 解锁条件未达标时的引导跳转：前往题库刷题 / 学习 */
export function shopJumpBank(): void {
  closeShop();
  openBankBrowser();
}

/** 领取每日任务奖励（固定学分档位） */
export function shopClaimMission(id: string): void {
  claimMission(id as 'quiz' | 'review' | 'wrongFixed' | 'combo');
  renderBody();
  window.dispatchEvent(new CustomEvent('credits-updated'));
}

function flashUnlock(name: string): void {
  addLog(`🎉 解锁角色【${name}】`, 'reward');
}

/* ---------------- 局前配装栏 ---------------- */
const SLOT_LABEL: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  horsePlus: '+1 马',
  horseMinus: '-1 马',
};

export function renderLoadoutBar(): void {
  const el = document.getElementById('loadoutBar');
  if (!el) return;
  const l = PROFILE.loadout;
  const ownedEquips = EXPANSION_EQUIPS.filter((e) => isEquipUnlocked(e.id));
  const slotHtml = (slot: 'weapon' | 'armor' | 'horsePlus' | 'horseMinus'): string => {
    const id = l[slot];
    const eq = id ? expansionEquipById(id) : null;
    const opts = ownedEquips
      .filter((e) => e.slot === slot)
      .map((e) => `<option value="${e.id}" ${e.id === id ? 'selected' : ''}>${e.icon} ${e.name}</option>`)
      .join('');
    return `<div class="lo-slot">
      <div class="lo-slot-label">${SLOT_LABEL[slot]}</div>
      <select class="lo-select" onchange="shopSetLoadoutSlot('${slot}', this.value)">
        <option value="">— 空 —</option>${opts}
      </select>
      ${eq ? `<div class="lo-eq-desc">${escapeHtml(eq.desc)}</div>` : ''}
    </div>`;
  };
  const items = EXPANSION_ITEMS.filter((it) => (PROFILE.items?.[it.id] || 0) > 0);
  const itemHtml = items.length
    ? items
        .map((it) => {
          const n = l.items?.[it.id] || 0;
          const stock = PROFILE.items?.[it.id] || 0;
          return `<div class="lo-item">
            <span class="lo-item-ic">${it.icon} ${escapeHtml(it.name)}</span>
            <span class="lo-item-num">携带 ${n} / 库存 ${stock}</span>
            <button class="btn btn-xs" onclick="shopAddLoadoutItem('${it.id}',1)">+ 带</button>
            ${n > 0 ? `<button class="btn btn-xs" onclick="shopRemoveLoadoutItem('${it.id}',1)">− 撤</button>` : ''}
          </div>`;
        })
        .join('')
    : '<div class="lo-empty">未持有道具（可在商店购买）</div>';
  el.innerHTML = `
    <div class="lo-equips">${slotHtml('weapon')}${slotHtml('armor')}${slotHtml('horsePlus')}${slotHtml('horseMinus')}</div>
    <div class="lo-meta">已装配 ${loadoutEquipCount()} / ${LOADOUT_EQUIP_LIMIT} 件 ｜ 道具 ${loadoutItemCount()} / ${LOADOUT_ITEM_LIMIT} 个</div>
    <div class="lo-items">${itemHtml}</div>
    <div class="lo-actions"><button class="btn btn-xs" onclick="shopClearLoadout()">清空配装</button></div>`;
}

export function shopSetLoadoutSlot(slot: 'weapon' | 'armor' | 'horsePlus' | 'horseMinus', value: string): void {
  setLoadoutSlot(slot, value || null);
  renderLoadoutBar();
}
export function shopAddLoadoutItem(id: string, n = 1): void {
  addLoadoutItem(id, n);
  renderLoadoutBar();
}
export function shopRemoveLoadoutItem(id: string, n = 1): void {
  removeLoadoutItem(id, n);
  renderLoadoutBar();
}
export function shopClearLoadout(): void {
  clearLoadout();
  renderLoadoutBar();
}
