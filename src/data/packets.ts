/* ==================== 扩展包（初中 / 高中） ====================
 * 与「年级 / 学期」相互独立：年级决定题库范围，扩展包决定可选角色的学段，
 * 并为角色按学科追加该学段的主题技能（九科 × 初/高中 = 18 个技能）。
 */
import type { Character, Skill } from '../core/types';
import { charPoolForGrade } from './characters';

export type PacketId = 'all' | 'junior' | 'senior';
/** 学段：初中（初一上~初三下）/ 高中（高一上~高三下） */
export type Stage = 'junior' | 'senior';

export interface Packet {
  id: PacketId;
  name: string;
  icon: string;
  desc: string;
}

export const PACKETS: Packet[] = [
  { id: 'all', name: '全部', icon: '🎓', desc: '初中 + 高中角色均可，不追加主题技能' },
  { id: 'junior', name: '初中扩展包', icon: '📗', desc: '仅初中角色，各科追加初中主题技能' },
  { id: 'senior', name: '高中扩展包', icon: '📘', desc: '仅高中角色，各科追加高中主题技能' },
];

/** 角色所属学段：由年级派生（初一~初三=初中；高一~高三=高中） */
export function stageOf(grade: string): Stage {
  return grade.startsWith('初') ? 'junior' : 'senior';
}

/** 学科 → 学段 → 主题技能（按学科定制） */
const SUBJECT_SKILLS: Record<string, Record<Stage, Skill>> = {
  语文: {
    junior: { id: 'beisong', name: '背诵', type: 'active', desc: '弃一张手牌，摸两张牌（背诵默写，积累素材）' },
    senior: { id: 'wenyan', name: '文言', type: 'active', desc: '弃两张手牌，摸三张牌（文言积累，厚积薄发）' },
  },
  数学: {
    junior: { id: 'youlrshu', name: '有理数', type: 'active', desc: '弃一张手牌，令一名角色判定：红色其摸一张，黑色其弃一张' },
    senior: { id: 'daoshu', name: '导数', type: 'active', desc: '弃一张手牌，令一名角色弃两张手牌（求导取极值）' },
  },
  英语: {
    junior: { id: 'tingxie', name: '听写', type: 'active', desc: '弃一张手牌，获得一名角色的一张手牌（听写抽查）' },
    senior: { id: 'yufa', name: '语法', type: 'active', desc: '展示牌堆顶三张，获得其中一张，其余置入弃牌堆（语法填空）' },
  },
  物理: {
    junior: { id: 'fuli', name: '浮力', type: 'trigger', desc: '计算距离-1（浮力托举）' },
    senior: { id: 'dianci', name: '电磁', type: 'active', desc: '弃一张手牌，对一名角色造成1点伤害（电磁感应）' },
  },
  化学: {
    junior: { id: 'fangchengshi', name: '方程式', type: 'trigger', desc: '手牌上限+1（配平储备）' },
    senior: { id: 'youji', name: '有机', type: 'active', desc: '弃两张手牌，回复1点体力并摸一张牌（有机合成）' },
  },
  生物: {
    junior: { id: 'guanghe', name: '光合', type: 'trigger', desc: '摸牌阶段额外摸一张牌（光合作用产能）' },
    senior: { id: 'yichuan', name: '遗传', type: 'trigger', desc: '手牌上限+2（遗传信息承载）' },
  },
  历史: {
    junior: { id: 'chaodai', name: '朝代', type: 'active', desc: '弃一张手牌，令所有其他角色各弃一张手牌（改朝换代）' },
    senior: { id: 'shiliao', name: '史料', type: 'active', desc: '弃一张手牌，所有存活角色各摸一张牌（史料共享）' },
  },
  地理: {
    junior: { id: 'jingwei', name: '经纬', type: 'trigger', desc: '计算距离-1（经纬定位）' },
    senior: { id: 'quwei', name: '区位', type: 'trigger', desc: '使用锦囊牌时摸一张牌（区位分析）' },
  },
  政治: {
    junior: { id: 'fazhi', name: '法治', type: 'active', desc: '弃一张手牌，令一名角色回复1点体力（法治保障）' },
    senior: { id: 'zhexue', name: '哲学', type: 'active', desc: '弃一张手牌，令一名角色交给你一张手牌（思辨论证）' },
  },
};

/** 按扩展包为角色追加该学段、该学科的主题技能（返回副本，不修改原角色数据） */
export function withPacketSkills(c: Character, packet: PacketId): Character {
  if (packet === 'all') return c;
  const sk = SUBJECT_SKILLS[c.subject]?.[packet];
  if (!sk || stageOf(c.grade) !== packet) return c;
  return { ...c, skills: [...c.skills, sk] };
}

/** 按年级累加 + 按扩展包筛选学段，并追加主题技能 */
export function charPoolForPacket(grade: string, packet: PacketId): Character[] {
  const pool = charPoolForGrade(grade);
  if (packet === 'all') return pool;
  return pool.filter((c) => stageOf(c.grade) === packet).map((c) => withPacketSkills(c, packet));
}

export function packetName(id: PacketId): string {
  return PACKETS.find((p) => p.id === id)?.name || '全部';
}
