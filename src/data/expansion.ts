// 本文件由 scripts/build-expansion.mjs 生成，请勿手改。
// 单一事实来源：scripts/build-expansion.mjs 的 SEED（12 学期 × 9 学科 = 108 名角色）。
import type { Character, EquipSlot, ItemDef, Skill, SkillEffect } from '../core/types';

export interface EquipDef {
  id: string;
  name: string;
  slot: EquipSlot;
  tier: 1 | 2 | 3;
  icon: string;
  desc: string;
  /** 装备效果（在 setup 时折算为玩家加成） */
  fx: { range?: number; dmg?: number; reduce?: number; shield?: number; distPlus?: number; distMinus?: number };
}

export const EXPANSION_CHARS: Character[] = [
  {
    "id": "ex_0_cn",
    "name": "默写·春",
    "title": "初一上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 4,
    "avatar": "📜",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_cn_sk",
        "name": "默写·春",
        "type": "active",
        "desc": "弃 1 张手牌，摸 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_ma",
    "name": "有理数",
    "title": "初一上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 4,
    "avatar": "🔢",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_ma_sk",
        "name": "有理数",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_en",
    "name": "Letters&Sounds",
    "title": "初一上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 4,
    "avatar": "🔤",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_en_sk",
        "name": "Letters&Sounds",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_ph",
    "name": "声现象",
    "title": "初一上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 4,
    "avatar": "⚛️",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_ph_sk",
        "name": "声现象",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_ch",
    "name": "物质变化",
    "title": "初一上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 4,
    "avatar": "⚗️",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_ch_sk",
        "name": "物质变化",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_bi",
    "name": "细胞",
    "title": "初一上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 4,
    "avatar": "🧬",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_bi_sk",
        "name": "细胞",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_hi",
    "name": "史前·元谋",
    "title": "初一上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 4,
    "avatar": "📜",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_hi_sk",
        "name": "史前·元谋",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_ge",
    "name": "地球地图",
    "title": "初一上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 4,
    "avatar": "🌏",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_ge_sk",
        "name": "地球地图",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_0_po",
    "name": "中学时代",
    "title": "初一上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 4,
    "avatar": "⚖️",
    "grade": "初一上",
    "skills": [
      {
        "id": "ex_0_po_sk",
        "name": "中学时代",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_cn",
    "name": "标点·陋室铭",
    "title": "初一下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_cn_sk",
        "name": "标点·陋室铭",
        "type": "active",
        "desc": "弃 1 张手牌，摸 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_ma",
    "name": "实数",
    "title": "初一下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_ma_sk",
        "name": "实数",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_en",
    "name": "DailyTalk",
    "title": "初一下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_en_sk",
        "name": "DailyTalk",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_ph",
    "name": "光现象",
    "title": "初一下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_ph_sk",
        "name": "光现象",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_ch",
    "name": "空气氧气",
    "title": "初一下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_ch_sk",
        "name": "空气氧气",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_bi",
    "name": "植物",
    "title": "初一下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_bi_sk",
        "name": "植物",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_hi",
    "name": "隋唐",
    "title": "初一下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_hi_sk",
        "name": "隋唐",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_ge",
    "name": "气候",
    "title": "初一下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_ge_sk",
        "name": "气候",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_1_po",
    "name": "青春",
    "title": "初一下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "初一下",
    "skills": [
      {
        "id": "ex_1_po_sk",
        "name": "青春",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_cn",
    "name": "文言·三峡",
    "title": "初二上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_cn_sk",
        "name": "文言·三峡",
        "type": "active",
        "desc": "弃 1 张手牌，摸 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_ma",
    "name": "全等三角形",
    "title": "初二上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_ma_sk",
        "name": "全等三角形",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_en",
    "name": "SchoolLife",
    "title": "初二上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_en_sk",
        "name": "SchoolLife",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_ph",
    "name": "运动学",
    "title": "初二上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_ph_sk",
        "name": "运动学",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_ch",
    "name": "水与溶液",
    "title": "初二上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_ch_sk",
        "name": "水与溶液",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_bi",
    "name": "人体营养",
    "title": "初二上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_bi_sk",
        "name": "人体营养",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_hi",
    "name": "近代抗争",
    "title": "初二上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_hi_sk",
        "name": "近代抗争",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_ge",
    "name": "中国地形",
    "title": "初二上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_ge_sk",
        "name": "中国地形",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_2_po",
    "name": "法律",
    "title": "初二上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "初二上",
    "skills": [
      {
        "id": "ex_2_po_sk",
        "name": "法律",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_cn",
    "name": "诗词·茅屋",
    "title": "初二下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 4,
    "avatar": "📜",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_cn_sk",
        "name": "诗词·茅屋",
        "type": "active",
        "desc": "弃 1 张手牌，摸 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_ma",
    "name": "一次函数",
    "title": "初二下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 4,
    "avatar": "🔢",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_ma_sk",
        "name": "一次函数",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_en",
    "name": "Stories",
    "title": "初二下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 4,
    "avatar": "🔤",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_en_sk",
        "name": "Stories",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_ph",
    "name": "力与压强",
    "title": "初二下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 4,
    "avatar": "⚛️",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_ph_sk",
        "name": "力与压强",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_ch",
    "name": "碳与燃料",
    "title": "初二下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 4,
    "avatar": "⚗️",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_ch_sk",
        "name": "碳与燃料",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_bi",
    "name": "神经调节",
    "title": "初二下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 4,
    "avatar": "🧬",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_bi_sk",
        "name": "神经调节",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_hi",
    "name": "民主共和",
    "title": "初二下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 4,
    "avatar": "📜",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_hi_sk",
        "name": "民主共和",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_ge",
    "name": "河流",
    "title": "初二下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 4,
    "avatar": "🌏",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_ge_sk",
        "name": "河流",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_3_po",
    "name": "公民",
    "title": "初二下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 4,
    "avatar": "⚖️",
    "grade": "初二下",
    "skills": [
      {
        "id": "ex_3_po_sk",
        "name": "公民",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_cn",
    "name": "议论·敬业",
    "title": "初三上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_cn_sk",
        "name": "议论·敬业",
        "type": "active",
        "desc": "弃 1 张手牌，摸 2 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_ma",
    "name": "二次函数",
    "title": "初三上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_ma_sk",
        "name": "二次函数",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_en",
    "name": "Grammar",
    "title": "初三上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_en_sk",
        "name": "Grammar",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_ph",
    "name": "电学",
    "title": "初三上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_ph_sk",
        "name": "电学",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_ch",
    "name": "酸碱盐",
    "title": "初三上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_ch_sk",
        "name": "酸碱盐",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_bi",
    "name": "遗传",
    "title": "初三上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_bi_sk",
        "name": "遗传",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_hi",
    "name": "工业革命",
    "title": "初三上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_hi_sk",
        "name": "工业革命",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_ge",
    "name": "世界分区",
    "title": "初三上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_ge_sk",
        "name": "世界分区",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_4_po",
    "name": "国情",
    "title": "初三上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "初三上",
    "skills": [
      {
        "id": "ex_4_po_sk",
        "name": "国情",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_cn",
    "name": "戏剧·威尼斯",
    "title": "初三下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_cn_sk",
        "name": "戏剧·威尼斯",
        "type": "active",
        "desc": "弃 1 张手牌，摸 2 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_ma",
    "name": "圆",
    "title": "初三下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_ma_sk",
        "name": "圆",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetLoseHp",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_en",
    "name": "Writing",
    "title": "初三下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_en_sk",
        "name": "Writing",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_ph",
    "name": "电磁",
    "title": "初三下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_ph_sk",
        "name": "电磁",
        "type": "active",
        "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetDamage",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_ch",
    "name": "金属",
    "title": "初三下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_ch_sk",
        "name": "金属",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_bi",
    "name": "生态",
    "title": "初三下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_bi_sk",
        "name": "生态",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_hi",
    "name": "二战",
    "title": "初三下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_hi_sk",
        "name": "二战",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_ge",
    "name": "经济发展",
    "title": "初三下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_ge_sk",
        "name": "经济发展",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_5_po",
    "name": "世界舞台",
    "title": "初三下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "初三下",
    "skills": [
      {
        "id": "ex_5_po_sk",
        "name": "世界舞台",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_cn",
    "name": "现代文·故都",
    "title": "高一上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 4,
    "avatar": "📜",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_cn_sk",
        "name": "现代文·故都",
        "type": "active",
        "desc": "弃 1 张手牌，摸 2 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_ma",
    "name": "集合",
    "title": "高一上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 4,
    "avatar": "🔢",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_ma_sk",
        "name": "集合",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_en",
    "name": "Reading",
    "title": "高一上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 4,
    "avatar": "🔤",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_en_sk",
        "name": "Reading",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_ph",
    "name": "运动定律",
    "title": "高一上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 4,
    "avatar": "⚛️",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_ph_sk",
        "name": "运动定律",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_ch",
    "name": "物质的量",
    "title": "高一上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 4,
    "avatar": "⚗️",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_ch_sk",
        "name": "物质的量",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_bi",
    "name": "分子与细胞",
    "title": "高一上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 4,
    "avatar": "🧬",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_bi_sk",
        "name": "分子与细胞",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_hi",
    "name": "古代中国",
    "title": "高一上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 4,
    "avatar": "📜",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_hi_sk",
        "name": "古代中国",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_ge",
    "name": "宇宙地球",
    "title": "高一上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 4,
    "avatar": "🌏",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_ge_sk",
        "name": "宇宙地球",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_6_po",
    "name": "经济生活",
    "title": "高一上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 4,
    "avatar": "⚖️",
    "grade": "高一上",
    "skills": [
      {
        "id": "ex_6_po_sk",
        "name": "经济生活",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_cn",
    "name": "诗歌·氓",
    "title": "高一下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_cn_sk",
        "name": "诗歌·氓",
        "type": "active",
        "desc": "弃 1 张手牌，摸 2 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_ma",
    "name": "三角函数",
    "title": "高一下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_ma_sk",
        "name": "三角函数",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_en",
    "name": "Culture",
    "title": "高一下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_en_sk",
        "name": "Culture",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_ph",
    "name": "曲线运动",
    "title": "高一下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_ph_sk",
        "name": "曲线运动",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_ch",
    "name": "元素周期",
    "title": "高一下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_ch_sk",
        "name": "元素周期",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_bi",
    "name": "代谢",
    "title": "高一下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_bi_sk",
        "name": "代谢",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_hi",
    "name": "世界近代",
    "title": "高一下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_hi_sk",
        "name": "世界近代",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_ge",
    "name": "人文地理",
    "title": "高一下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_ge_sk",
        "name": "人文地理",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_7_po",
    "name": "政治生活",
    "title": "高一下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "高一下",
    "skills": [
      {
        "id": "ex_7_po_sk",
        "name": "政治生活",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_cn",
    "name": "小说·祝福",
    "title": "高二上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_cn_sk",
        "name": "小说·祝福",
        "type": "active",
        "desc": "弃 1 张手牌，摸 3 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 3
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_ma",
    "name": "立体几何",
    "title": "高二上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_ma_sk",
        "name": "立体几何",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_en",
    "name": "Argument",
    "title": "高二上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_en_sk",
        "name": "Argument",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_ph",
    "name": "电场",
    "title": "高二上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_ph_sk",
        "name": "电场",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_ch",
    "name": "反应速率",
    "title": "高二上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_ch_sk",
        "name": "反应速率",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_bi",
    "name": "稳态",
    "title": "高二上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_bi_sk",
        "name": "稳态",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_hi",
    "name": "中国近现代",
    "title": "高二上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_hi_sk",
        "name": "中国近现代",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_ge",
    "name": "区域生态",
    "title": "高二上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_ge_sk",
        "name": "区域生态",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_8_po",
    "name": "哲学",
    "title": "高二上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "高二上",
    "skills": [
      {
        "id": "ex_8_po_sk",
        "name": "哲学",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_cn",
    "name": "散文·荷塘",
    "title": "高二下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 4,
    "avatar": "📜",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_cn_sk",
        "name": "散文·荷塘",
        "type": "active",
        "desc": "弃 1 张手牌，摸 3 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 3
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_ma",
    "name": "导数",
    "title": "高二下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 4,
    "avatar": "🔢",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_ma_sk",
        "name": "导数",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_en",
    "name": "Translation",
    "title": "高二下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 4,
    "avatar": "🔤",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_en_sk",
        "name": "Translation",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_ph",
    "name": "电磁感应",
    "title": "高二下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 4,
    "avatar": "⚛️",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_ph_sk",
        "name": "电磁感应",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_ch",
    "name": "有机基础",
    "title": "高二下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 4,
    "avatar": "⚗️",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_ch_sk",
        "name": "有机基础",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_bi",
    "name": "生物工程",
    "title": "高二下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 4,
    "avatar": "🧬",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_bi_sk",
        "name": "生物工程",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_hi",
    "name": "世界现代",
    "title": "高二下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 4,
    "avatar": "📜",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_hi_sk",
        "name": "世界现代",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_ge",
    "name": "国土整治",
    "title": "高二下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 4,
    "avatar": "🌏",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_ge_sk",
        "name": "国土整治",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_9_po",
    "name": "文化",
    "title": "高二下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 4,
    "avatar": "⚖️",
    "grade": "高二下",
    "skills": [
      {
        "id": "ex_9_po_sk",
        "name": "文化",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_cn",
    "name": "古文·劝学",
    "title": "高三上·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_cn_sk",
        "name": "古文·劝学",
        "type": "active",
        "desc": "弃 1 张手牌，摸 3 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 3
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_ma",
    "name": "数列",
    "title": "高三上·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_ma_sk",
        "name": "数列",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_en",
    "name": "Cloze",
    "title": "高三上·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_en_sk",
        "name": "Cloze",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_ph",
    "name": "动量",
    "title": "高三上·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_ph_sk",
        "name": "动量",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_ch",
    "name": "电化学",
    "title": "高三上·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_ch_sk",
        "name": "电化学",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_bi",
    "name": "进化",
    "title": "高三上·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_bi_sk",
        "name": "进化",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_hi",
    "name": "改革",
    "title": "高三上·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_hi_sk",
        "name": "改革",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_ge",
    "name": "自然地理",
    "title": "高三上·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_ge_sk",
        "name": "自然地理",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_10_po",
    "name": "辩证法",
    "title": "高三上·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "高三上",
    "skills": [
      {
        "id": "ex_10_po_sk",
        "name": "辩证法",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_cn",
    "name": "论述·拿来",
    "title": "高三下·语文学子",
    "faction": "chinese",
    "subject": "语文",
    "hp": 3,
    "avatar": "📜",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_cn_sk",
        "name": "论述·拿来",
        "type": "active",
        "desc": "弃 1 张手牌，摸 3 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "selfDraw",
            "n": 3
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_ma",
    "name": "概率统计",
    "title": "高三下·数学学子",
    "faction": "math",
    "subject": "数学",
    "hp": 3,
    "avatar": "🔢",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_ma_sk",
        "name": "概率统计",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_en",
    "name": "Summary",
    "title": "高三下·英语学子",
    "faction": "english",
    "subject": "英语",
    "hp": 3,
    "avatar": "🔤",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_en_sk",
        "name": "Summary",
        "type": "active",
        "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "gainHand",
            "n": 2
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_ph",
    "name": "波与光",
    "title": "高三下·物理学子",
    "faction": "physics",
    "subject": "物理",
    "hp": 3,
    "avatar": "⚛️",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_ph_sk",
        "name": "波与光",
        "type": "trigger",
        "desc": "出杀/伤害 +1（触发）",
        "effects": [
          {
            "kind": "damageMod",
            "delta": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_ch",
    "name": "物质结构",
    "title": "高三下·化学学子",
    "faction": "chemistry",
    "subject": "化学",
    "hp": 3,
    "avatar": "⚗️",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_ch_sk",
        "name": "物质结构",
        "type": "trigger",
        "desc": "手牌上限 +1（触发）",
        "effects": [
          {
            "kind": "handLimit",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_bi",
    "name": "生态工程",
    "title": "高三下·生物学子",
    "faction": "biology",
    "subject": "生物",
    "hp": 3,
    "avatar": "🧬",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_bi_sk",
        "name": "生态工程",
        "type": "trigger",
        "desc": "摸牌阶段额外摸 1 张牌（触发）",
        "effects": [
          {
            "kind": "extraDraw",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_hi",
    "name": "全球化",
    "title": "高三下·历史学子",
    "faction": "history",
    "subject": "历史",
    "hp": 3,
    "avatar": "📜",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_hi_sk",
        "name": "全球化",
        "type": "active",
        "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "allDiscard",
            "n": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_ge",
    "name": "区域发展",
    "title": "高三下·地理学子",
    "faction": "geography",
    "subject": "地理",
    "hp": 3,
    "avatar": "🌏",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_ge_sk",
        "name": "区域发展",
        "type": "trigger",
        "desc": "计算距离 − 1（触发）",
        "effects": [
          {
            "kind": "distMod",
            "delta": -1
          }
        ]
      }
    ]
  },
  {
    "id": "ex_11_po",
    "name": "人生价值",
    "title": "高三下·政治学子",
    "faction": "politics",
    "subject": "政治",
    "hp": 3,
    "avatar": "⚖️",
    "grade": "高三下",
    "skills": [
      {
        "id": "ex_11_po_sk",
        "name": "人生价值",
        "type": "active",
        "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
        "effects": [
          {
            "kind": "costCard",
            "n": 1
          },
          {
            "kind": "targetHeal",
            "n": 1
          }
        ]
      }
    ]
  }
];

export const EXPANSION_SKILLS: Skill[] = [
  {
    "id": "ex_0_cn_sk",
    "name": "默写·春",
    "type": "active",
    "desc": "弃 1 张手牌，摸 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_ma_sk",
    "name": "有理数",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_en_sk",
    "name": "Letters&Sounds",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_ph_sk",
    "name": "声现象",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_ch_sk",
    "name": "物质变化",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_bi_sk",
    "name": "细胞",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_hi_sk",
    "name": "史前·元谋",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_0_ge_sk",
    "name": "地球地图",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_0_po_sk",
    "name": "中学时代",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_cn_sk",
    "name": "标点·陋室铭",
    "type": "active",
    "desc": "弃 1 张手牌，摸 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_ma_sk",
    "name": "实数",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_en_sk",
    "name": "DailyTalk",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_ph_sk",
    "name": "光现象",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_ch_sk",
    "name": "空气氧气",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_bi_sk",
    "name": "植物",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_hi_sk",
    "name": "隋唐",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_1_ge_sk",
    "name": "气候",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_1_po_sk",
    "name": "青春",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_cn_sk",
    "name": "文言·三峡",
    "type": "active",
    "desc": "弃 1 张手牌，摸 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_ma_sk",
    "name": "全等三角形",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_en_sk",
    "name": "SchoolLife",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_ph_sk",
    "name": "运动学",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_ch_sk",
    "name": "水与溶液",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_bi_sk",
    "name": "人体营养",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_hi_sk",
    "name": "近代抗争",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_2_ge_sk",
    "name": "中国地形",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_2_po_sk",
    "name": "法律",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_cn_sk",
    "name": "诗词·茅屋",
    "type": "active",
    "desc": "弃 1 张手牌，摸 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_ma_sk",
    "name": "一次函数",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_en_sk",
    "name": "Stories",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 1 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_ph_sk",
    "name": "力与压强",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_ch_sk",
    "name": "碳与燃料",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_bi_sk",
    "name": "神经调节",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_hi_sk",
    "name": "民主共和",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_3_ge_sk",
    "name": "河流",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_3_po_sk",
    "name": "公民",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_cn_sk",
    "name": "议论·敬业",
    "type": "active",
    "desc": "弃 1 张手牌，摸 2 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_4_ma_sk",
    "name": "二次函数",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_en_sk",
    "name": "Grammar",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_4_ph_sk",
    "name": "电学",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_ch_sk",
    "name": "酸碱盐",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_bi_sk",
    "name": "遗传",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_hi_sk",
    "name": "工业革命",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_4_ge_sk",
    "name": "世界分区",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_4_po_sk",
    "name": "国情",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_cn_sk",
    "name": "戏剧·威尼斯",
    "type": "active",
    "desc": "弃 1 张手牌，摸 2 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_5_ma_sk",
    "name": "圆",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色失去 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetLoseHp",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_en_sk",
    "name": "Writing",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_5_ph_sk",
    "name": "电磁",
    "type": "active",
    "desc": "弃 1 张手牌，对一名角色造成 1 点伤害",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetDamage",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_ch_sk",
    "name": "金属",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_bi_sk",
    "name": "生态",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_hi_sk",
    "name": "二战",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_5_ge_sk",
    "name": "经济发展",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_5_po_sk",
    "name": "世界舞台",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_6_cn_sk",
    "name": "现代文·故都",
    "type": "active",
    "desc": "弃 1 张手牌，摸 2 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_6_ma_sk",
    "name": "集合",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_6_en_sk",
    "name": "Reading",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_6_ph_sk",
    "name": "运动定律",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_6_ch_sk",
    "name": "物质的量",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_6_bi_sk",
    "name": "分子与细胞",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_6_hi_sk",
    "name": "古代中国",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_6_ge_sk",
    "name": "宇宙地球",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_6_po_sk",
    "name": "经济生活",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_7_cn_sk",
    "name": "诗歌·氓",
    "type": "active",
    "desc": "弃 1 张手牌，摸 2 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_7_ma_sk",
    "name": "三角函数",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_7_en_sk",
    "name": "Culture",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_7_ph_sk",
    "name": "曲线运动",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_7_ch_sk",
    "name": "元素周期",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_7_bi_sk",
    "name": "代谢",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_7_hi_sk",
    "name": "世界近代",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_7_ge_sk",
    "name": "人文地理",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_7_po_sk",
    "name": "政治生活",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_8_cn_sk",
    "name": "小说·祝福",
    "type": "active",
    "desc": "弃 1 张手牌，摸 3 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 3
      }
    ]
  },
  {
    "id": "ex_8_ma_sk",
    "name": "立体几何",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_8_en_sk",
    "name": "Argument",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_8_ph_sk",
    "name": "电场",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_8_ch_sk",
    "name": "反应速率",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_8_bi_sk",
    "name": "稳态",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_8_hi_sk",
    "name": "中国近现代",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_8_ge_sk",
    "name": "区域生态",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_8_po_sk",
    "name": "哲学",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_9_cn_sk",
    "name": "散文·荷塘",
    "type": "active",
    "desc": "弃 1 张手牌，摸 3 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 3
      }
    ]
  },
  {
    "id": "ex_9_ma_sk",
    "name": "导数",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_9_en_sk",
    "name": "Translation",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_9_ph_sk",
    "name": "电磁感应",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_9_ch_sk",
    "name": "有机基础",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_9_bi_sk",
    "name": "生物工程",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_9_hi_sk",
    "name": "世界现代",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_9_ge_sk",
    "name": "国土整治",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_9_po_sk",
    "name": "文化",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_10_cn_sk",
    "name": "古文·劝学",
    "type": "active",
    "desc": "弃 1 张手牌，摸 3 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 3
      }
    ]
  },
  {
    "id": "ex_10_ma_sk",
    "name": "数列",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_10_en_sk",
    "name": "Cloze",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_10_ph_sk",
    "name": "动量",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_10_ch_sk",
    "name": "电化学",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_10_bi_sk",
    "name": "进化",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_10_hi_sk",
    "name": "改革",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_10_ge_sk",
    "name": "自然地理",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_10_po_sk",
    "name": "辩证法",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_11_cn_sk",
    "name": "论述·拿来",
    "type": "active",
    "desc": "弃 1 张手牌，摸 3 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "selfDraw",
        "n": 3
      }
    ]
  },
  {
    "id": "ex_11_ma_sk",
    "name": "概率统计",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_11_en_sk",
    "name": "Summary",
    "type": "active",
    "desc": "弃 1 张手牌，获得一名角色 2 张手牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "gainHand",
        "n": 2
      }
    ]
  },
  {
    "id": "ex_11_ph_sk",
    "name": "波与光",
    "type": "trigger",
    "desc": "出杀/伤害 +1（触发）",
    "effects": [
      {
        "kind": "damageMod",
        "delta": 1
      }
    ]
  },
  {
    "id": "ex_11_ch_sk",
    "name": "物质结构",
    "type": "trigger",
    "desc": "手牌上限 +1（触发）",
    "effects": [
      {
        "kind": "handLimit",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_11_bi_sk",
    "name": "生态工程",
    "type": "trigger",
    "desc": "摸牌阶段额外摸 1 张牌（触发）",
    "effects": [
      {
        "kind": "extraDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_11_hi_sk",
    "name": "全球化",
    "type": "active",
    "desc": "弃 1 张手牌，令所有其他角色各弃 1 张牌",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "allDiscard",
        "n": 1
      }
    ]
  },
  {
    "id": "ex_11_ge_sk",
    "name": "区域发展",
    "type": "trigger",
    "desc": "计算距离 − 1（触发）",
    "effects": [
      {
        "kind": "distMod",
        "delta": -1
      }
    ]
  },
  {
    "id": "ex_11_po_sk",
    "name": "人生价值",
    "type": "active",
    "desc": "弃 1 张手牌，令一名角色回复 1 点体力",
    "effects": [
      {
        "kind": "costCard",
        "n": 1
      },
      {
        "kind": "targetHeal",
        "n": 1
      }
    ]
  }
];

export const EXPANSION_EQUIPS: EquipDef[] = [
  {
    "id": "eq_wpn_1",
    "name": "木剑",
    "slot": "weapon",
    "tier": 1,
    "icon": "🗡️",
    "desc": "攻击距离 +1",
    "fx": {
      "range": 1
    }
  },
  {
    "id": "eq_wpn_2",
    "name": "精钢剑",
    "slot": "weapon",
    "tier": 2,
    "icon": "⚔️",
    "desc": "攻击距离 +1，出杀伤害 +1",
    "fx": {
      "range": 1,
      "dmg": 1
    }
  },
  {
    "id": "eq_wpn_3",
    "name": "倚天剑",
    "slot": "weapon",
    "tier": 3,
    "icon": "🗡",
    "desc": "攻击距离 +2，出杀伤害 +1",
    "fx": {
      "range": 2,
      "dmg": 1
    }
  },
  {
    "id": "eq_arm_1",
    "name": "布甲",
    "slot": "armor",
    "tier": 1,
    "icon": "🥋",
    "desc": "受到的伤害 -1（每回合限一次）",
    "fx": {
      "reduce": 1
    }
  },
  {
    "id": "eq_arm_2",
    "name": "锁子甲",
    "slot": "armor",
    "tier": 2,
    "icon": "🛡",
    "desc": "受到的伤害 -1，开局护盾 +1",
    "fx": {
      "reduce": 1,
      "shield": 1
    }
  },
  {
    "id": "eq_arm_3",
    "name": "金丝甲",
    "slot": "armor",
    "tier": 3,
    "icon": "🛡️",
    "desc": "受到的伤害 -1，开局护盾 +2",
    "fx": {
      "reduce": 1,
      "shield": 2
    }
  },
  {
    "id": "eq_hp_1",
    "name": "黄骠马",
    "slot": "horsePlus",
    "tier": 1,
    "icon": "🐎",
    "desc": "其他角色计算与你的距离 +1",
    "fx": {
      "distPlus": 1
    }
  },
  {
    "id": "eq_hp_2",
    "name": "赤兔马",
    "slot": "horsePlus",
    "tier": 2,
    "icon": "🐴",
    "desc": "其他角色计算与你的距离 +1",
    "fx": {
      "distPlus": 1
    }
  },
  {
    "id": "eq_hp_3",
    "name": "的卢",
    "slot": "horsePlus",
    "tier": 3,
    "icon": "🐎",
    "desc": "其他角色计算与你的距离 +1，你计算距离 -1",
    "fx": {
      "distPlus": 1,
      "distMinus": 1
    }
  },
  {
    "id": "eq_hm_1",
    "name": "青骢马",
    "slot": "horseMinus",
    "tier": 1,
    "icon": "🐎",
    "desc": "你计算与其他角色的距离 -1",
    "fx": {
      "distMinus": 1
    }
  },
  {
    "id": "eq_hm_2",
    "name": "照夜玉狮子",
    "slot": "horseMinus",
    "tier": 2,
    "icon": "🐴",
    "desc": "你计算与其他角色的距离 -1",
    "fx": {
      "distMinus": 1
    }
  },
  {
    "id": "eq_hm_3",
    "name": "绝影",
    "slot": "horseMinus",
    "tier": 3,
    "icon": "🐎",
    "desc": "你计算与其他角色的距离 -1，开局护盾 +1",
    "fx": {
      "distMinus": 1,
      "shield": 1
    }
  }
];

export const EXPANSION_ITEMS: ItemDef[] = [
  {
    "id": "it_reset",
    "name": "温故符",
    "icon": "🔄",
    "desc": "立即温故知新，摸 1 张牌",
    "maxCarry": 3,
    "effects": [
      {
        "kind": "selfDraw",
        "n": 1
      }
    ]
  },
  {
    "id": "it_shield",
    "name": "护身符",
    "icon": "🛡",
    "desc": "获得 1 点护盾（抵挡一次伤害）",
    "maxCarry": 3,
    "effects": [
      {
        "kind": "shield",
        "n": 1
      }
    ]
  },
  {
    "id": "it_draw",
    "name": "灵感符",
    "icon": "✨",
    "desc": "立即摸两张牌",
    "maxCarry": 3,
    "effects": [
      {
        "kind": "selfDraw",
        "n": 2
      }
    ]
  },
  {
    "id": "it_peek",
    "name": "锦囊符",
    "icon": "📜",
    "desc": "令一名角色弃一张手牌",
    "maxCarry": 2,
    "effects": [
      {
        "kind": "targetDiscard",
        "n": 1
      }
    ]
  }
];

/** 角色学分定价（按学期递增分档） */
export const CHAR_PRICE: Record<string, number> = {
  'ex_0_cn': 120,
  'ex_0_ma': 120,
  'ex_0_en': 120,
  'ex_0_ph': 120,
  'ex_0_ch': 120,
  'ex_0_bi': 120,
  'ex_0_hi': 120,
  'ex_0_ge': 120,
  'ex_0_po': 120,
  'ex_1_cn': 160,
  'ex_1_ma': 160,
  'ex_1_en': 160,
  'ex_1_ph': 160,
  'ex_1_ch': 160,
  'ex_1_bi': 160,
  'ex_1_hi': 160,
  'ex_1_ge': 160,
  'ex_1_po': 160,
  'ex_2_cn': 200,
  'ex_2_ma': 200,
  'ex_2_en': 200,
  'ex_2_ph': 200,
  'ex_2_ch': 200,
  'ex_2_bi': 200,
  'ex_2_hi': 200,
  'ex_2_ge': 200,
  'ex_2_po': 200,
  'ex_3_cn': 240,
  'ex_3_ma': 240,
  'ex_3_en': 240,
  'ex_3_ph': 240,
  'ex_3_ch': 240,
  'ex_3_bi': 240,
  'ex_3_hi': 240,
  'ex_3_ge': 240,
  'ex_3_po': 240,
  'ex_4_cn': 280,
  'ex_4_ma': 280,
  'ex_4_en': 280,
  'ex_4_ph': 280,
  'ex_4_ch': 280,
  'ex_4_bi': 280,
  'ex_4_hi': 280,
  'ex_4_ge': 280,
  'ex_4_po': 280,
  'ex_5_cn': 320,
  'ex_5_ma': 320,
  'ex_5_en': 320,
  'ex_5_ph': 320,
  'ex_5_ch': 320,
  'ex_5_bi': 320,
  'ex_5_hi': 320,
  'ex_5_ge': 320,
  'ex_5_po': 320,
  'ex_6_cn': 360,
  'ex_6_ma': 360,
  'ex_6_en': 360,
  'ex_6_ph': 360,
  'ex_6_ch': 360,
  'ex_6_bi': 360,
  'ex_6_hi': 360,
  'ex_6_ge': 360,
  'ex_6_po': 360,
  'ex_7_cn': 400,
  'ex_7_ma': 400,
  'ex_7_en': 400,
  'ex_7_ph': 400,
  'ex_7_ch': 400,
  'ex_7_bi': 400,
  'ex_7_hi': 400,
  'ex_7_ge': 400,
  'ex_7_po': 400,
  'ex_8_cn': 440,
  'ex_8_ma': 440,
  'ex_8_en': 440,
  'ex_8_ph': 440,
  'ex_8_ch': 440,
  'ex_8_bi': 440,
  'ex_8_hi': 440,
  'ex_8_ge': 440,
  'ex_8_po': 440,
  'ex_9_cn': 480,
  'ex_9_ma': 480,
  'ex_9_en': 480,
  'ex_9_ph': 480,
  'ex_9_ch': 480,
  'ex_9_bi': 480,
  'ex_9_hi': 480,
  'ex_9_ge': 480,
  'ex_9_po': 480,
  'ex_10_cn': 520,
  'ex_10_ma': 520,
  'ex_10_en': 520,
  'ex_10_ph': 520,
  'ex_10_ch': 520,
  'ex_10_bi': 520,
  'ex_10_hi': 520,
  'ex_10_ge': 520,
  'ex_10_po': 520,
  'ex_11_cn': 560,
  'ex_11_ma': 560,
  'ex_11_en': 560,
  'ex_11_ph': 560,
  'ex_11_ch': 560,
  'ex_11_bi': 560,
  'ex_11_hi': 560,
  'ex_11_ge': 560,
  'ex_11_po': 560,
};

/** 装备学分定价（按 tier：普通80 / 精良200 / 稀有400） */
export const EQUIP_PRICE: Record<number, number> = { 1: 80, 2: 200, 3: 400 };

export function expansionCharById(id: string): Character | undefined {
  return EXPANSION_CHARS.find((c) => c.id === id);
}
export function expansionEquipById(id: string): EquipDef | undefined {
  return EXPANSION_EQUIPS.find((e) => e.id === id);
}
export function expansionItemById(id: string): ItemDef | undefined {
  return EXPANSION_ITEMS.find((i) => i.id === id);
}
