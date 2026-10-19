/* ==================== 技能 / 锦囊内容提示 =================== */
/** 锦囊效果说明（键 = 卡牌 sub） */
export const TRICK_DESC: Record<string, string> = {
  wuzhong: '摸 2 张牌',
  guohe: '弃置目标一张手牌或装备',
  shunshou: '获得距离 1 以内目标的一张牌',
  juedou: '与目标轮流出【杀】，没出的人受 1 点伤害',
  nanman: '其他所有玩家需出【杀】，否则受 1 点伤害',
  wanjian: '其他所有玩家需出【闪】，否则受 1 点伤害',
  taoyuan: '所有存活玩家回复 1 点体力',
  wuxie: '抵消一张锦囊对一名玩家的效果',
  lebu: '出牌阶段判定：非红桃则跳过出牌阶段',
  shandian: '留存判定：黑桃 2-9 受 3 点雷属性伤害，否则移交下家',
  jiedao: '令一名有武器的角色攻击你指定的另一名角色，否则交出其武器',
  wugu: '亮出等同存活人数的牌，从使用者开始依次各取一张',
  tiesuo: '横置一名角色（或重置已横置者）；也可重铸：弃此牌摸一张',
  huogong: '目标展示一张手牌，你弃一张同花色手牌，对其造成 1 点火属性伤害',
  qinggang: '无视目标防具',
  cixiong: '对异性角色用杀，对方选择令你摸一张或自弃一张',
  guanshi: '杀被闪后，可弃两张牌令其强制命中',
  fangtian: '最后一张手牌为杀时，可指定至多 3 个目标',
  hanbing: '杀命中时，可弃两张牌改为令其弃两张牌（免除伤害）',
  guding: '目标没有手牌时，杀的伤害 +1',
  tengjia: '普通杀/南蛮/万箭无效，但受到的火焰伤害 +1',
  baiyin: '每次受到的伤害最多 1 点；失去时回复 1 点体力',
};

/** 装备效果说明（键 = 装备 skill） */
export const EQUIP_DESC: Record<string, string> = {
  liannu: '出【杀】次数无限制',
  qinglong: '【杀】被闪后，可对同一目标再出一张杀',
  zhangba: '可将两张手牌当【杀】使用',
  qinggang: '无视目标的防具',
  cixiong: '对异性角色使用【杀】时，对方需令你摸一张牌或弃一张手牌',
  guanshi: '【杀】被闪后，可弃两张牌令其强制命中',
  fangtian: '最后一张手牌为【杀】时，可指定至多 3 个目标',
  hanbing: '【杀】命中时，可弃两张牌改为令目标弃两张牌',
  guding: '目标没有手牌时，【杀】的伤害 +1',
  bagua: '无【闪】时可判定，红色视为闪',
  renwang: '黑色【杀】无效',
  tengjia: '普通【杀】/南蛮/万箭无效；受到的火焰伤害 +1',
  baiyin: '每次受到的伤害最多 1 点；失去此装备时回复 1 点体力',
};

let hintTimer: ReturnType<typeof setTimeout> | undefined;

/** 使用技能 / 锦囊时在出牌区内浮现内容提示，数秒后自动淡出 */
export function showPlayHint(kind: '技能' | '锦囊' | '装备', name: string, desc: string): void {
  const zone = document.getElementById('playZoneCards');
  if (!zone) return;
  zone.querySelectorAll('.play-hint').forEach((e) => e.remove());
  if (hintTimer) clearTimeout(hintTimer);
  const el = document.createElement('div');
  el.className = 'play-hint';
  const t = document.createElement('span');
  t.className = 'ph-title';
  t.textContent = `💡 ${kind} · ${name}`;
  const d = document.createElement('span');
  d.textContent = desc || '（暂无说明）';
  el.append(t, d);
  zone.appendChild(el);
  hintTimer = setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 600);
  }, 5000);
}
