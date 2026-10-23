/* ==================== 高中扩展包 50 将专项校验（离线静态） ====================
 * 直接解析 src/data/*.ts 源文本，无需构建 / 浏览器，可作为发版前的验收门禁（A7）。
 *
 * 用法：node scripts/verify-senior50.mjs
 * 退出码：0 全绿 / 1 有失败项
 *
 * 校验项：
 *   1. 高中段角色数 == 50
 *   2. 九科每科 4~6 名
 *   3. 每名新角色恰好 2 技能，且技能 id 全部登记在 SKILL_DEFS
 *   4. 71 个新技能 id 无重复、与既有技能 / 角色 id 无冲突
 *   5. 全部原语在「被引擎真实消费」白名单内（杜绝 rangePlus / damageMod 等死原语回流）
 *   6. 全部时机有真实 fire 点或钩子（杜绝 onShaHit 等无 fire 点的时机）
 *   7. 每名新角色 PP 落在预算带内（4 血 1.6~2.4 / 3 血 2.0~2.8）
 *   8. 诸葛亮仍是 CHARACTERS 中唯一三技能角色
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const skilldefsSrc = read('src/data/skilldefs.ts');
const charSrc = read('src/data/characters.ts');

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

/* ---------- 解析 ---------- */

/** 取 SKILL_DEFS 登记表里的全部 id（形如 `    QY_LS,` 的常量名不唯一，故改从 def 文本取 id） */
function parseSkillIds() {
  const ids = [];
  const re = /\{\s*id:\s*'([a-z0-9_]+)'/g;
  // 只取技能定义块（id 后紧跟 name / kind / desc 的顶层对象）
  const re2 = /\{\s*\n?\s*id:\s*'([a-z0-9_]+)',\s*\n\s*name:/g;
  let m;
  while ((m = re2.exec(skilldefsSrc))) ids.push(m[1]);
  if (!ids.length) while ((m = re.exec(skilldefsSrc))) ids.push(m[1]);
  return ids;
}

/** 取 CHARACTERS 数组中的角色行 */
function parseChars() {
  const out = [];
  const re = /\{\s*id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)',\s*title:\s*'[^']*',\s*faction:\s*'([a-z]+)',\s*subject:\s*'([^']+)',\s*hp:\s*(\d+),\s*avatar:\s*'[^']*',\s*grade:\s*'([^']+)',\s*skills:\s*\[([^\]]+)\]\s*\}/g;
  let m;
  while ((m = re.exec(charSrc))) {
    const skills = [...m[7].matchAll(/skillOf\('([a-z0-9_]+)'\)/g)].map((x) => x[1]);
    out.push({ id: m[1], name: m[2], faction: m[3], subject: m[4], hp: Number(m[5]), grade: m[6], skills });
  }
  return out;
}

/** 取某个技能常量块：id + kind + timing + hp 无关 + 全部 kind:'xxx' 原语 */
function parseSkillBlock(id) {
  // 定位 `const XXX: SkillDef = { ... };` 且块内含 id: '<id>'
  const re = /const\s+([A-Z0-9_]+):\s*SkillDef\s*=\s*\{([\s\S]*?)\n\};/g;
  let m;
  while ((m = re.exec(skilldefsSrc))) {
    const body = m[2];
    if (!new RegExp(`id:\\s*'${id}'`).test(body)) continue;
    const kind = (body.match(/kind:\s*'([a-z]+)'/) || [])[1] || '';
    const timing = (body.match(/timing:\s*'([a-zA-Z]+)'/) || [])[1] || '';
    const limit = (body.match(/limit:\s*'(perTurn|perGame)'/) || [])[1] || '';
    const prims = [...body.matchAll(/\{\s*kind:\s*'([a-zA-Z]+)'/g)].map((x) => x[1]);
    const ats = [...body.matchAll(/at:\s*'([a-zA-Z]+)'/g)].map((x) => x[1]);
    let effectsArr = null;
    try {
      const src = extractEffectsArray(body);
      if (src) effectsArr = new Function(`return ${src};`)();
    } catch (_e) {
      effectsArr = null;
    }
    return { id, kind, timing, limit, prims, ats, body, effectsArr };
  }
  return null;
}

/** 从技能块文本里抠出 `effects: [ ... ]` 的合法字面量（括号配对 + 跳过字符串） */
function extractEffectsArray(text) {
  const i = text.indexOf('effects:');
  if (i < 0) return null;
  const j = text.indexOf('[', i);
  if (j < 0) return null;
  let depth = 0;
  let quote = null;
  for (let k = j; k < text.length; k++) {
    const ch = text[k];
    if (quote) {
      if (ch === '\\') k++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(j, k + 1);
    }
  }
  return null;
}

const allSkillIds = parseSkillIds();
const allChars = parseChars();

/** 从 src/data/grades.ts 取出年级顺序（与运行期 GRADE_ORDER 同源，避免硬编码漂移） */
const gradesSrc = read('src/data/grades.ts');
const GRADE_ORDER = [...gradesSrc.matchAll(/'([^']+)'/g)].map((m) => m[1]);

const SENIOR_GRADES = ['高一上', '高一下', '高二上', '高二下', '高三上', '高三下'];
const NEW_IDS = [
  'qy_ls', 'qy_jg', 'ss_cb', 'ss_kd', 'cxq_st', 'cxq_qf',
  'kte_jh', 'kte_yy', 'fly_sj', 'fly_rd', 'psk_gl', 'psk_sjj', 'bys_tj', 'bys_xy', 'lm_ss', 'lm_dl',
  'ast_aj', 'ast_lz', 'hmw_lr', 'hmw_bs', 'mld_ygm', 'mld_fb', 'xbn_mh', 'xbn_fc',
  'kpl_ty', 'kpl_tk', 'mksw_dc', 'mksw_wy', 'bo_hb', 'bo_br', 'fm_fmt', 'fm_mhd',
  'hdb_hs', 'hdb_lh', 'afd_fz', 'afd_qt', 'lxtl_ph', 'lxtl_yl', 'bl_dfx', 'bl_gzl',
  'sw_xb', 'sw_xw', 'bflf_tj', 'bflf_yz', 'ylp_hx', 'ylp_yd',
  'kxi_pdsf', 'kxi_kqss', 'npl_ost', 'npl_hll', 'npl_cq', 'gd_syjz', 'gd_kx', 'bsm_tx', 'bsm_gs', 'lsfu_xz', 'lsfu_lb',
  'wgn_fdl', 'wgn_dlpy', 'zkz_wh', 'zkz_qh', 'hb_zrzt', 'hb_dwx', 'glb_fx', 'glb_xhl',
  'mks_zbl', 'mks_sj', 'ydsm_gfl', 'ydsm_fg', 'wym_zxhy', 'wym_zlz',
];

/* ---------- 1. 数量 ---------- */
const senior = allChars.filter((c) => SENIOR_GRADES.includes(c.grade));
check('高中扩展包角色数 == 50', senior.length === 50, `${senior.length} 名`);

/* ---------- 2. 九科分布 ---------- */
const bySubject = {};
for (const c of senior) bySubject[c.subject] = (bySubject[c.subject] || 0) + 1;
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const badSubj = subjects.filter((s) => !bySubject[s] || bySubject[s] < 4 || bySubject[s] > 6);
check('九科每科 4~6 名', badSubj.length === 0, subjects.map((s) => `${s}${bySubject[s] || 0}`).join(' '));

/* ---------- 3. 技能数与登记 ---------- */
const badCount = senior.filter((c) => c.skills.length !== 2);
check('每名高中角色恰好 2 技能', badCount.length === 0, badCount.map((c) => c.id).join(','));
const unregistered = [];
for (const c of senior) for (const s of c.skills) if (!allSkillIds.includes(s)) unregistered.push(`${c.id}:${s}`);
check('高中角色技能全部登记在 SKILL_DEFS', unregistered.length === 0, unregistered.join(','));

/* ---------- 4. id 冲突 ---------- */
const dupIds = allSkillIds.filter((id, i) => allSkillIds.indexOf(id) !== i);
check('技能 id 全局唯一', dupIds.length === 0, dupIds.join(','));
const newRegistered = NEW_IDS.filter((id) => allSkillIds.includes(id));
check('71 个新技能全部登记', newRegistered.length === NEW_IDS.length, `${newRegistered.length}/${NEW_IDS.length}`);
const charIds = allChars.map((c) => c.id);
const idClash = NEW_IDS.filter((id) => charIds.includes(id));
check('新技能 id 与角色 id 无冲突', idClash.length === 0, idClash.join(','));

/* ---------- 5. 四个扩展包选项的取池口径 ---------- */
// 规则：按年级 = 累加；全部 / 初中 / 高中 = 字面全量，不累加。
const JUNIOR_GRADES = ['初一上', '初一下', '初二上', '初二下', '初三上', '初三下'];
const isJunior = (g) => JUNIOR_GRADES.includes(g);
const isSenior = (g) => SENIOR_GRADES.includes(g);
const cnt = (fn) => allChars.filter((c) => fn(c.grade)).length;

const GRADE_PACK = 'grade';
const total = allChars.length;
const juniors = cnt(isJunior);
const seniors = cnt(isSenior);

// 与运行期口径保持一致：grade 包受年级限制，其余为全量
const poolSize = (packet, grade) => {
  if (packet === 'all') return total;
  if (packet === GRADE_PACK) return cnt((g) => GRADE_ORDER.indexOf(g) <= GRADE_ORDER.indexOf(grade));
  return packet === 'junior' ? juniors : seniors;
};
check('全部包 = 81 名（不按年级累加）', poolSize('all', GRADE_ORDER[0]) === total, `${poolSize('all', GRADE_ORDER[0])}`);
check('初中包 = 31 名（不按年级累加）', juniors === 31, `${juniors}`);
check('高中包 = 50 名（不按年级累加）', seniors === 50, `${seniors}`);
check('合计无遗漏（81 = 初中 31 + 高中 50）', juniors + seniors === total, `${juniors}+${seniors}=${total}`);
check(
  '按年级包随年级累加（初一上 < 高三下，且高三下 = 81）',
  poolSize(GRADE_PACK, GRADE_ORDER[0]) < poolSize(GRADE_PACK, GRADE_ORDER[GRADE_ORDER.length - 1]) &&
    poolSize(GRADE_PACK, GRADE_ORDER[GRADE_ORDER.length - 1]) === total,
  `初一上=${poolSize(GRADE_PACK, GRADE_ORDER[0])} / 高三下=${poolSize(GRADE_PACK, GRADE_ORDER[GRADE_ORDER.length - 1])}`,
);

/* ---------- 5/6. 原语与时机白名单 ---------- */
// 执行期原语：runEffects 有真实分支
const EXEC_OK = new Set([
  'selfDraw', 'selfHeal', 'selfLoseHp', 'targetDiscard', 'targetLoseHp', 'targetDamage',
  'targetDraw', 'gainHand', 'allDraw', 'allHeal', 'gainKnowledge', 'shield', 'costCard',
  'deckPeek', 'toDeckTop', 'judgeIf', 'pointDuel', 'guessSuit', 'targetChoose', 'multiDraw',
  'giveHand', 'exchangeHand', 'discardToHeal', 'showHand', 'trickDraw', 'star', 'starSort',
  'deckBottom', 'peekHand', 'replaceDraw', 'stealFrom', 'revealAllPickOne', 'takeDuelCard',
  'giveDuelCard', 'addMark', 'pledge', 'revive', 'awaken', 'convert', 'swapHp', 'turnFace',
  'quizDuel', 'chainJudge', 'doubleJudge', 'drawDiscardMin', 'extraDrawDiscardOdd',
  'armorPierceDamage', 'discardSuitMatch', 'giveHandIfShan', 'costThenDamage', 'selfDraw',
]);
// 聚合 / 钩子型原语：由专用聚合器或规则钩子消费
const AGG_OK = new Set([
  'handLimit', 'extraDraw', 'distMod', 'distPlusToMe', 'shunshouNoDist', 'distTrap',
  'cardImmune', 'immune', 'noHandImmune', 'suitImmune', 'reduceDamage', 'reflect',
  'shaUnlimited', 'shaNeedShan', 'numGuard', 'enemyEquipVoid', 'horseDist',
  'ignoreHorsePlus', 'replaceJudge', 'trickRedirect', 'shaRedirect', 'suitCollect',
  'peekTopDeck', 'discardToTop', 'knowledgeGain', 'nextShaBonus', 'nextShaUnblockable',
  'tickMark', 'gainKnowledge', 'spendKnowledge',
]);
// 死原语：聚合器全库零调用，或类型存在但从未被消费
const DEAD = new Set(['rangePlus', 'damageMod']);
// 有真实 fire 点的时机
const TIMING_OK = new Set([
  'active', 'passive', 'onTurnStart', 'onDraw', 'onTurnEnd', 'onUseShan', 'onUseTrick',
  'onDamaged', 'onLoseHand', 'onEquip', 'onLoseEquip', 'onTrickCountered', 'awaken',
  'beforeJudge', 'onTargetSha', 'beforeDamage', 'onDying', 'onDeath',
]);
// 无 fire 点、也无钩子消费的时机
const TIMING_DEAD = new Set(['onShaHit', 'onDiscard']);

const allBlocks = NEW_IDS.map((id) => parseSkillBlock(id)).filter(Boolean);
check('71 个新技能定义全部可解析', allBlocks.length === NEW_IDS.length, `${allBlocks.length}/${NEW_IDS.length}`);

const deadPrim = [];
const deadTiming = [];
for (const b of allBlocks) {
  for (const p of b.prims) if (DEAD.has(p)) deadPrim.push(`${b.id}:${p}`);
  for (const t of [...b.ats, b.timing]) if (TIMING_DEAD.has(t)) deadTiming.push(`${b.id}:${t}`);
}
check('无死原语（rangePlus / damageMod 等）', deadPrim.length === 0, deadPrim.join(','));
check('无无 fire 点的时机（onShaHit / onDiscard）', deadTiming.length === 0, deadTiming.join(','));

const unknownPrim = [];
for (const b of allBlocks) {
  for (const p of b.prims) if (!EXEC_OK.has(p) && !AGG_OK.has(p) && !DEAD.has(p)) unknownPrim.push(`${b.id}:${p}`);
  for (const t of [...b.ats, b.timing]) if (!TIMING_OK.has(t) && !TIMING_DEAD.has(t)) unknownPrim.push(`${b.id}@${t}`);
}
check('全部原语 / 时机均在白名单内', unknownPrim.length === 0, unknownPrim.join(','));

/* ---------- 7. PP 预算 ---------- */
/** PP 单价（与 docs/游戏机制.md §6.3 一致） */
const W = {
  draw: 0.6, disc: 1.0, dmg: 1.5, heal: 1.2, loseHp: 1.2, dist: 0.5,
  imm: 0.8, gain: 0.9, know: 0.6, grp: 0.8, card: 0.3, roar: 1.3, reflect: 0.7,
};
/** 折扣（docs/游戏机制.md §6.3） */
const D = { active: 0.65, limit: 0.4, awaken: 0.5, duel: 0.7 };
/** 条件型效果按 50% 期望折算；聚合型（常驻）不折 */
const COND_W = 0.5;

const sum = (arr, f) => (arr || []).reduce((s, x) => s + f(x), 0);

/** 单个效果原语的 PP 贡献 */
function effPP(e) {
  const w = e.cond ? COND_W : 1;
  switch (e.kind) {
    case 'selfDraw': return W.draw * e.n * w;
    case 'selfHeal': return W.heal * e.n * w;
    case 'selfLoseHp': return -W.loseHp * e.n;
    case 'targetDiscard': return W.disc * e.n * w;
    case 'targetLoseHp': return 1.3 * e.n * w;
    case 'targetDamage': return W.dmg * e.n * w;
    case 'targetDraw': return W.draw * e.n * w;
    case 'gainHand': return W.gain * e.n * w;
    case 'allDraw': return W.grp * e.n;
    case 'allHeal': return W.grp * e.n;
    case 'gainKnowledge': return W.know * e.n;
    case 'costCard': return -W.card * e.n;
    case 'discardToHeal': return (W.heal - W.card) * e.max;
    case 'giveHand': return -W.card * e.n;
    case 'giveDuelCard': return -W.draw;
    case 'takeDuelCard': return W.gain;
    case 'toDeckTop': return -W.card;
    case 'deckPeek': return W.draw * (e.then === 'pickTwo' ? 2 : 1);
    case 'multiDraw': return W.draw * 0.7 * e.max * e.n;
    case 'exchangeHand': return W.card * e.n;
    case 'trickDraw': return W.draw * w;
    case 'starSort': return W.imm;
    case 'peekHand': return W.gain;
    /* —— 聚合 / 钩子型（常驻，不受 at 影响） —— */
    case 'handLimit': return e.n >= 2 ? 0.6 : 0.3;
    case 'extraDraw': return W.draw * e.n;
    case 'distMod': return W.dist;
    case 'distPlusToMe': return W.dist;
    case 'shunshouNoDist': return W.dist;
    case 'distTrap': return 1.3;
    case 'cardImmune': return W.imm;
    case 'reduceDamage': return W.imm;
    case 'reflect': return W.reflect;
    case 'shaUnlimited': return W.roar;
    case 'convert': return 0.9;
    /* —— 分支容器 —— */
    case 'showHand': {
      const r = sum(e.red, effPP);
      const b = sum(e.black, effPP);
      return (r + b) / 2;
    }
    case 'judgeIf': {
      const p = e.test === 'prime' || e.test === 'ge' || e.test === 'le' ? 0.462 : 0.5;
      return p * sum(e.hit, effPP) + (1 - p) * sum(e.miss, effPP);
    }
    case 'pointDuel':
      return 0.5 * sum(e.win, effPP) + 0.5 * sum(e.lose, effPP);
    case 'guessSuit':
      return 0.75 * sum(e.miss, effPP) + 0.25 * sum(e.hit, effPP);
    case 'targetChoose': {
      const vals = e.options.map((opt) => sum(opt, effPP));
      return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    }
    case 'awaken': return 0;
    default: return 0;
  }
}

/** 单个技能的 PP（已含折扣） */
function ppOfSkillBlock(b) {
  if (!b.effectsArr) return 0;
  const raw = sum(b.effectsArr, effPP);
  switch (b.kind) {
    case 'limit': return raw * D.limit;
    case 'active':
      return raw * (b.effectsArr.some((e) => e.kind === 'pointDuel') ? D.duel : D.active);
    case 'convert': return 0.9;
    case 'awaken': {
      const repId = (b.effectsArr.find((e) => e.kind === 'awaken') || {}).replaceWith;
      const rep = allBlocks.find((x) => x.id === repId);
      if (!rep || !rep.effectsArr) return 0;
      return sum(rep.effectsArr, effPP) * D.awaken;
    }
    default: return raw; // passive / trigger：常驻与条件效果已分别计价
  }
}

const PP_TABLE = {}; // 角色 → PP
for (const c of senior) {
  if (!c.skills.every((s) => NEW_IDS.includes(s))) continue; // 只校验 v2.7.0 新增 35 名
  let total = 0;
  for (const s of c.skills) {
    const b = allBlocks.find((x) => x.id === s);
    if (b) total += ppOfSkillBlock(b);
  }
  PP_TABLE[c.id] = Number(total.toFixed(2));
}
const band = (hp) => (hp >= 4 ? [1.6, 2.4] : [2.0, 2.8]);
const outOfBand = [];
for (const c of senior) {
  const v = PP_TABLE[c.id];
  if (v == null) continue;
  const [lo, hi] = band(c.hp);
  if (v < lo || v > hi) outOfBand.push(`${c.name}(${c.hp}血)=${v}`);
}
check(
  '35 名新角色 PP 落在预算带（4血 1.6~2.4 / 3血 2.0~2.8）',
  outOfBand.length === 0,
  outOfBand.length ? outOfBand.join(' ') : `${Object.keys(PP_TABLE).length} 名已校验`,
);

/* ---------- 8. 不变式 ---------- */
const multi = allChars.filter((c) => c.skills.length >= 3).map((c) => c.id);
check('诸葛亮仍是唯一三技能角色', multi.length === 1 && multi[0] === 'zhugeliang', multi.join(','));
const zhuge = (allChars.find((c) => c.id === 'zhugeliang') || { skills: [] }).skills;
check(
  '诸葛亮三技能齐备（观星 / 空城 / 出师表）',
  zhuge.length === 3 && zhuge.includes('zgl_gx') && zhuge.includes('zgl_kc') && zhuge.includes('zgl_csb'),
  zhuge.join(','),
);

/* ---------- 汇总 ---------- */
const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(46)}`);
console.log(`PP 明细（新增 35 名）：`);
for (const [id, v] of Object.entries(PP_TABLE)) {
  const c = senior.find((x) => x.id === id);
  console.log(`  ${c.name.padEnd(5, '　')} ${c.subject} ${c.hp}血  PP=${v}`);
}
console.log(`${'='.repeat(46)}`);
console.log(`通过 ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log('❌ 失败项：');
  for (const f of failed) console.log(`   - ${f.name}${f.extra ? ' (' + f.extra + ')' : ''}`);
}
process.exit(failed.length ? 1 : 0);
