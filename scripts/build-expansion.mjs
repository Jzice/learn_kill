/* ==================== 扩展包生成器 + 校验器 ====================
 * 单一事实来源：下方 SEED（12 学期 × 9 学科 = 108 名角色）。
 * 先校验（角色 id 唯一 / 学期学科覆盖完整 / 技能 id 唯一 / 原语合法 / 定价分档合法），
 * 校验通过后生成 src/data/expansion.ts（角色、技能原语、定价、装备目录与查询函数）。
 *
 * 运行：node scripts/build-expansion.mjs
 * 仅在学分商店相关功能需要刷新时才需运行（角色/技能/定价改动后）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ---------- 学期 / 学科 ---------- */
const GRADES = [
  '初一上', '初一下', '初二上', '初二下', '初三上', '初三下',
  '高一上', '高一下', '高二上', '高二下', '高三上', '高三下',
];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const FACTION_OF = {
  语文: 'chinese', 数学: 'math', 英语: 'english', 物理: 'physics',
  化学: 'chemistry', 生物: 'biology', 历史: 'history', 地理: 'geography', 政治: 'politics',
};
const AVATAR_OF = {
  语文: '📜', 数学: '🔢', 英语: '🔤', 物理: '⚛️', 化学: '⚗️',
  生物: '🧬', 历史: '📜', 地理: '🌏', 政治: '⚖️',
};
const SUBJ_SHORT = { 语文: 'cn', 数学: 'ma', 英语: 'en', 物理: 'ph', 化学: 'ch', 生物: 'bi', 历史: 'hi', 地理: 'ge', 政治: 'po' };

/* 每个学科 12 个学期对应的「知识点主题」作为技能名（呼应学期 syllabus） */
const TOPICS = {
  语文: ['默写·春', '标点·陋室铭', '文言·三峡', '诗词·茅屋', '议论·敬业', '戏剧·威尼斯', '现代文·故都', '诗歌·氓', '小说·祝福', '散文·荷塘', '古文·劝学', '论述·拿来'],
  数学: ['有理数', '实数', '全等三角形', '一次函数', '二次函数', '圆', '集合', '三角函数', '立体几何', '导数', '数列', '概率统计'],
  英语: ['Letters&Sounds', 'DailyTalk', 'SchoolLife', 'Stories', 'Grammar', 'Writing', 'Reading', 'Culture', 'Argument', 'Translation', 'Cloze', 'Summary'],
  物理: ['声现象', '光现象', '运动学', '力与压强', '电学', '电磁', '运动定律', '曲线运动', '电场', '电磁感应', '动量', '波与光'],
  化学: ['物质变化', '空气氧气', '水与溶液', '碳与燃料', '酸碱盐', '金属', '物质的量', '元素周期', '反应速率', '有机基础', '电化学', '物质结构'],
  生物: ['细胞', '植物', '人体营养', '神经调节', '遗传', '生态', '分子与细胞', '代谢', '稳态', '生物工程', '进化', '生态工程'],
  历史: ['史前·元谋', '隋唐', '近代抗争', '民主共和', '工业革命', '二战', '古代中国', '世界近代', '中国近现代', '世界现代', '改革', '全球化'],
  地理: ['地球地图', '气候', '中国地形', '河流', '世界分区', '经济发展', '宇宙地球', '人文地理', '区域生态', '国土整治', '自然地理', '区域发展'],
  政治: ['中学时代', '青春', '法律', '公民', '国情', '世界舞台', '经济生活', '政治生活', '哲学', '文化', '辩证法', '人生价值'],
};

/* ---------- 效果原语构造（随学期强度递增） ---------- */
const EFFECT_KINDS = new Set([
  'selfDraw', 'targetDiscard', 'targetLoseHp', 'targetDamage', 'targetHeal',
  'targetDraw', 'gainHand', 'allDiscard', 'allDraw', 'extraDraw',
  'handLimit', 'distMod', 'damageMod', 'shield', 'costCard',
]);

// 主动技主题模板：返回 {type:'active', effects}
function activeArchetype(subject, i) {
  const p = Math.min(3, Math.floor(i / 4)); // 0..3 强度档
  switch (subject) {
    case '语文': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 + p }] };
    case '数学': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetLoseHp', n: 1 }] };
    case '英语': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 + (p > 0 ? 1 : 0) }] };
    case '物理': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetDamage', n: 1 }] };
    case '化学': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetHeal', n: 1 }] };
    case '历史': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'allDiscard', n: 1 }] };
    case '地理': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 1 + (p > 0 ? 1 : 0) }] };
    case '政治': return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetHeal', n: 1 }] };
    default: return { type: 'active', effects: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 }] };
  }
}
// 触发技主题模板：返回 {type:'trigger', effects}
function triggerArchetype(subject, i) {
  switch (subject) {
    case '生物': return { type: 'trigger', effects: [{ kind: 'extraDraw', n: 1 }] };          // 光合产能
    case '地理': return { type: 'trigger', effects: [{ kind: 'distMod', delta: -1 }] };         // 经纬定位
    case '数学': return { type: 'trigger', effects: [{ kind: 'handLimit', n: 1 }] };            // 厚积薄发
    case '物理': return { type: 'trigger', effects: [{ kind: 'damageMod', delta: 1 }] };        // 力大无穷
    case '化学': return { type: 'trigger', effects: [{ kind: 'handLimit', n: 1 }] };            // 配平储备
    default: return activeArchetype(subject, i);
  }
}

/* ---------- 高中扩展包：按「知识点主题」逐一定制的技能设计 ----------
 * 高一上~高三下（学期下标 6..11）。此前高中与初中共用同一套「学科原型」模板，
 * 同学科 6 个学期的技能几乎雷同（仅强度档不同），且化学与政治、生物与初中生物完全重复。
 * 现按每个知识点的特色逐一定制：九科 × 六学期 = 54 个互不相同的技能；
 * 生物 / 地理为触发技（仅用 extraDraw/handLimit/distMod/damageMod 四种可被钩子聚合的原语），
 * 其余为主动技；强度随学段递进（高三技强，体力更低，见下方 hp）。
 */
const SENIOR_SKILLS = {
  语文: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }], // 现代文·故都：细读积累
    7: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 }, { kind: 'targetDraw', n: 1 }], // 诗歌·氓：吟诗共赏
    8: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 }], // 小说·祝福：剖析人物
    9: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }, { kind: 'shield', n: 1 }], // 散文·荷塘：静心安神
    10: [{ kind: 'costCard', n: 2 }, { kind: 'selfDraw', n: 3 }], // 古文·劝学：厚积薄发
    11: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 2 }], // 论述·拿来：辩证批判
  },
  数学: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 1 }], // 集合：取交集
    7: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }], // 三角函数：周期循环
    8: [{ kind: 'costCard', n: 1 }, { kind: 'targetLoseHp', n: 1 }], // 立体几何：降维打击
    9: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 2 }], // 导数：求导取极值
    10: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 }, { kind: 'targetDraw', n: 1 }], // 数列：递推共生
    11: [{ kind: 'costCard', n: 2 }, { kind: 'targetDamage', n: 2 }], // 概率统计：小概率重击
  },
  英语: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 }], // Reading：阅读理解
    7: [{ kind: 'costCard', n: 1 }, { kind: 'targetDraw', n: 1 }], // Culture：文化交流
    8: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 1 }], // Argument：驳论拆招
    9: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 }, { kind: 'gainHand', n: 1 }], // Translation：转换增益
    10: [{ kind: 'costCard', n: 2 }, { kind: 'selfDraw', n: 3 }], // Cloze：完形积累
    11: [{ kind: 'costCard', n: 2 }, { kind: 'gainHand', n: 2 }], // Summary：归纳摄取
  },
  物理: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'targetDamage', n: 1 }], // 运动定律：作用力
    7: [{ kind: 'costCard', n: 1 }, { kind: 'targetDamage', n: 1 }, { kind: 'selfDraw', n: 1 }], // 曲线运动：抛体轨迹
    8: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 1 }], // 电场：静电屏蔽
    9: [{ kind: 'costCard', n: 2 }, { kind: 'targetDamage', n: 2 }], // 电磁感应：感应生能
    10: [{ kind: 'costCard', n: 1 }, { kind: 'targetLoseHp', n: 1 }], // 动量：动量传递
    11: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }], // 波与光：波动传播
  },
  化学: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 1 }, { kind: 'shield', n: 1 }], // 物质的量：计量守恒
    7: [{ kind: 'costCard', n: 1 }, { kind: 'targetHeal', n: 1 }], // 元素周期：周期调和
    8: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }], // 反应速率：催化加速
    9: [{ kind: 'costCard', n: 2 }, { kind: 'targetHeal', n: 1 }, { kind: 'selfDraw', n: 1 }], // 有机基础：有机合成
    10: [{ kind: 'costCard', n: 1 }, { kind: 'targetDamage', n: 1 }], // 电化学：电解冲击
    11: [{ kind: 'costCard', n: 2 }, { kind: 'shield', n: 2 }], // 物质结构：结构稳固
  },
  生物: {
    6: [{ kind: 'extraDraw', n: 1 }], // 分子与细胞
    7: [{ kind: 'extraDraw', n: 1 }, { kind: 'handLimit', n: 1 }], // 代谢
    8: [{ kind: 'handLimit', n: 2 }], // 稳态
    9: [{ kind: 'extraDraw', n: 2 }], // 生物工程
    10: [{ kind: 'extraDraw', n: 1 }, { kind: 'handLimit', n: 1 }, { kind: 'distMod', delta: -1 }], // 进化
    11: [{ kind: 'extraDraw', n: 2 }, { kind: 'handLimit', n: 1 }], // 生态工程
  },
  历史: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'allDiscard', n: 1 }], // 古代中国：时代洪流
    7: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 2 }], // 世界近代：列强掠夺
    8: [{ kind: 'costCard', n: 1 }, { kind: 'allDiscard', n: 1 }, { kind: 'selfDraw', n: 1 }], // 中国近现代：变革中自强
    9: [{ kind: 'costCard', n: 2 }, { kind: 'allDiscard', n: 2 }], // 世界现代：全面洗牌
    10: [{ kind: 'costCard', n: 1 }, { kind: 'targetDraw', n: 1 }, { kind: 'selfDraw', n: 1 }], // 改革：改革红利
    11: [{ kind: 'costCard', n: 2 }, { kind: 'allDraw', n: 1 }], // 全球化：全球协作
  },
  地理: {
    6: [{ kind: 'distMod', delta: -1 }], // 宇宙地球：视野开阔
    7: [{ kind: 'handLimit', n: 1 }, { kind: 'extraDraw', n: 1 }], // 人文地理：物产丰饶
    8: [{ kind: 'extraDraw', n: 1 }, { kind: 'handLimit', n: 2 }], // 区域生态：生态承载
    9: [{ kind: 'distMod', delta: -1 }, { kind: 'handLimit', n: 1 }], // 国土整治：通达整治
    10: [{ kind: 'distMod', delta: -1 }, { kind: 'extraDraw', n: 1 }], // 自然地理：山川通衢
    11: [{ kind: 'distMod', delta: -2 }], // 区域发展：枢纽通达
  },
  政治: {
    6: [{ kind: 'costCard', n: 1 }, { kind: 'targetHeal', n: 1 }], // 经济生活：民生保障
    7: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 1 }], // 政治生活：制度约束
    8: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 }], // 哲学：思辨取牌
    9: [{ kind: 'costCard', n: 1 }, { kind: 'targetDraw', n: 1 }, { kind: 'selfDraw', n: 1 }], // 文化：文化繁荣
    10: [{ kind: 'costCard', n: 1 }, { kind: 'targetLoseHp', n: 1 }, { kind: 'selfDraw', n: 1 }], // 辩证法：辩证批判
    11: [{ kind: 'costCard', n: 2 }, { kind: 'allDraw', n: 1 }, { kind: 'shield', n: 1 }], // 人生价值：价值共享且自守
  },
};

// 高中（i>=6）按上表逐一定制；初中（i<6）沿用原有学科原型模板
function buildSkill(subject, i) {
  const topic = TOPICS[subject][i];
  if (i >= 6) {
    const effects = SENIOR_SKILLS[subject][i];
    const type = subject === '生物' || subject === '地理' ? 'trigger' : 'active';
    return { arch: { type, effects }, topic };
  }
  // 初中：生物/地理为触发技，其余为主动技（原版行为）
  const useTrigger = subject === '生物' || subject === '地理';
  const arch = useTrigger ? triggerArchetype(subject, i) : activeArchetype(subject, i);
  return { arch, topic };
}

/* ---------- 装备目录（可学分购买，局前配装，不进牌堆） ----------
 * grade：解锁所需年级（商店按「当前年级 ≥ 该年级」才可购买），体现年级等级进度与激励。
 * tier：1 普通(80) / 2 精良(200) / 3 稀有(400) / 4 史诗(800，高年级专属)
 */
const EQUIPS = [
  // —— 普通（初一上起）——
  { id: 'eq_wpn_1', name: '木剑', slot: 'weapon', tier: 1, grade: '初一上', icon: '🗡️', desc: '攻击距离 +1', fx: { range: 1 } },
  { id: 'eq_arm_1', name: '布甲', slot: 'armor', tier: 1, grade: '初一上', icon: '🥋', desc: '受到的伤害 -1（每回合限一次）', fx: { reduce: 1 } },
  { id: 'eq_hp_1', name: '黄骠马', slot: 'horsePlus', tier: 1, grade: '初一上', icon: '🐎', desc: '其他角色计算与你的距离 +1', fx: { distPlus: 1 } },
  { id: 'eq_hm_1', name: '青骢马', slot: 'horseMinus', tier: 1, grade: '初一上', icon: '🐎', desc: '你计算与其他角色的距离 -1', fx: { distMinus: 1 } },
  // —— 精良（初三上起）——
  { id: 'eq_wpn_2', name: '精钢剑', slot: 'weapon', tier: 2, grade: '初三上', icon: '⚔️', desc: '攻击距离 +1，出杀伤害 +1', fx: { range: 1, dmg: 1 } },
  { id: 'eq_arm_2', name: '锁子甲', slot: 'armor', tier: 2, grade: '初三上', icon: '🛡', desc: '受到的伤害 -1，开局护盾 +1', fx: { reduce: 1, shield: 1 } },
  { id: 'eq_hp_2', name: '赤兔马', slot: 'horsePlus', tier: 2, grade: '初三上', icon: '🐴', desc: '其他角色计算与你的距离 +1', fx: { distPlus: 1 } },
  { id: 'eq_hm_2', name: '照夜玉狮子', slot: 'horseMinus', tier: 2, grade: '初三上', icon: '🐴', desc: '你计算与其他角色的距离 -1', fx: { distMinus: 1 } },
  // —— 稀有（高三上起）——
  { id: 'eq_wpn_3', name: '倚天剑', slot: 'weapon', tier: 3, grade: '高三上', icon: '🗡', desc: '攻击距离 +2，出杀伤害 +1', fx: { range: 2, dmg: 1 } },
  { id: 'eq_arm_3', name: '金丝甲', slot: 'armor', tier: 3, grade: '高三上', icon: '🛡️', desc: '受到的伤害 -1，开局护盾 +2', fx: { reduce: 1, shield: 2 } },
  { id: 'eq_hp_3', name: '的卢', slot: 'horsePlus', tier: 3, grade: '高三上', icon: '🐎', desc: '其他角色计算与你的距离 +1，你计算距离 -1', fx: { distPlus: 1, distMinus: 1 } },
  { id: 'eq_hm_3', name: '绝影', slot: 'horseMinus', tier: 3, grade: '高三上', icon: '🐎', desc: '你计算与其他角色的距离 -1，开局护盾 +1', fx: { distMinus: 1, shield: 1 } },
  // —— 史诗（高三上 / 高三下，新增：更强复合效果）——
  { id: 'eq_wpn_4', name: '方天画戟', slot: 'weapon', tier: 4, grade: '高三上', icon: '🔱', desc: '攻击距离 +2，出杀伤害 +1，开局护盾 +1', fx: { range: 2, dmg: 1, shield: 1 } },
  { id: 'eq_arm_4', name: '永动盾', slot: 'armor', tier: 4, grade: '高三上', icon: '🛡', desc: '受到的伤害 -1，开局护盾 +3', fx: { reduce: 1, shield: 3 } },
  { id: 'eq_hp_4', name: '神行靴', slot: 'horsePlus', tier: 4, grade: '高三上', icon: '👟', desc: '其他角色计算与你的距离 +2', fx: { distPlus: 2 } },
  { id: 'eq_hm_4', name: '缩地符', slot: 'horseMinus', tier: 4, grade: '高三上', icon: '🌀', desc: '你计算与其他角色的距离 -2', fx: { distMinus: 2 } },
  { id: 'eq_wpn_5', name: '青釭剑·真', slot: 'weapon', tier: 4, grade: '高三下', icon: '⚔️', desc: '攻击距离 +2，出杀伤害 +2', fx: { range: 2, dmg: 2 } },
  { id: 'eq_arm_5', name: '金丝软甲', slot: 'armor', tier: 4, grade: '高三下', icon: '🥋', desc: '受到的伤害 -1，开局护盾 +2，其他角色计算与你的距离 +1', fx: { reduce: 1, shield: 2, distPlus: 1 } },
];
const EQUIP_PRICE = { 1: 80, 2: 200, 3: 400, 4: 800 };

/* ---------- 道具目录（消耗类，局末清空） ---------- */
const ITEMS = [
  { id: 'it_reset', name: '温故符', icon: '🔄', desc: '立即温故知新，摸 1 张牌', maxCarry: 3, effects: [{ kind: 'selfDraw', n: 1 }] },
  { id: 'it_shield', name: '护身符', icon: '🛡', desc: '获得 1 点护盾（抵挡一次伤害）', maxCarry: 3, effects: [{ kind: 'shield', n: 1 }] },
  { id: 'it_draw', name: '灵感符', icon: '✨', desc: '立即摸两张牌', maxCarry: 3, effects: [{ kind: 'selfDraw', n: 2 }] },
  { id: 'it_peek', name: '锦囊符', icon: '📜', desc: '令一名角色弃一张手牌', maxCarry: 2, effects: [{ kind: 'targetDiscard', n: 1 }] },
  // 新增道具
  { id: 'it_peek2', name: '拆弹符', icon: '💣', desc: '令一名角色弃两张手牌', maxCarry: 2, effects: [{ kind: 'targetDiscard', n: 2 }] },
  { id: 'it_wall', name: '铁壁符', icon: '🧱', desc: '获得 2 点护盾', maxCarry: 2, effects: [{ kind: 'shield', n: 2 }] },
];

/* ---------- 生成 108 角色 ---------- */
const chars = [];
const skillsById = {};
const seenCharIds = new Set();
const seenSkillIds = new Set();
const coverage = {};
for (let i = 0; i < GRADES.length; i++) {
  for (const subject of SUBJECTS) {
    const grade = GRADES[i];
    const code = SUBJ_SHORT[subject];
    const charId = `ex_${i}_${code}`;
    const skillId = `${charId}_sk`;
    const { arch, topic } = buildSkill(subject, i);
    if (seenCharIds.has(charId)) throw new Error(`角色 id 重复: ${charId}`);
    if (seenSkillIds.has(skillId)) throw new Error(`技能 id 重复: ${skillId}`);
    seenCharIds.add(charId);
    seenSkillIds.add(skillId);
    const skill = {
      id: skillId,
      name: topic,
      type: arch.type,
      desc: describeEffect(arch.effects),
      effects: arch.effects,
    };
    skillsById[skillId] = skill;
    // 体力设计：高一/高二 4 血，高三 3 血（高三技能更强，以体力换强度）；初中维持原节奏
    const hp = i >= 6 ? (i >= 10 ? 3 : 4) : (i % 3 === 0 ? 4 : 3);
    chars.push({
      id: charId,
      name: topic,
      title: `${grade}·${subject}学子`,
      faction: FACTION_OF[subject],
      subject,
      hp,
      avatar: AVATAR_OF[subject],
      grade,
      skills: [skill],
    });
    coverage[`${grade}/${subject}`] = true;
  }
}

/* ---------- 校验 ---------- */
const errors = [];
if (chars.length !== 108) errors.push(`角色数量应为 108，实际 ${chars.length}`);
for (const g of GRADES) for (const s of SUBJECTS) if (!coverage[`${g}/${s}`]) errors.push(`缺少覆盖：${g}/${s}`);
// 高中技能设计必须完整（九科 × 六学期）
for (const s of SUBJECTS) for (let i = 6; i < 12; i++) if (!SENIOR_SKILLS[s] || !SENIOR_SKILLS[s][i]) errors.push(`缺少高中技能设计：${GRADES[i]}/${s}`);
// 触发技只能使用可被规则钩子聚合的原语，否则运行时为空转
const TRIGGER_KINDS = new Set(['extraDraw', 'handLimit', 'distMod', 'damageMod']);
for (const c of chars) {
  if (c.skills[0].type !== 'trigger') continue;
  for (const e of c.skills[0].effects) if (!TRIGGER_KINDS.has(e.kind)) errors.push(`触发技 ${c.skills[0].id} 含不可聚合原语: ${e.kind}`);
}
// 原语合法性
const allEffects = chars.flatMap((c) => c.skills[0].effects);
for (const e of allEffects) if (!EFFECT_KINDS.has(e.kind)) errors.push(`非法原语: ${e.kind}`);
// 装备/道具 id 唯一
const eqIds = new Set(EQUIPS.map((e) => e.id));
if (eqIds.size !== EQUIPS.length) errors.push('装备 id 不唯一');
for (const e of EQUIPS) if (!GRADES.includes(e.grade)) errors.push(`装备 ${e.id} 年级门槛非法: ${e.grade}`);
for (const e of EQUIPS) if (!(e.tier in EQUIP_PRICE)) errors.push(`装备 ${e.id} 档位无定价: ${e.tier}`);
const itIds = new Set(ITEMS.map((i) => i.id));
if (itIds.size !== ITEMS.length) errors.push('道具 id 不唯一');
for (const it of ITEMS) if (!it.effects.every((e) => EFFECT_KINDS.has(e.kind))) errors.push(`道具 ${it.id} 含非法原语`);

if (errors.length) {
  console.error('⚠ 扩展包校验失败：');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

/* ---------- 写入 data/expansion TSV（便于审阅，非运行必需） ---------- */
const tsvDir = path.join(ROOT, 'data', 'expansion');
fs.mkdirSync(tsvDir, { recursive: true });
const charRows = ['id\tname\ttitle\tfaction\tsubject\tgrade\thp\tavatar\tskillId\tskillName\tskillType\tskillDesc'];
for (const c of chars) {
  const s = c.skills[0];
  charRows.push([c.id, c.name, c.title, c.faction, c.subject, c.grade, c.hp, c.avatar, s.id, s.name, s.type, s.desc].join('\t'));
}
fs.writeFileSync(path.join(tsvDir, 'chars.tsv'), charRows.join('\n') + '\n', 'utf8');
const skillRows = ['id\tname\ttype\tkind(s)\tdesc'];
for (const c of chars) {
  const s = c.skills[0];
  skillRows.push([s.id, s.name, s.type, s.effects.map((e) => e.kind).join(','), s.desc].join('\t'));
}
fs.writeFileSync(path.join(tsvDir, 'skills.tsv'), skillRows.join('\n') + '\n', 'utf8');

/* ---------- 生成 src/data/expansion.ts ---------- */
const charPrice = (c) => 120 + GRADES.indexOf(c.grade) * 40; // 初一上120 … 高三下600
const header = `// 本文件由 scripts/build-expansion.mjs 生成，请勿手改。
// 单一事实来源：scripts/build-expansion.mjs 的 SEED（12 学期 × 9 学科 = 108 名角色）。
import type { Character, EquipSlot, ItemDef, Skill, SkillEffect } from '../core/types';

export interface EquipDef {
  id: string;
  name: string;
  slot: EquipSlot;
  tier: 1 | 2 | 3 | 4;
  /** 解锁所需年级（商店按年级门槛展示 / 购买） */
  grade: string;
  icon: string;
  desc: string;
  /** 装备效果（在 setup 时折算为玩家加成） */
  fx: { range?: number; dmg?: number; reduce?: number; shield?: number; distPlus?: number; distMinus?: number };
}

export const EXPANSION_CHARS: Character[] = ${JSON.stringify(chars, null, 2)};

export const EXPANSION_SKILLS: Skill[] = ${JSON.stringify(chars.map((c) => c.skills[0]), null, 2)};

export const EXPANSION_EQUIPS: EquipDef[] = ${JSON.stringify(EQUIPS, null, 2)};

export const EXPANSION_ITEMS: ItemDef[] = ${JSON.stringify(ITEMS, null, 2)};

/** 角色学分定价（按学期递增分档） */
export const CHAR_PRICE: Record<string, number> = {
${chars.map((c) => `  '${c.id}': ${charPrice(c)},`).join('\n')}
};

/** 装备学分定价（按 tier：普通80 / 精良200 / 稀有400 / 史诗800） */
export const EQUIP_PRICE: Record<number, number> = ${JSON.stringify(EQUIP_PRICE)};

export function expansionCharById(id: string): Character | undefined {
  return EXPANSION_CHARS.find((c) => c.id === id);
}
export function expansionEquipById(id: string): EquipDef | undefined {
  return EXPANSION_EQUIPS.find((e) => e.id === id);
}
export function expansionItemById(id: string): ItemDef | undefined {
  return EXPANSION_ITEMS.find((i) => i.id === id);
}
`;

fs.writeFileSync(path.join(ROOT, 'src', 'data', 'expansion.ts'), header, 'utf8');
console.log(`✅ 扩展包校验通过：108 角色 / ${EQUIPS.length} 装备 / ${ITEMS.length} 道具，已生成 src/data/expansion.ts`);

/* ---------- 效果描述（生成技能 desc） ---------- */
function describeEffect(effects) {
  const parts = [];
  for (const e of effects) {
    switch (e.kind) {
      case 'selfDraw': parts.push(`摸 ${e.n} 张牌`); break;
      case 'targetDiscard': parts.push(`令一名角色弃 ${e.n} 张牌`); break;
      case 'targetLoseHp': parts.push(`令一名角色失去 ${e.n} 点体力`); break;
      case 'targetDamage': parts.push(`对一名角色造成 ${e.n} 点伤害`); break;
      case 'targetHeal': parts.push(`令一名角色回复 ${e.n} 点体力`); break;
      case 'targetDraw': parts.push(`令一名角色摸 ${e.n} 张牌`); break;
      case 'gainHand': parts.push(`获得一名角色 ${e.n} 张手牌`); break;
      case 'allDiscard': parts.push(`令所有其他角色各弃 ${e.n} 张牌`); break;
      case 'allDraw': parts.push(`令所有角色各摸 ${e.n} 张牌`); break;
      case 'extraDraw': parts.push(`摸牌阶段额外摸 ${e.n} 张牌（触发）`); break;
      case 'handLimit': parts.push(`手牌上限 +${e.n}（触发）`); break;
      case 'distMod': parts.push(`计算距离 ${e.delta < 0 ? '−' : '+'} ${Math.abs(e.delta)}（触发）`); break;
      case 'damageMod': parts.push(`出杀/伤害 +${e.delta}（触发）`); break;
      case 'shield': parts.push(`获得 ${e.n} 点护盾`); break;
      case 'costCard': parts.push(`弃 ${e.n} 张手牌`); break;
    }
  }
  return parts.join('，');
}
