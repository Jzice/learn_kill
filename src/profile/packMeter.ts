/* ==================== 扩展包按次使用计量 ====================
 * 与「学分商店」解耦：本模块只负责扩展包（初中 / 高中 / 全部）的使用门槛——
 *   - 每天 3 次共享免费额度（三包合计，跨日自动重置）
 *   - 超出后按本局用到的最高阶扩展包消耗学分（学分仅由答题 / 复习积累，见 credits.ts）
 * 不永久解锁：每次使用（含每天前 3 次免费）都是一次独立事件。
 * 纯本地：学分不联机同步，计费由各客户端在开局时自行校验与扣减。
 */
import type { PacketId } from '../data/packets';
import { PACK_TOLL, isExpansion, packetRank, packTollOf } from '../data/packets';
import { PROFILE, saveProfile } from './profile';
import { credits, spendCredits } from './credits';

/** 三种扩展包每天共享的免费使用次数 */
export const PACK_FREE_DAILY = 3;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 跨日重置免费计数器（写回存档） */
export function ensurePackDay(): void {
  if (PROFILE.packUsage.date !== todayStr()) {
    PROFILE.packUsage = { date: todayStr(), used: 0 };
    saveProfile();
  }
}

/** 今日已用免费次数 */
export function packFreeUsed(): number {
  ensurePackDay();
  return PROFILE.packUsage.used || 0;
}

/** 今日剩余免费次数 */
export function packFreeRemaining(): number {
  return Math.max(0, PACK_FREE_DAILY - packFreeUsed());
}

/** 预览：给定一组包（基础包 ∪ 个人叠加），本局是否需要付费、是否可负担 */
export function packUsePreview(ids: PacketId[]): {
  needsPay: boolean;
  toll: number;
  viaFree: boolean;
  affordable: boolean;
} {
  const toll = packTollOf(ids);
  const needsPay = toll > 0;
  if (!needsPay) return { needsPay: false, toll: 0, viaFree: false, affordable: true };
  const free = packFreeRemaining();
  const viaFree = free > 0;
  return { needsPay: true, toll, viaFree, affordable: viaFree || credits() >= toll };
}

/**
 * 结算一次扩展包使用：优先扣免费额度，否则扣学分。
 * 返回是否成功（学分不足且免费用尽则失败，调用方应阻止开局）。
 */
export function consumePackUse(ids: PacketId[]): { ok: boolean; viaFree: boolean; toll: number; remaining: number } {
  const toll = packTollOf(ids);
  if (toll <= 0) return { ok: true, viaFree: false, toll: 0, remaining: packFreeRemaining() };
  ensurePackDay();
  if (packFreeRemaining() > 0) {
    PROFILE.packUsage.used = (PROFILE.packUsage.used || 0) + 1;
    saveProfile();
    return { ok: true, viaFree: true, toll, remaining: packFreeRemaining() };
  }
  if (!spendCredits(toll, `pack:${ids.filter(isExpansion).sort((a, b) => packetRank(b) - packetRank(a))[0]}`)) {
    return { ok: false, viaFree: false, toll, remaining: 0 };
  }
  return { ok: true, viaFree: false, toll, remaining: 0 };
}

/** 该扩展包是否可被选为「基础包 / 叠加包」（免费剩余或学分足够） */
export function canEnablePacket(id: PacketId): boolean {
  if (!isExpansion(id)) return true;
  return packFreeRemaining() > 0 || credits() >= PACK_TOLL[id];
}
