/* ==================== 角色（按年级累加） ==================== */
import type { Character, FactionId, Role } from '../core/types';
import { gradeSortKey } from './grades';

export const CHARACTERS: Character[] = [
  /* —— 初一上（基础角色） —— */
  { id: 'luxun', name: '鲁迅', title: '文坛斗士', faction: 'chinese', subject: '语文', hp: 3, avatar: '📖', grade: '初一上', skills: [{ id: 'nah', name: '呐喊', type: 'active', desc: '弃一张牌，令一名角色弃一张牌或失去1点体力' }, { id: 'hengmei', name: '横眉', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'libai', name: '李白', title: '诗仙', faction: 'chinese', subject: '语文', hp: 4, avatar: '🌙', grade: '初一上', skills: [{ id: 'jiangjinjiu', name: '将进酒', type: 'active', desc: '摸两张牌，本回合不能使用杀' }, { id: 'shicheng', name: '诗成', type: 'trigger', desc: '使用锦囊牌时摸一张牌' }] },
  { id: 'zuchongzhi', name: '祖冲之', title: '圆周率之父', faction: 'math', subject: '数学', hp: 3, avatar: '⭕', grade: '初一上', skills: [{ id: 'milv', name: '密率', type: 'active', desc: '弃一张牌，令一名角色判定，黑色受1点伤害' }, { id: 'zhuishu', name: '缀术', type: 'trigger', desc: '手牌上限+2' }] },
  { id: 'hualuogeng', name: '华罗庚', title: '数学大师', faction: 'math', subject: '数学', hp: 4, avatar: '🔢', grade: '初一上', skills: [{ id: 'tongchou', name: '统筹', type: 'active', desc: '将一张手牌交给一名角色，然后摸一张牌' }, { id: 'youxuan', name: '优选法', type: 'trigger', desc: '摸牌阶段额外摸一张牌，然后弃一张牌' }] },
  { id: 'shashibiya', name: '莎士比亚', title: '戏剧大师', faction: 'english', subject: '英语', hp: 3, avatar: '🎭', grade: '初一上', skills: [{ id: 'shisihang', name: '十四行诗', type: 'active', desc: '令一名角色交给你一张手牌或失去1点体力' }, { id: 'hamuleite', name: '哈姆雷特', type: 'trigger', desc: '受到伤害后令来源弃一张牌' }] },
  { id: 'niudun', name: '牛顿', title: '力学之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🍎', grade: '初一上', skills: [{ id: 'wanyou', name: '万有引力', type: 'trigger', desc: '计算距离-1' }, { id: 'sandadinglv', name: '三大定律', type: 'trigger', desc: '使用闪时摸一张牌' }] },
  { id: 'einstein', name: '爱因斯坦', title: '相对论之父', faction: 'physics', subject: '物理', hp: 3, avatar: '⚛️', grade: '初一上', skills: [{ id: 'xiangduilun', name: '相对论', type: 'trigger', desc: '使用杀时若目标手牌与你不同不可闪避' }, { id: 'zhineng', name: '质能方程', type: 'active', desc: '弃一张牌，令一名角色失去1点体力' }] },
  { id: 'menjieliefu', name: '门捷列夫', title: '元素周期表之父', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⚗️', grade: '初一上', skills: [{ id: 'zhouqilv', name: '周期律', type: 'active', desc: '令所有角色各摸一张牌' }, { id: 'yuansu', name: '元素', type: 'trigger', desc: '手牌上限+1' }] },
  { id: 'daerwen', name: '达尔文', title: '进化论之父', faction: 'biology', subject: '生物', hp: 4, avatar: '🧬', grade: '初一上', skills: [{ id: 'jinhualun', name: '进化论', type: 'active', desc: '摸两张牌然后弃一张牌' }, { id: 'shizhe', name: '适者生存', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'qinshihuang', name: '秦始皇', title: '千古一帝', faction: 'history', subject: '历史', hp: 4, avatar: '👑', grade: '初一上', skills: [{ id: 'tongyi', name: '统一', type: 'active', desc: '令所有其他角色各弃一张牌' }, { id: 'fenshu', name: '焚书', type: 'trigger', desc: '不能成为锦囊牌的目标' }] },
  { id: 'yuefei', name: '岳飞', title: '精忠报国', faction: 'history', subject: '历史', hp: 4, avatar: '⚔️', grade: '初一上', skills: [{ id: 'jingzhong', name: '精忠', type: 'trigger', desc: '使用杀造成伤害时伤害+1' }, { id: 'moxuyou', name: '莫须有', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'xuxiake', name: '徐霞客', title: '游圣', faction: 'geography', subject: '地理', hp: 4, avatar: '🌄', grade: '初一上', skills: [{ id: 'youji', name: '游记', type: 'active', desc: '令一名角色弃一张牌或让你摸一张牌' }, { id: 'tanxian', name: '探险', type: 'trigger', desc: '计算距离-1' }] },
  { id: 'kongzi', name: '孔子', title: '万世师表', faction: 'politics', subject: '政治', hp: 4, avatar: '🏛️', grade: '初一上', skills: [{ id: 'lunyu', name: '论语', type: 'active', desc: '令一名角色回复1点体力并摸一张牌' }, { id: 'jiaohua', name: '教化', type: 'trigger', desc: '使用锦囊牌时摸一张牌' }] },
  /* —— 初一下 —— */
  { id: 'dufu', name: '杜甫', title: '诗圣', faction: 'chinese', subject: '语文', hp: 3, avatar: '🍂', grade: '初一下', skills: [{ id: 'nah', name: '三吏三别', type: 'active', desc: '弃一张牌，令一名角色弃一张牌或失去1点体力' }, { id: 'moxuyou', name: '沉郁', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'gaosi', name: '高斯', title: '数学王子', faction: 'math', subject: '数学', hp: 4, avatar: '📐', grade: '初一下', skills: [{ id: 'zhouqilv', name: '算术研究', type: 'active', desc: '令所有角色各摸一张牌' }, { id: 'zhuishu', name: '数论直觉', type: 'trigger', desc: '手牌上限+2' }] },
  /* —— 初二上 —— */
  { id: 'faraday', name: '法拉第', title: '电磁感应之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🔋', grade: '初二上', skills: [{ id: 'zhineng', name: '电磁感应', type: 'active', desc: '弃一张牌，令一名角色失去1点体力' }, { id: 'sandadinglv', name: '场论', type: 'trigger', desc: '使用闪时摸一张牌' }] },
  { id: 'lavoisier', name: '拉瓦锡', title: '近代化学之父', faction: 'chemistry', subject: '化学', hp: 3, avatar: '🧪', grade: '初二上', skills: [{ id: 'cuihua', name: '质量守恒', type: 'active', desc: '令一名角色回复1点体力' }, { id: 'yuansu', name: '燃烧学说', type: 'trigger', desc: '手牌上限+1' }] },
  /* —— 初二下 —— */
  { id: 'zhenghe', name: '郑和', title: '七下西洋', faction: 'geography', subject: '地理', hp: 4, avatar: '⛵', grade: '初二下', skills: [{ id: 'tansuo', name: '下西洋', type: 'active', desc: '所有角色各摸一张牌' }, { id: 'tanxian', name: '航海图', type: 'trigger', desc: '计算距离-1' }] },
  { id: 'peigen', name: '培根', title: '英语散文家', faction: 'english', subject: '英语', hp: 4, avatar: '📜', grade: '初二下', skills: [{ id: 'yishu', name: '论读书', type: 'active', desc: '获得一名角色一张手牌' }, { id: 'jiaohua', name: '随笔', type: 'trigger', desc: '使用锦囊牌时摸一张牌' }] },
  /* —— 初三上 —— */
  { id: 'mengdeer', name: '孟德尔', title: '遗传学之父', faction: 'biology', subject: '生物', hp: 4, avatar: '🌱', grade: '初三上', skills: [{ id: 'jinhualun', name: '分离定律', type: 'active', desc: '摸两张牌然后弃一张牌' }, { id: 'shizhe', name: '显性性状', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'linzexu', name: '林则徐', title: '民族英雄', faction: 'history', subject: '历史', hp: 4, avatar: '🔥', grade: '初三上', skills: [{ id: 'tongyi', name: '虎门销烟', type: 'active', desc: '令所有其他角色各弃一张牌' }, { id: 'jingzhong', name: '海防', type: 'trigger', desc: '使用杀造成伤害时伤害+1' }] },
  /* —— 初三下 —— */
  { id: 'juli', name: '居里夫人', title: '放射性先驱', faction: 'chemistry', subject: '化学', hp: 3, avatar: '☢️', grade: '初三下', skills: [{ id: 'milv', name: '放射性', type: 'active', desc: '弃一张牌，令一名角色判定，黑色受1点伤害' }, { id: 'yuansu', name: '镭元素', type: 'trigger', desc: '手牌上限+1' }] },
  { id: 'dikaer', name: '笛卡尔', title: '解析几何之父', faction: 'math', subject: '数学', hp: 4, avatar: '🧮', grade: '初三下', skills: [{ id: 'tuiyan', name: '坐标系', type: 'active', desc: '令一名角色判定，黑色受1伤，红色摸1牌' }, { id: 'zhuishu', name: '我思故我在', type: 'trigger', desc: '手牌上限+2' }] },
  /* —— 高一上 —— */
  { id: 'zhuziqing', name: '朱自清', title: '散文大家', faction: 'chinese', subject: '语文', hp: 3, avatar: '📖', grade: '高一上', skills: [{ id: 'yishu', name: '背影', type: 'active', desc: '获得一名角色一张手牌' }, { id: 'shicheng', name: '荷塘月色', type: 'trigger', desc: '使用锦囊牌时摸一张牌' }] },
  { id: 'jialilue', name: '伽利略', title: '近代物理之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🔭', grade: '高一上', skills: [{ id: 'yinli', name: '自由落体', type: 'active', desc: '对一名角色造成1点伤害' }, { id: 'wanyou', name: '望远镜', type: 'trigger', desc: '计算距离-1' }] },
  /* —— 高一下 —— */
  { id: 'tuyouyou', name: '屠呦呦', title: '青蒿素发现者', faction: 'biology', subject: '生物', hp: 3, avatar: '🌿', grade: '高一下', skills: [{ id: 'cuihua', name: '青蒿素', type: 'active', desc: '令一名角色回复1点体力' }, { id: 'shizhe', name: '低温提取', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'hanfeizi', name: '韩非子', title: '法家集大成者', faction: 'politics', subject: '政治', hp: 4, avatar: '⚖️', grade: '高一下', skills: [{ id: 'xunjie', name: '法不阿贵', type: 'active', desc: '令一名角色弃一张牌或交给你一张牌' }, { id: 'moxuyou', name: '术势', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  /* —— 高二上 —— */
  { id: 'laoshe', name: '老舍', title: '人民艺术家', faction: 'chinese', subject: '语文', hp: 4, avatar: '🏙️', grade: '高二上', skills: [{ id: 'nah', name: '骆驼祥子', type: 'active', desc: '弃一张牌，令一名角色弃一张牌或失去1点体力' }, { id: 'hengmei', name: '茶馆', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'kexi', name: '柯西', title: '分析学大师', faction: 'math', subject: '数学', hp: 4, avatar: '∫', grade: '高二上', skills: [{ id: 'milv', name: '极限', type: 'active', desc: '弃一张牌，令一名角色判定，黑色受1点伤害' }, { id: 'zhuishu', name: '序列', type: 'trigger', desc: '手牌上限+2' }] },
  /* —— 高二下 —— */
  { id: 'kaikule', name: '凯库勒', title: '苯环发现者', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⬡', grade: '高二下', skills: [{ id: 'zhouqilv', name: '苯环', type: 'active', desc: '令所有角色各摸一张牌' }, { id: 'yuansu', name: '结构式', type: 'trigger', desc: '手牌上限+1' }] },
  { id: 'lishiguang', name: '李四光', title: '地质力学创始人', faction: 'geography', subject: '地理', hp: 4, avatar: '🪨', grade: '高二下', skills: [{ id: 'tansuo', name: '地质勘探', type: 'active', desc: '所有角色各摸一张牌' }, { id: 'tanxian', name: '构造体系', type: 'trigger', desc: '计算距离-1' }] },
  /* —— 高三上 —— */
  { id: 'pulangke', name: '普朗克', title: '量子论奠基人', faction: 'physics', subject: '物理', hp: 4, avatar: '⚛️', grade: '高三上', skills: [{ id: 'zhineng', name: '量子', type: 'active', desc: '弃一张牌，令一名角色失去1点体力' }, { id: 'sandadinglv', name: '普朗克常数', type: 'trigger', desc: '使用闪时摸一张牌' }] },
  { id: 'maodun', name: '茅盾', title: '文学巨匠', faction: 'chinese', subject: '语文', hp: 4, avatar: '🌃', grade: '高三上', skills: [{ id: 'nah', name: '子夜', type: 'active', desc: '弃一张牌，令一名角色弃一张牌或失去1点体力' }, { id: 'moxuyou', name: '批判', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  /* —— 高三下 —— */
  { id: 'lishizhen', name: '李时珍', title: '药圣', faction: 'biology', subject: '生物', hp: 4, avatar: '🌿', grade: '高三下', skills: [{ id: 'cuihua', name: '本草纲目', type: 'active', desc: '令一名角色回复1点体力' }, { id: 'shizhe', name: '行医', type: 'trigger', desc: '受到伤害后摸一张牌' }] },
  { id: 'luosefu', name: '卢瑟福', title: '核物理之父', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⚛️', grade: '高三下', skills: [{ id: 'yinli', name: '核模型', type: 'active', desc: '对一名角色造成1点伤害' }, { id: 'yuansu', name: '散射实验', type: 'trigger', desc: '手牌上限+1' }] },
];

export const ROLES: Record<Role, { name: string; color: string }> = {
  lord: { name: '主公', color: '#f5c542' },
  loyal: { name: '忠臣', color: '#27ae60' },
  rebel: { name: '反贼', color: '#e74c3c' },
  spy: { name: '内奸', color: '#9b59b6' },
};

export const ROLE_ICON: Record<Role, string> = {
  lord: '👑',
  loyal: '🛡️',
  rebel: '⚔️',
  spy: '🦊',
};

export const ROLE_CONFIG: Record<number, Role[]> = {
  2: ['lord', 'rebel'],
  3: ['lord', 'rebel', 'spy'],
  4: ['lord', 'loyal', 'rebel', 'spy'],
  5: ['lord', 'loyal', 'rebel', 'rebel', 'spy'],
  6: ['lord', 'loyal', 'rebel', 'rebel', 'rebel', 'spy'],
  7: ['lord', 'loyal', 'loyal', 'rebel', 'rebel', 'rebel', 'spy'],
  8: ['lord', 'loyal', 'loyal', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'],
};

export const EQUIP_SHORT: Record<string, string> = {
  诸葛连弩: '弩',
  青龙偃月刀: '刀',
  丈八蛇矛: '矛',
  八卦阵: '卦',
  仁王盾: '盾',
  '+1马': '+1',
  '-1马': '-1',
};

/** 角色池：选择年级时，包含该年级及之前所有年级的角色 */
export function charPoolForGrade(grade: string): Character[] {
  const limit = gradeSortKey(grade);
  return CHARACTERS.filter((c) => gradeSortKey(c.grade) <= limit);
}
