/* ==================== 角色（按年级累加） ====================
 * 46 名基础角色的技能全部引用 src/data/skilldefs.ts 的登记表（一人一面）。
 * 诸葛亮为全表唯一的三技能角色：观星（三国杀原版）+ 空城（三国杀原版）+ 出师表（新增）。
 * 技能数值按「PP 战力预算 + 点数命中率基准（R1~R5）」统一校准，详见 docs/游戏机制.md。
 */
import type { Character, FactionId, Gender, Role } from '../core/types';
import { gradeSortKey } from './grades';
import { skillOf } from './skilldefs';

export const CHARACTERS: Character[] = [
  /* —— 初一上（基础角色） —— */
  { id: 'luxun', name: '鲁迅', title: '文坛斗士', faction: 'chinese', subject: '语文', hp: 3, avatar: '📖', grade: '初一上', skills: [skillOf('luxun_nah'), skillOf('luxun_hengmei')] },
  { id: 'libai', name: '李白', title: '诗仙', faction: 'chinese', subject: '语文', hp: 4, avatar: '🌙', grade: '初一上', skills: [skillOf('libai_jiangjinjiu'), skillOf('libai_shicheng')] },
  { id: 'zuchongzhi', name: '祖冲之', title: '圆周率之父', faction: 'math', subject: '数学', hp: 3, avatar: '⭕', grade: '初一上', skills: [skillOf('zcz_milv'), skillOf('zcz_zhuishu')] },
  { id: 'hualuogeng', name: '华罗庚', title: '数学大师', faction: 'math', subject: '数学', hp: 4, avatar: '🔢', grade: '初一上', skills: [skillOf('hlg_tongchou'), skillOf('hlg_youxuan')] },
  { id: 'shashibiya', name: '莎士比亚', title: '戏剧大师', faction: 'english', subject: '英语', hp: 3, avatar: '🎭', grade: '初一上', skills: [skillOf('shashibiya_shs'), skillOf('shashibiya_hmlt')] },
  { id: 'niudun', name: '牛顿', title: '力学之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🍎', grade: '初一上', skills: [skillOf('niudun_sddl'), skillOf('niudun_wyyl')] },
  { id: 'einstein', name: '爱因斯坦', title: '相对论之父', faction: 'physics', subject: '物理', hp: 3, avatar: '⚛️', grade: '初一上', skills: [skillOf('ainstein_xdl'), skillOf('ainstein_znfc')] },
  { id: 'menjieliefu', name: '门捷列夫', title: '元素周期表之父', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⚗️', grade: '初一上', skills: [skillOf('mjlf_zql'), skillOf('mjlf_yuansu')] },
  { id: 'daerwen', name: '达尔文', title: '进化论之父', faction: 'biology', subject: '生物', hp: 4, avatar: '🧬', grade: '初一上', skills: [skillOf('dew_jhl'), skillOf('dew_szsc')] },
  { id: 'qinshihuang', name: '秦始皇', title: '千古一帝', faction: 'history', subject: '历史', hp: 4, avatar: '👑', grade: '初一上', skills: [skillOf('qsh_ty'), skillOf('qsh_fs')] },
  { id: 'yuefei', name: '岳飞', title: '精忠报国', faction: 'history', subject: '历史', hp: 4, avatar: '⚔️', grade: '初一上', skills: [skillOf('yf_jz'), skillOf('yf_mxy')] },
  { id: 'xuxiake', name: '徐霞客', title: '游圣', faction: 'geography', subject: '地理', hp: 4, avatar: '🌄', grade: '初一上', skills: [skillOf('xxk_yj'), skillOf('xxk_tx')] },
  { id: 'kongzi', name: '孔子', title: '万世师表', faction: 'politics', subject: '政治', hp: 4, avatar: '🏛️', grade: '初一上', skills: [skillOf('kz_ly'), skillOf('kz_yjwl')] },
  /* —— 初一下 —— */
  { id: 'dufu', name: '杜甫', title: '诗圣', faction: 'chinese', subject: '语文', hp: 3, avatar: '🍂', grade: '初一下', skills: [skillOf('dufu_sanli'), skillOf('dufu_chenyu')] },
  { id: 'gaosi', name: '高斯', title: '数学王子', faction: 'math', subject: '数学', hp: 4, avatar: '📐', grade: '初一下', skills: [skillOf('gaosi_suanshu'), skillOf('gaosi_shulun')] },
  { id: 'zhugeliang', name: '诸葛亮', title: '卧龙', faction: 'history', subject: '历史', hp: 3, avatar: '🪶', grade: '初一下', skills: [skillOf('zgl_gx'), skillOf('zgl_kc'), skillOf('zgl_csb')] },
  { id: 'zhangheng', name: '张衡', title: '科圣', faction: 'geography', subject: '地理', hp: 4, avatar: '🌐', grade: '初一上', skills: [skillOf('zh_ddy'), skillOf('zh_hts')] },
  /* —— 初二上 —— */
  { id: 'faraday', name: '法拉第', title: '电磁感应之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🔋', grade: '初二上', skills: [skillOf('faladi_dcyg'), skillOf('faladi_changlun')] },
  { id: 'lavoisier', name: '拉瓦锡', title: '近代化学之父', faction: 'chemistry', subject: '化学', hp: 3, avatar: '🧪', grade: '初二上', skills: [skillOf('lwx_zlsh'), skillOf('lwx_rshxs')] },
  { id: 'baside', name: '巴斯德', title: '微生物学之父', faction: 'biology', subject: '生物', hp: 4, avatar: '🦠', grade: '初二上', skills: [skillOf('bsd_mj'), skillOf('bsd_my')] },
  { id: 'mozi', name: '墨子', title: '兼爱非攻', faction: 'politics', subject: '政治', hp: 4, avatar: '☯️', grade: '初二上', skills: [skillOf('mozi_fg'), skillOf('mozi_ja')] },
  /* —— 初二下 —— */
  { id: 'zhenghe', name: '郑和', title: '七下西洋', faction: 'geography', subject: '地理', hp: 4, avatar: '⛵', grade: '初二下', skills: [skillOf('zh_xxy'), skillOf('zh_hht')] },
  { id: 'peigen', name: '培根', title: '英语散文家', faction: 'english', subject: '英语', hp: 4, avatar: '📜', grade: '初二下', skills: [skillOf('peigen_lundushu'), skillOf('peigen_suibi')] },
  { id: 'lidayaun', name: '郦道元', title: '水经注作者', faction: 'geography', subject: '地理', hp: 4, avatar: '🗺️', grade: '初二下', skills: [skillOf('ldy_sjz'), skillOf('ldy_yd')] },
  { id: 'shelley', name: '雪莱', title: '浪漫派诗人', faction: 'english', subject: '英语', hp: 3, avatar: '🕊️', grade: '初二下', skills: [skillOf('xuelai_xfs'), skillOf('xuelai_shibian')] },
  /* —— 初三上 —— */
  { id: 'mengdeer', name: '孟德尔', title: '遗传学之父', faction: 'biology', subject: '生物', hp: 4, avatar: '🌱', grade: '初三上', skills: [skillOf('mde_fll'), skillOf('mde_xxxz')] },
  { id: 'linzexu', name: '林则徐', title: '民族英雄', faction: 'history', subject: '历史', hp: 4, avatar: '🔥', grade: '初三上', skills: [skillOf('lzx_hmxy'), skillOf('lzx_hf')] },
  { id: 'sunzi', name: '孙子', title: '兵圣', faction: 'politics', subject: '政治', hp: 3, avatar: '⚔️', grade: '初三上', skills: [skillOf('sz_bf'), skillOf('sz_xs')] },
  /* —— 初三下 —— */
  { id: 'juli', name: '居里夫人', title: '放射性先驱', faction: 'chemistry', subject: '化学', hp: 3, avatar: '☢️', grade: '初三下', skills: [skillOf('juli_fsx'), skillOf('juli_lys')] },
  { id: 'dikaer', name: '笛卡尔', title: '解析几何之父', faction: 'math', subject: '数学', hp: 4, avatar: '🧮', grade: '初三下', skills: [skillOf('dikaer_zuobiao'), skillOf('dikaer_wosi')] },
  /* —— 高一上 —— */
  { id: 'zhuziqing', name: '朱自清', title: '散文大家', faction: 'chinese', subject: '语文', hp: 3, avatar: '📝', grade: '高一上', skills: [skillOf('zhuziqing_beiying'), skillOf('zhuziqing_hetang')] },
  { id: 'jialilue', name: '伽利略', title: '近代物理之父', faction: 'physics', subject: '物理', hp: 4, avatar: '🔭', grade: '高一上', skills: [skillOf('jialilue_zylt'), skillOf('jialilue_wyj')] },
  { id: 'matuwen', name: '马克·吐温', title: '美国幽默大师', faction: 'english', subject: '英语', hp: 3, avatar: '📚', grade: '高一上', skills: [skillOf('matuwen_bwyb'), skillOf('matuwen_fc')] },
  { id: 'mengzi', name: '孟子', title: '亚圣', faction: 'politics', subject: '政治', hp: 4, avatar: '📜', grade: '高一上', skills: [skillOf('mz_rz'), skillOf('mz_wd')] },
  /* —— 高一下 —— */
  { id: 'tuyouyou', name: '屠呦呦', title: '青蒿素发现者', faction: 'biology', subject: '生物', hp: 3, avatar: '🌿', grade: '高一下', skills: [skillOf('tyy_qhs'), skillOf('tyy_dwtq')] },
  { id: 'hanfeizi', name: '韩非子', title: '法家集大成者', faction: 'politics', subject: '政治', hp: 4, avatar: '⚖️', grade: '高一下', skills: [skillOf('hfz_fbag'), skillOf('hfz_ss')] },
  /* —— 高二上 —— */
  { id: 'laoshe', name: '老舍', title: '人民艺术家', faction: 'chinese', subject: '语文', hp: 4, avatar: '🏙️', grade: '高二上', skills: [skillOf('laoshe_chaguan'), skillOf('laoshe_xiangzi')] },
  { id: 'kexi', name: '柯西', title: '分析学大师', faction: 'math', subject: '数学', hp: 4, avatar: '∫', grade: '高二上', skills: [skillOf('kexi_jixian'), skillOf('kexi_xulie')] },
  { id: 'simaqian', name: '司马迁', title: '史家之绝唱', faction: 'history', subject: '历史', hp: 3, avatar: '📜', grade: '高二上', skills: [skillOf('smq_sb'), skillOf('smq_rrfz')] },
  /* —— 高二下 —— */
  { id: 'kaikule', name: '凯库勒', title: '苯环发现者', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⬡', grade: '高二下', skills: [skillOf('kkl_bh'), skillOf('kkl_jgs')] },
  { id: 'lishiguang', name: '李四光', title: '地质力学创始人', faction: 'geography', subject: '地理', hp: 4, avatar: '🪨', grade: '高二下', skills: [skillOf('lsg_dzkt'), skillOf('lsg_gztx')] },
  /* —— 高三上 —— */
  { id: 'pulangke', name: '普朗克', title: '量子论奠基人', faction: 'physics', subject: '物理', hp: 4, avatar: '⚛️', grade: '高三上', skills: [skillOf('pulangke_liangzi'), skillOf('pulangke_cs')] },
  { id: 'maodun', name: '茅盾', title: '文学巨匠', faction: 'chinese', subject: '语文', hp: 4, avatar: '🌃', grade: '高三上', skills: [skillOf('maodun_ziye'), skillOf('maodun_pipan')] },
  /* —— 高三下 —— */
  { id: 'lishizhen', name: '李时珍', title: '药圣', faction: 'biology', subject: '生物', hp: 4, avatar: '🌿', grade: '高三下', skills: [skillOf('lsz_bcgm'), skillOf('lsz_xy')] },
  { id: 'luosefu', name: '卢瑟福', title: '核物理之父', faction: 'chemistry', subject: '化学', hp: 4, avatar: '⚛️', grade: '高三下', skills: [skillOf('lsf_hmx'), skillOf('lsf_sssy')] },
  { id: 'dickens', name: '狄更斯', title: '批判现实主义大师', faction: 'english', subject: '英语', hp: 3, avatar: '📖', grade: '初一上', skills: [skillOf('digengsi_scj'), skillOf('digengsi_wdge')] },
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
  青釭剑: '釭',
  雌雄双股剑: '雌',
  贯石斧: '斧',
  方天画戟: '戟',
  寒冰剑: '冰',
  古锭刀: '锭',
  八卦阵: '卦',
  仁王盾: '盾',
  藤甲: '藤',
  白银狮子: '狮',
  '+1马': '+1',
  '-1马': '-1',
};

/** 角色性别：仅【雌雄双股剑】判定异性时使用；未列出者按「男」处理 */
export const CHAR_GENDER: Record<string, Gender> = {
  juli: 'female',
  tuyouyou: 'female',
};

/** 角色池：选择年级时，包含该年级及之前所有年级的角色 */
export function charPoolForGrade(grade: string): Character[] {
  const limit = gradeSortKey(grade);
  return CHARACTERS.filter((c) => gradeSortKey(c.grade) <= limit);
}
