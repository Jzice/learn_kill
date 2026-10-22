/* ==================== 扩展包（初中 / 高中） ====================
 * 与「年级 / 学期」相互独立：年级决定题库范围，扩展包决定可选角色的学段，
 * 并为角色按学科追加该学段的主题技能（九科 × 初/高中 = 18 个技能）。
 */
import type { Character, Skill } from '../core/types';
import { charPoolForGrade } from './characters';
import { GRADE_ORDER } from './grades';
import { skillOf } from './skilldefs';

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
  const i = GRADE_ORDER.indexOf(grade);
  if (i >= 0) return i < 6 ? 'junior' : 'senior';
  // 未知年级：按「初 / 高」前缀推断，避免拼错的年级被一律当成高中生
  return grade.startsWith('初') ? 'junior' : 'senior';
}

/**
 * 学科 → 学段 → 主题技能（按学科定制）。
 * 定义集中在 src/data/skilldefs.ts（沿用旧 id，保证技能分支与联机兼容），
 * 由统一引擎分派，不再走 skills.ts 的 switch。
 */
const SUBJECT_SKILLS: Record<string, Record<Stage, Skill>> = {
  语文: { junior: skillOf('beisong'), senior: skillOf('wenyan') },
  数学: { junior: skillOf('youshu'), senior: skillOf('daoshu') },
  英语: { junior: skillOf('tingxie'), senior: skillOf('yufa') },
  物理: { junior: skillOf('fuli'), senior: skillOf('dianci') },
  化学: { junior: skillOf('fangchengshi'), senior: skillOf('youjihuaxue') },
  生物: { junior: skillOf('guanghe'), senior: skillOf('yichuan') },
  历史: { junior: skillOf('chaodai'), senior: skillOf('shiliao') },
  地理: { junior: skillOf('jingwei'), senior: skillOf('quwei') },
  政治: { junior: skillOf('fazhi'), senior: skillOf('zhexue') },
};

/** 按扩展包为角色追加该学段、该学科的主题技能（返回副本，不修改原角色数据） */
export function withPacketSkills(c: Character, packet: PacketId): Character {
  if (packet === 'all') return c;
  const sk = SUBJECT_SKILLS[c.subject]?.[packet];
  if (!sk || stageOf(c.grade) !== packet) return c;
  // 开发期防护：主题技 ID 不得与角色自有技能 / 主公技重复（曾因 youji 重名导致分支不执行）
  if (c.skills.some((s) => s.id === sk.id)) {
    console.warn(`[packets] 主题技 ${sk.id} 与角色 ${c.id} 自有技能重名，已跳过追加`);
    return c;
  }
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
