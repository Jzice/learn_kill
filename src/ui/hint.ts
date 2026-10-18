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

/** 更新顶栏下方的技能 / 锦囊内容提示面板（大屏：战报下方；小屏：战报右侧） */
export function showPlayHint(kind: '技能' | '锦囊', name: string, desc: string): void {
  const title = document.getElementById('hintTitle');
  const body = document.getElementById('hintBody');
  if (!title || !body) return;
  title.textContent = `💡 ${kind} · ${name}`;
  body.textContent = desc || '（暂无说明）';
  body.classList.remove('flash');
  void (body as HTMLElement).offsetWidth; // 重启动画
  body.classList.add('flash');
}
