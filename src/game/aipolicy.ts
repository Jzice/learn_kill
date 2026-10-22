/* ==================== AI 策略参数表（博弈论启发式的可校准权重） ====================
 * 设计目的：把散落在 aibrain.ts / ai.ts 里的「魔法数字」外置为一张可读写、可序列化的
 * 权重向量 θ，从而：
 *   1. A/B 对比：`useEv = false` 时完全走原启发式路径（基线），`true` 时走 EV 路径；
 *   2. 参数校准：scripts/tune-ai.mjs 用 CEM（交叉熵方法）在自对弈中搜索更优的 θ。
 *
 * 约束（与 AGENTS.md 不变量一致）：
 *   - 模块级只有常量与一个可变对象，无顶层副作用（模块循环安全）；
 *   - 不写入 G，不随 state_sync 下发（AI 的「心思」不泄露给客户端）。
 */

export interface AiPolicy {
  /** 总开关：false = 完全走原启发式（A/B 基线），true = 走 EV / 博弈论增强路径 */
  useEv: boolean;

  /* --- 局面效用 U(s, i) 的战力构成 --- */
  /** 自身战力权重（最高优先级：活下去） */
  wSelf: number;
  /** 每张手牌折算战力 */
  wHand: number;
  /** 每件装备折算战力 */
  wEquip: number;
  /** 可用主动技折算战力（技能潜力） */
  wSkill: number;
  /** 内奸「阵营失衡」惩罚系数（平衡者目标函数） */
  spyBeta: number;
  /** 记仇加成（互惠性） */
  grudgeW: number;
  /** 感恩减成 */
  favorW: number;

  /* --- 目标选择 --- */
  /** 友方惩罚系数：net = enemyProb − allyPenalty·allyProb（越小越保守） */
  allyPenalty: number;
  /** 威胁度权重（多人博弈的集火依据：威胁/击杀难度） */
  threatW: number;
  /** 击杀难度分母基数：cost = hp + killDenom */
  killDenom: number;
  /** 残血加成系数（原 (4-hp)*0.12） */
  lowHpW: number;
  /** 内奸判「势大」的战力差阈值（原 0.4 人数差） */
  campGap: number;

  /* --- 机会节点 EV --- */
  /** 闪概率平滑项（避免 0 / 1 极端） */
  dodgePrior: number;
  /** 出杀暴露代价（被闪后手牌信息泄露 + 资源消耗的等效扣分） */
  exposureW: number;
  /** 决斗 EV 门槛（低于此值不打决斗） */
  duelMin: number;
  /** 火攻 EV 门槛 */
  huogongMin: number;
  /** AOE（南蛮/万箭）EV 门槛：>0 即允许「有队友但净收益为正」时开 */
  aoeMin: number;
  /** 铁索连环 EV 门槛 */
  tiesuoMin: number;
  /** 留闪边际价值系数：闪的防守价值 = shanMarginal × 预计被攻击概率 */
  shanMarginal: number;
  /** 八卦阵判定闪的估计成功率 */
  baguaRate: number;

  /* --- 混合策略（softmax over EV，防剥削） --- */
  /** softmax 初始温度（前期大 → 探索 / 隐藏意图） */
  tau0: number;
  /** 温度按轮次衰减系数 */
  tauDecay: number;

  /* --- 弃牌价值（弃牌阶段保序） --- */
  keepShan: number;
  keepTao: number;
  keepSha: number;
  keepTrick: number;
  keepEquip: number;
}

/** 默认策略：数值与原启发式保持同量级，保证 A/B 两条路径可比 */
export const DEFAULT_POLICY: AiPolicy = {
  // 默认关闭 EV 增强：发布即「原启发式」行为，零回归。
  // 先验修正后请用 `npm run ai:eval "学堂杀.html" 300 5` 验证 EV 臂 J 是否超过基线，
  // 若转为更优，把这里改成 true（一行）即可全量启用博弈论增强层。
  useEv: false,

  wSelf: 2.2,
  wHand: 0.6,
  wEquip: 0.8,
  wSkill: 0.5,
  spyBeta: 0.9,
  grudgeW: 0.8,
  favorW: 0.6,

  allyPenalty: 1.2,
  threatW: 1.0,
  killDenom: 0.8,
  lowHpW: 0.12,
  campGap: 0.4,

  dodgePrior: 0.02,
  exposureW: 0.15,
  duelMin: 0.25,
  huogongMin: 0.15,
  aoeMin: 0.1,
  tiesuoMin: 0.1,
  shanMarginal: 0.5,
  baguaRate: 0.5,

  tau0: 0.35,
  tauDecay: 0.85,

  keepShan: 1.0,
  keepTao: 0.9,
  keepSha: 0.8,
  keepTrick: 0.55,
  keepEquip: 0.25,
};

/** 当前生效策略（可变对象，字段 mutate；不进 G、不随 state_sync 下发） */
export const AIPOLICY: AiPolicy = { ...DEFAULT_POLICY };

/** 局部覆盖策略；返回合并后的完整策略（供自对弈 A/B 与 CEM 校准使用） */
export function setPolicy(patch: Partial<AiPolicy> | null | undefined): AiPolicy {
  if (patch) Object.assign(AIPOLICY, patch);
  return AIPOLICY;
}

/** 读取当前策略快照（拷贝，避免外部误改） */
export function getPolicy(): AiPolicy {
  return { ...AIPOLICY };
}

/** 恢复默认策略 */
export function resetPolicy(): AiPolicy {
  Object.assign(AIPOLICY, DEFAULT_POLICY);
  return AIPOLICY;
}

/** 便捷判定：EV 增强是否生效 */
export function evOn(): boolean {
  return AIPOLICY.useEv !== false;
}
