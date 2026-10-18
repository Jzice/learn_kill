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
  shandian: '留存判定：黑桃 2-9 受 3 点伤害，否则移交下家',
};

let hintTimer: ReturnType<typeof setTimeout> | undefined;

/** 使用技能 / 锦囊时在出牌区内浮现内容提示，数秒后自动淡出 */
export function showPlayHint(kind: '技能' | '锦囊', name: string, desc: string): void {
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
