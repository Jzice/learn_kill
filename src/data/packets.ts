/* ==================== 扩展包（按年级 / 初中 / 高中 / 全部） ====================
 * 与「年级 / 学期」相互独立，年级只决定题库范围。四个选项的取池规则：
 *   - 按年级 grade ：按当前年级 / 学期**累加**（默认），不追加主题技能
 *   - 初中 junior  ：初中角色**全部**（不按年级累加），各科追加初中主题技能
 *   - 高中 senior  ：高中角色**全部**（不按年级累加），各科追加高中主题技能
 *   - 全部 all     ：包含**所有角色**（不按年级累加、不分学段），不追加主题技能
 */
import type { Character, Skill } from '../core/types';
import { CHARACTERS, charPoolForGrade } from './characters';
import { GRADE_ORDER } from './grades';
import { skillOf } from './skilldefs';

/** 扩展包：'grade' 表示「按当前年级累加」；其余为按学段全量 */
export type PacketId = 'all' | 'junior' | 'senior' | 'grade';
/** 学段：初中（初一上~初三下）/ 高中（高一上~高三下） */
export type Stage = 'junior' | 'senior';

export interface Packet {
  id: PacketId;
  name: string;
  icon: string;
  desc: string;
}

export const PACKETS: Packet[] = [
  { id: 'grade', name: '按年级', icon: '📚', desc: '按当前年级 / 学期累加，不追加主题技能' },
  { id: 'junior', name: '初中扩展包', icon: '📗', desc: '初中角色全部，各科追加初中主题技能' },
  { id: 'senior', name: '高中扩展包', icon: '📘', desc: '高中角色全部，各科追加高中主题技能' },
  { id: 'all', name: '全部', icon: '🎓', desc: '包含所有角色，不分年级与学段' },
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

/**
 * 按扩展包为角色追加该学段、该学科的主题技能（返回副本，不修改原角色数据）。
 * 仅「初中 / 高中」两个分学段包追加主题技能；「按年级 / 全部」不追加。
 */
export function withPacketSkills(c: Character, packet: PacketId): Character {
  if (packet === 'all' || packet === 'grade') return c;
  const sk = SUBJECT_SKILLS[c.subject]?.[packet];
  if (!sk || stageOf(c.grade) !== packet) return c;
  // 开发期防护：主题技 ID 不得与角色自有技能 / 主公技重复（曾因 youji 重名导致分支不执行）
  if (c.skills.some((s) => s.id === sk.id)) {
    console.warn(`[packets] 主题技 ${sk.id} 与角色 ${c.id} 自有技能重名，已跳过追加`);
    return c;
  }
  return { ...c, skills: [...c.skills, sk] };
}

/**
 * 按扩展包取角色池（**均不受当前年级限制**）：
 *   - all   ：全部角色
 *   - grade ：按当前年级 / 学期累加
 *   - junior/senior：该学段全量
 */
export function charPoolForPacket(grade: string, packet: PacketId): Character[] {
  if (packet === 'all') return CHARACTERS.slice();
  if (packet === 'grade') return charPoolForGrade(grade);
  return CHARACTERS.filter((c) => stageOf(c.grade) === packet).map((c) => withPacketSkills(c, packet));
}

export function packetName(id: PacketId): string {
  return PACKETS.find((p) => p.id === id)?.name || '全部';
}

/**
 * 该扩展包的角色总数：
 *   - all          ：全部角色数（81）
 *   - grade        ：按当前年级累加后的数量（随年级变化）
 *   - junior/senior：该学段全量（不受年级限制）
 */
export function packetCharCount(packet: PacketId, grade?: string): number {
  if (packet === 'all') return CHARACTERS.length;
  if (packet === 'grade') return grade ? charPoolForGrade(grade).length : CHARACTERS.length;
  return CHARACTERS.filter((c) => stageOf(c.grade) === packet).length;
}
