/* ==================== 学分商店 & 局前配装 ====================
 * 全屏弹窗 #shopModal：学分概览 / 学期筛选 / 角色·装备·道具 三页签。
 * 局前配装：renderLoadoutBar() 渲染到开局界面的 #loadoutBar 容器。
 */
import { escapeHtml } from '../core/dom';
import { GRADE_ORDER } from '../data/grades';
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
  equipPrice,
  isCharUnlocked,
  isEquipUnlocked,
  loadoutEquipCount,
  loadoutItemCount,
  removeLoadoutItem,
  setLoadoutSlot,
  spendCredits,
  unlockChar,
  CREDIT_RULE,
  LOADOUT_EQUIP_LIMIT,
  LOADOUT_ITEM_LIMIT,
} from '../profile/credits';

/** 道具学分定价（消耗类，可重复购买） */
export const ITEM_PRICE: Record<string, number> = {
  it_reset: 50,
  it_shield: 60,
  it_draw: 70,
  it_peek: 60,
};

type Tab = 'chars' | 'equips' | 'items';
let curTab: Tab = 'chars';
let curGrade = GRADE_ORDER[0];

function creditOverview(): string {
  const earned = earnedToday();
  const cap = CREDIT_RULE.dailyCap;
  const pct = Math.min(100, Math.round((earned / cap) * 100));
  const reached = dailyCapReached();
  return `
    <div class="shop-credit">
      <div class="sc-main"><span class="sc-num" id="shopCreditNum">${credits()}</span><span class="sc-label">学分</span></div>
      <div class="sc-bar">
        <div class="sc-bar-top"><span>今日获取 ${earned} / ${cap}</span>${reached ? '<span class="sc-cap">已达上限</span>' : ''}</div>
        <div class="sc-track"><i style="width:${pct}%"></i></div>
      </div>
      <div class="sc-tip">答对题 +${CREDIT_RULE.perCorrectQuiz} ｜ 复习 +${CREDIT_RULE.perReview} ｜ 攻克错题 +${CREDIT_RULE.perWrongFixed}（每日上限 ${cap}）</div>
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
  return `<div class="shop-tabs">${mk('chars', '角色')}${mk('equips', '装备')}${mk('items', '道具')}</div>`;
}

function charCards(): string {
  const list = EXPANSION_CHARS.filter((c) => c.grade === curGrade);
  return `<div class="shop-grid">${list
    .map((c) => {
      const unlocked = isCharUnlocked(c.id);
      const price = CHAR_PRICE[c.id] ?? 0;
      const sk = c.skills[0];
      const can = !unlocked && credits() >= price && !dailyCapReached();
      return `<div class="shop-card ${unlocked ? 'unlocked' : ''}">
        <div class="sc-avatar">${c.avatar}</div>
        <div class="sc-info">
          <div class="sc-name">${escapeHtml(c.name)} <span class="sc-title">${escapeHtml(c.title)}</span></div>
          <div class="sc-sub">${c.subject} ｜ ${c.grade} ｜ 体力 ${c.hp}</div>
          <div class="sc-skill"><b>${escapeHtml(sk.name)}</b>（${sk.type === 'active' ? '主动' : '触发'}）${escapeHtml(sk.desc)}</div>
        </div>
        <div class="sc-action">
          ${
            unlocked
              ? '<span class="sc-owned">✓ 已解锁</span>'
              : `<button class="btn btn-sm ${can ? 'btn-accent' : ''}" ${can ? '' : 'disabled'} onclick="shopUnlockChar('${c.id}')">解锁 ${price}</button>`
          }
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

function equipCards(): string {
  return `<div class="shop-grid">${EXPANSION_EQUIPS.map((e) => {
    const owned = isEquipUnlocked(e.id);
    const price = EQUIP_PRICE[e.tier] ?? 0;
    const can = !owned && credits() >= price && !dailyCapReached();
    return `<div class="shop-card ${owned ? 'unlocked' : ''}">
      <div class="sc-avatar">${e.icon}</div>
      <div class="sc-info">
        <div class="sc-name">${escapeHtml(e.name)} <span class="sc-title">${e.slot === 'weapon' ? '武器' : e.slot === 'armor' ? '防具' : e.slot === 'horsePlus' ? '+1马' : '-1马'}</span></div>
        <div class="sc-sub">${e.tier === 1 ? '普通' : e.tier === 2 ? '精良' : '稀有'}</div>
        <div class="sc-skill">${escapeHtml(e.desc)}</div>
      </div>
      <div class="sc-action">
        ${
          owned
            ? '<span class="sc-owned">✓ 已拥有</span>'
            : `<button class="btn btn-sm ${can ? 'btn-accent' : ''}" ${can ? '' : 'disabled'} onclick="shopBuyEquip('${e.id}')">购买 ${price}</button>`
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

function renderBody(): void {
  const body = document.getElementById('shopBody');
  if (!body) return;
  let html = creditOverview() + gradeCapsules() + tabBar();
  if (curTab === 'chars') html += charCards();
  else if (curTab === 'equips') html += equipCards();
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
  if (buyEquip(id)) {
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
