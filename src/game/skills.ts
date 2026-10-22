/* ==================== 主动技能（薄封装） ====================
 * 分派顺序：
 *   1. 声明式技能（46 名基础角色 93 个技能 + 9 主公技 + 18 学科主题技）
 *      → 交 src/game/skillEngine.ts 统一执行（答题门槛 + 费用 + 原语）
 *   2. 扩展包技能（带 SkillEffect 原语）→ 交 src/game/skillfx.ts 执行
 * 本文件不再包含任何按技能 id 的 switch 分支。
 */
import { G } from './state';
import { FX, floatTextFx } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { defOf } from '../data/skilldefs';
import { addLog, addPlayLog } from './log';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { showPlayHint } from '../ui/hint';
import { aiSpeak } from './ai';
import { askQuizForPlayer } from './quiz';
import { NET, syncStateToClients } from '../net/network';
import { isExpansionActive, runSkillEffects } from './skillfx';
import { invokeActive } from './skillEngine';

export async function useActiveSkill(idx: number, skillId: string): Promise<void> {
  const p = G.players[idx];
  if (!p) return;
  const sk = p.skills.find((s) => s.id === skillId);
  if (!sk) return;
  if (p.flags.skillUsed) {
    addLog('本回合已使用过主动技能');
    return;
  }
  // 1. 声明式技能
  if (defOf(skillId)) {
    await invokeActive(idx, skillId);
    return;
  }
  // 2. 扩展包技能（带原语组合）
  if (isExpansionActive(sk)) {
    p.flags.skillUsed = true;
    addLog(`【${sk.name}】${p.name} 发起挑战…`, 'hl');
    render();
    const ok = await askQuizForPlayer(p, true);
    if (!ok) {
      addLog(`${p.name} 知识不足，【${sk.name}】失败`, 'dmg');
      floatTextFx(idx, '技能失败', '#8a8070');
      render();
      if (NET.isHost) syncStateToClients();
      return;
    }
    addPlayLog(p.name, 'skill', sk.name, '');
    addLog(`📘 玩法·【${sk.name}】：${sk.desc || '（暂无说明）'}`, 'explain');
    showPlayHint('技能', sk.name, sk.desc || '');
    aiSpeak(p, 'skill');
    FX.skillWave(idx);
    showPlayCard({ name: sk.name, suit: '✦', num: '', type: 'trick' }, p.name, FACTIONS[p.faction].color);
    await runSkillEffects(idx, p, sk.effects!);
    return;
  }
  // 3. 兜底：无声明也无原语的技能直接按原语执行（理论不可达，防止静默失效）
  if (sk.effects?.length) {
    p.flags.skillUsed = true;
    await runSkillEffects(idx, p, sk.effects);
    return;
  }
  addLog(`【${sk.name}】暂无可执行效果`, 'dmg');
  render();
}
