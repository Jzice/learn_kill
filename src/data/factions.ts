/* ==================== 九科阵营 ====================
 * 主公技定义集中在 src/data/skilldefs.ts（沿用旧 id，保证联机兼容）。
 */
import type { Faction, FactionId } from '../core/types';
import { skillOf } from './skilldefs';

export const FACTIONS: Record<FactionId, Faction> = {
  chinese: {
    name: '语文',
    color: '#e74c3c',
    icon: '📖',
    subject: '语文',
    desc: '文学素养',
    lordSkill: skillOf('shishu'),
  },
  math: {
    name: '数学',
    color: '#3498db',
    icon: '🔢',
    subject: '数学',
    desc: '数理推演',
    lordSkill: skillOf('tuiyan'),
  },
  english: {
    name: '英语',
    color: '#27ae60',
    icon: '🔤',
    subject: '英语',
    desc: '语言交流',
    lordSkill: skillOf('yishu'),
  },
  physics: {
    name: '物理',
    color: '#f39c12',
    icon: '⚛️',
    subject: '物理',
    desc: '力学探索',
    lordSkill: skillOf('yinli'),
  },
  chemistry: {
    name: '化学',
    color: '#9b59b6',
    icon: '⚗️',
    subject: '化学',
    desc: '元素反应',
    lordSkill: skillOf('cuihua'),
  },
  biology: {
    name: '生物',
    color: '#16a085',
    icon: '🧬',
    subject: '生物',
    desc: '生命奥秘',
    lordSkill: skillOf('jinhualun'),
  },
  history: {
    name: '历史',
    color: '#d35400',
    icon: '🏛️',
    subject: '历史',
    desc: '古今明鉴',
    lordSkill: skillOf('mingjian'),
  },
  geography: {
    name: '地理',
    color: '#2980b9',
    icon: '🌍',
    subject: '地理',
    desc: '山河万象',
    lordSkill: skillOf('tansuo'),
  },
  politics: {
    name: '政治',
    color: '#8e44ad',
    icon: '⚖️',
    subject: '政治',
    desc: '道德法治',
    lordSkill: skillOf('xunjie'),
  },
};

export const SUBJECT_ICON: Record<string, string> = {
  语文: '📖',
  数学: '🔢',
  英语: '🔤',
  物理: '⚛️',
  化学: '⚗️',
  生物: '🧬',
  历史: '🏛️',
  地理: '🌍',
  政治: '⚖️',
};
