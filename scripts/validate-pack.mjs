#!/usr/bin/env node
/* 离线校验自定义扩展包 JSON（与 src/data/packRegistry.ts 的 validatePack 同源规则）
 * 用法：node scripts/validate-pack.mjs path/to/pack.json
 * 退出码：0 通过（仅告警也通过）/ 1 结构错误
 */
import { readFileSync } from 'node:fs';

const KNOWN_EFFECT_KINDS = new Set([
  'selfDraw', 'shield', 'selfHeal', 'selfLoseHp', 'allHeal', 'gainKnowledge', 'spendKnowledge',
  'targetHeal', 'targetDraw', 'targetDamage', 'targetLoseHp', 'targetDiscard', 'allDiscard',
  'allDraw', 'gainHand', 'costCard', 'extraDraw', 'handLimit', 'distMod', 'damageMod',
  'star', 'starSort', 'deckPeek', 'deckBottom', 'toDeckTop', 'discardToTop', 'peekTopDeck',
  'convert', 'shaNeedShan', 'shaUnlimited', 'numGuard', 'reflect', 'armorPierceDamage',
  'preventShaDamage', 'pointDuel', 'judgeIf', 'chainJudge', 'suitCollect', 'guessSuit',
  'costThenDamage', 'doubleJudge', 'drawDiscardMin', 'extraDrawDiscardOdd', 'peekHand',
  'replaceDraw', 'targetChoose', 'quizDuel', 'swapHp', 'turnFace', 'giveHand', 'giveHandIfShan',
  'exchangeHand', 'multiDraw', 'stealFrom', 'revealAllPickOne', 'showHand', 'discardToHeal',
  'takeDuelCard', 'giveDuelCard', 'discardSuitMatch', 'trickDraw', 'addMark', 'tickMark',
  'pledge', 'immune', 'noHandImmune', 'cardImmune', 'suitImmune', 'distTrap', 'trickRedirect',
  'shaRedirect', 'enemyEquipVoid', 'horseDist', 'reduceDamage', 'replaceJudge', 'awaken',
  'revive', 'nextShaBonus', 'nextShaUnblockable', 'rangePlus', 'distPlusToMe', 'ignoreHorsePlus',
  'shunshouNoDist', 'knowledgeGain',
]);
const FACTIONS = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];
const SKILL_KINDS = ['active', 'trigger', 'passive', 'limit', 'awaken', 'lord', 'convert'];
const SKILL_TIMINGS = ['active', 'passive', 'onTurnStart', 'onDraw', 'onTurnEnd', 'beforeJudge', 'beforeDamage', 'onDamaged', 'onTargetSha', 'onUseShan', 'onShaHit', 'onUseTrick'];
const KT_KINDS = ['strategy', 'quiz'];
const KT_TARGETS = ['none', 'one'];

function isObj(v) { return typeof v === 'object' && v !== null; }
function estimateCharPP(c) {
  let pp = c.hp >= 4 ? 1.0 : 0.6;
  for (const s of c.skills || []) {
    const w = s.kind === 'active' ? 1.2 : s.kind === 'trigger' ? 0.7 : s.kind === 'convert' ? 1.0 : s.kind === 'limit' ? 1.5 : s.kind === 'awaken' ? 0.5 : s.kind === 'lord' ? 1.0 : 0.6;
    pp += w;
    for (const e of s.effects || []) {
      const k = e.kind;
      const mag = typeof e.n === 'number' ? e.n : typeof e.delta === 'number' ? e.delta : 1;
      if (['selfDraw', 'targetDraw', 'targetDamage', 'targetHeal', 'targetLoseHp', 'targetDiscard', 'allDraw', 'allDiscard', 'gainHand'].includes(k)) pp += (typeof mag === 'number' ? mag : 1) * 0.2;
      else if (k === 'gainKnowledge' || k === 'knowledgeGain') pp += 0.5;
      else if (['immune', 'distMod', 'cardImmune', 'rangePlus', 'distPlusToMe', 'suitImmune'].includes(k)) pp += 0.4;
      else pp += 0.15;
    }
  }
  return Math.round(pp * 10) / 10;
}

function validate(raw) {
  const errors = [];
  const warnings = [];
  if (!isObj(raw)) return { ok: false, errors: ['根节点必须是 JSON 对象'], warnings };
  if (raw.format !== 'xts-pack') errors.push('缺少或错误的 format 字段（应为 "xts-pack"）');
  if (typeof raw.version !== 'number') errors.push('缺少 version 字段');
  if (typeof raw.id !== 'string' || !raw.id.trim()) errors.push('缺少 id');
  if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push('缺少 name');
  const chars = raw.characters, cards = raw.cards, qs = raw.questions;
  if (!Array.isArray(chars) && !Array.isArray(cards) && !isObj(qs)) errors.push('至少需要一项：characters / cards / questions');

  const charIds = new Set();
  if (Array.isArray(chars)) chars.forEach((c, ci) => {
    const t = `角色[${ci}]`;
    if (!isObj(c)) { errors.push(`${t} 不是对象`); return; }
    if (typeof c.id !== 'string' || !c.id.trim()) errors.push(`${t}.id 缺失`);
    else if (charIds.has(c.id)) errors.push(`${t}.id 重复`);
    else charIds.add(c.id);
    if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`${t}.name 缺失`);
    if (typeof c.faction !== 'string' || !FACTIONS.includes(c.faction)) errors.push(`${t}.faction 非法`);
    if (typeof c.subject !== 'string' || !c.subject.trim()) errors.push(`${t}.subject 缺失`);
    if (typeof c.hp !== 'number' || c.hp < 2 || c.hp > 5) errors.push(`${t}.hp 应在 2~5`);
    if (typeof c.avatar !== 'string' || !c.avatar) errors.push(`${t}.avatar 缺失`);
    if (typeof c.grade !== 'string' || !c.grade.trim()) errors.push(`${t}.grade 缺失`);
    if (!Array.isArray(c.skills) || !c.skills.length) errors.push(`${t}.skills 至少 1 条`);
    (c.skills || []).forEach((s, si) => {
      const st = `${t}.技能[${si}]`;
      if (!isObj(s)) { errors.push(`${st} 不是对象`); return; }
      if (typeof s.id !== 'string' || !s.id.trim()) errors.push(`${st}.id 缺失`);
      if (typeof s.kind !== 'string' || !SKILL_KINDS.includes(s.kind)) errors.push(`${st}.kind 非法`);
      if (typeof s.timing !== 'string' || !SKILL_TIMINGS.includes(s.timing)) errors.push(`${st}.timing 非法`);
      if (!Array.isArray(s.effects)) errors.push(`${st}.effects 必须是数组`);
      else (s.effects || []).forEach((e, ei) => {
        if (!isObj(e) || typeof e.kind !== 'string') errors.push(`${st}.effects[${ei}] 缺少 kind`);
        else if (!KNOWN_EFFECT_KINDS.has(e.kind)) warnings.push(`${st}.effects[${ei}].kind 未知「${e.kind}」`);
      });
    });
    const pp = estimateCharPP(c);
    if (pp > 5.0) warnings.push(`${t}「${c.name}」战力预算约 ${pp} PP，高于基线（建议 ≤5）`);
  });

  const cardKeys = new Set();
  if (Array.isArray(cards)) cards.forEach((c, ci) => {
    const t = `锦囊[${ci}]`;
    if (!isObj(c)) { errors.push(`${t} 不是对象`); return; }
    if (typeof c.key !== 'string' || !c.key.trim()) errors.push(`${t}.key 缺失`);
    else if (cardKeys.has(c.key)) errors.push(`${t}.key 重复`);
    else cardKeys.add(c.key);
    if (typeof c.kind !== 'string' || !KT_KINDS.includes(c.kind)) errors.push(`${t}.kind 非法`);
    if (typeof c.target !== 'string' || !KT_TARGETS.includes(c.target)) errors.push(`${t}.target 非法`);
    if (c.deck !== undefined && (typeof c.deck !== 'number' || c.deck < 1 || c.deck > 4)) warnings.push(`${t}.deck 建议 1~4`);
  });

  if (qs !== undefined && !isObj(qs)) errors.push('questions 必须是 { 年级: 题目[] }');
  else if (isObj(qs)) for (const [g, list] of Object.entries(qs)) {
    if (!Array.isArray(list)) { errors.push(`questions.${g} 不是数组`); continue; }
    list.forEach((it, i) => {
      if (!isObj(it)) { errors.push(`questions.${g}[${i}] 不是对象`); return; }
      if (typeof it.q !== 'string' || !it.q.trim()) errors.push(`questions.${g}[${i}].q 缺失`);
      if (!Array.isArray(it.o) || it.o.length < 2) errors.push(`questions.${g}[${i}].o 至少 2 项`);
      if (typeof it.a !== 'number' || (Array.isArray(it.o) && (it.a < 0 || it.a >= it.o.length))) errors.push(`questions.${g}[${i}].a 越界`);
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

const path = process.argv[2];
if (!path) { console.error('用法：node scripts/validate-pack.mjs <pack.json>'); process.exit(2); }
let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); }
catch (e) { console.error('❌ 读取/解析失败：' + e.message); process.exit(1); }
const r = validate(data);
if (!r.ok) { console.error('❌ 校验失败：\n - ' + r.errors.join('\n - ')); process.exit(1); }
console.log('✅ 校验通过' + (r.warnings.length ? '\n⚠️ 告警：\n - ' + r.warnings.join('\n - ') : '（无平衡性告警）'));
process.exit(0);
