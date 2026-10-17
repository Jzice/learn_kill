/* ==================== 九科阵营 ==================== */
import type { Faction, FactionId } from '../core/types';

export const FACTIONS: Record<FactionId, Faction> = {
  chinese: {
    name: '语文',
    color: '#e74c3c',
    icon: '📖',
    subject: '语文',
    desc: '文学素养',
    lordSkill: { id: 'shishu', name: '诗书', type: 'active', desc: '主公技：摸一张牌' },
  },
  math: {
    name: '数学',
    color: '#3498db',
    icon: '🔢',
    subject: '数学',
    desc: '数理推演',
    lordSkill: {
      id: 'tuiyan',
      name: '推演',
      type: 'active',
      desc: '主公技：令一名角色判定，黑色受1伤，红色摸1牌',
    },
  },
  english: {
    name: '英语',
    color: '#27ae60',
    icon: '🔤',
    subject: '英语',
    desc: '语言交流',
    lordSkill: { id: 'yishu', name: '译述', type: 'active', desc: '主公技：获得一名角色一张手牌' },
  },
  physics: {
    name: '物理',
    color: '#f39c12',
    icon: '⚛️',
    subject: '物理',
    desc: '力学探索',
    lordSkill: { id: 'yinli', name: '引力', type: 'active', desc: '主公技：对一名角色造成1点伤害' },
  },
  chemistry: {
    name: '化学',
    color: '#9b59b6',
    icon: '⚗️',
    subject: '化学',
    desc: '元素反应',
    lordSkill: { id: 'cuihua', name: '催化', type: 'active', desc: '主公技：令一名角色回复1点体力' },
  },
  biology: {
    name: '生物',
    color: '#16a085',
    icon: '🧬',
    subject: '生物',
    desc: '生命奥秘',
    lordSkill: { id: 'jinhua', name: '进化', type: 'active', desc: '主公技：摸两张牌然后弃一张牌' },
  },
  history: {
    name: '历史',
    color: '#d35400',
    icon: '🏛️',
    subject: '历史',
    desc: '古今明鉴',
    lordSkill: { id: 'mingjian', name: '明鉴', type: 'active', desc: '主公技：令一名角色弃一张牌' },
  },
  geography: {
    name: '地理',
    color: '#2980b9',
    icon: '🌍',
    subject: '地理',
    desc: '山河万象',
    lordSkill: { id: 'tansuo', name: '探索', type: 'active', desc: '主公技：所有角色各摸一张牌' },
  },
  politics: {
    name: '政治',
    color: '#8e44ad',
    icon: '⚖️',
    subject: '政治',
    desc: '道德法治',
    lordSkill: {
      id: 'xunjie',
      name: '训诫',
      type: 'active',
      desc: '主公技：令一名角色选择弃一张牌或交给你一张牌',
    },
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
