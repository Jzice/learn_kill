/* ==================== 规则弹窗 ==================== */
import { FACTIONS } from '../data/factions';
import { GRADE_ORDER } from '../data/grades';
import { CHARACTERS } from '../data/characters';
import { ACHIEVEMENTS, PROFILE } from '../profile/profile';

/** 五个 tab（顺序即高度测量顺序） */
const RULE_TABS = ['basic', 'factions', 'cards', 'chars', 'ach'];
/** 各 tab 内容自然高度的最大值（与视口无关，缓存以免重复测量） */
let rulesNaturalMax = 0;
/** 视口尺寸变化监听（窗口变小/变大时重新套用 85vh 上限） */
let rulesRO: ResizeObserver | null = null;

/**
 * 解除高度限制后依次渲染各 tab，量出内容自然高度的最大值。
 * 必须临时解除 max-height，否则盒子被 85vh 截断、量到的只是上限而非真实内容高度。
 */
function measureRulesNaturalMax(): number {
  if (rulesNaturalMax > 0) return rulesNaturalMax;
  const box = document.querySelector<HTMLElement>('#rulesModal .rules-box');
  if (!box) return 0;
  const keepH = box.style.height;
  const keepMaxH = box.style.maxHeight;
  box.style.height = 'auto';
  box.style.maxHeight = 'none';
  let max = 0;
  for (const t of RULE_TABS) {
    renderRulesContent(t);
    max = Math.max(max, box.scrollHeight);
  }
  box.style.height = keepH;
  box.style.maxHeight = keepMaxH;
  rulesNaturalMax = max;
  return max;
}

/** 把弹窗高度锁定为 min(内容自然高度上限, 85vh)，使切换 tab 时尺寸与位置恒定 */
function lockRulesHeight(): void {
  const box = document.querySelector<HTMLElement>('#rulesModal .rules-box');
  if (!box) return;
  const natural = measureRulesNaturalMax();
  if (natural <= 0) return; // 量不到高度时保持 CSS 自适应，避免塌成 0
  const cap = Math.round(window.innerHeight * 0.85);
  box.style.height = `${Math.min(natural, cap)}px`;
}

export function openRules(): void {
  const modal = document.getElementById('rulesModal')!;
  modal.classList.add('show');
  lockRulesHeight(); // 先锁定高度再切默认 tab，避免"先撑开再收缩"的跳动
  switchRulesTab('basic');
  if (!rulesRO && typeof ResizeObserver !== 'undefined') {
    rulesRO = new ResizeObserver(() => {
      if (document.getElementById('rulesModal')!.classList.contains('show')) lockRulesHeight();
    });
    rulesRO.observe(modal);
  }
}

export function closeRules(): void {
  document.getElementById('rulesModal')!.classList.remove('show');
}

/** 切换 tab：仅切换高亮与内容；高度已锁定，故不会引起弹窗缩放或位移 */
export function switchRulesTab(tab: string): void {
  document.querySelectorAll('.rule-tab').forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.tab === tab));
  renderRulesContent(tab);
  document.getElementById('rulesContent')!.scrollTop = 0;
}

/** 渲染指定 tab 的规则内容（不含 tab 高亮与滚动重置，供高度测量复用） */
function renderRulesContent(tab: string): void {
  const el = document.getElementById('rulesContent')!;
  if (tab === 'basic') {
    el.innerHTML = `<div class="rule-section"><h4>🎯 游戏目标</h4><ul>
      <li><b>主公</b>：消灭所有反贼和内奸</li>
      <li><b>忠臣</b>：主公存活并消灭反贼和内奸</li>
      <li><b>反贼</b>：杀死主公</li>
      <li><b>内奸</b>：最后单挑杀死主公</li>
    </ul></div>
    <div class="rule-section"><h4>🔄 回合流程</h4><ol>
      <li>判定阶段：结算判定区</li>
      <li>摸牌阶段：摸2张牌，可参悟答题多摸1张</li>
      <li>出牌阶段：点击手牌出牌，点击座位卡选目标，点击技能发动（需答题）</li>
      <li>弃牌阶段：点击手牌弃置</li>
    </ol></div>
    <div class="rule-section"><h4>📚 年级与角色池</h4><ul>
      <li>内置初中三年与高中三年，每学年分上下学期，共 12 个年级</li>
      <li><b>角色池随年级累加</b>：选择较高年级时，低年级角色同样可选</li>
      <li>可通过「题库管理」导入外部题库（本地文件或 URL）</li>
    </ul></div>
    <div class="rule-section"><h4>🏅 积分与成就</h4><ul>
      <li>每局结算：胜利 +120，败北 +40，每答对1题 +6，解锁成就 +30</li>
      <li>积分达到阈值自动提升等级：蒙童→学童→秀才→…→宗师</li>
      <li>档案保存在浏览器本地，换设备不会同步</li>
      <li>联机房间中点击成员即可查看其成就</li>
    </ul></div>
    <div class="rule-section"><h4>⚰️ 阵亡与身份公开</h4><ul>
      <li>角色阵亡后，其身份自动公开，所有玩家均可看到</li>
      <li>主公身份从一开始就公开</li>
    </ul></div>
    <div class="rule-section"><h4>👥 联机座位</h4><ul>
      <li>座位列表中<b>本人角色永远排在第一</b>，方便快速定位</li>
      <li>移动端座位卡可横向滑动查看全部玩家</li>
    </ul></div>`;
  } else if (tab === 'factions') {
    el.innerHTML = Object.entries(FACTIONS)
      .map(
        ([k, f]) =>
          `<div class="rule-section" style="padding:8px;background:rgba(0,0,0,.25);border-radius:6px;border-left:3px solid ${f.color};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:19px">${f.icon}</span><span style="color:${f.color};font-weight:700;font-size:13px">${f.name}</span><span style="font-size:11px;color:var(--muted)">${f.desc}</span></div>
      <div style="font-size:11px;margin-top:3px"><b style="color:#f5e0a0">${f.lordSkill.name}</b>：${f.lordSkill.desc}</div>
    </div>`,
      )
      .join('');
  } else if (tab === 'cards') {
    el.innerHTML = `<div class="rule-section"><h4>⚔️ 基本牌</h4><ul><li><b>杀</b>：造成1点伤害（共30张：普通杀20 / 火杀5 / 雷杀5）</li><li><b>火杀 · 雷杀</b>：属性杀，可触发【铁索连环】传导；火杀受【藤甲】放大</li><li><b>闪</b>：抵消杀</li><li><b>桃</b>：回复1点体力或濒死自救</li><li><b>酒</b>：下张杀伤害+1，濒死时可自救</li></ul></div>
    <div class="rule-section"><h4>🎴 锦囊</h4><ul><li><b>无中生有</b>：摸2张</li><li><b>过河拆桥</b>：弃一张牌</li><li><b>顺手牵羊</b>：获得距离1内一张牌</li><li><b>决斗</b>：轮流出杀</li><li><b>南蛮/万箭</b>：需出杀/闪（【藤甲】可免疫）</li><li><b>桃园结义</b>：全体回血</li><li><b>无懈可击</b>：抵消锦囊</li><li><b>乐不思蜀</b>：判定红桃则失效</li><li><b>闪电</b>：判定黑桃2-9受3点雷伤</li><li><b>借刀杀人</b>：令其出杀，否则交出武器</li><li><b>五谷丰登</b>：亮牌后依次各取一张</li><li><b>铁索连环</b>：横置/重置，或重铸摸一张</li><li><b>火攻</b>：弃同花色牌造成1点火伤</li></ul></div>
    <div class="rule-section"><h4>🛡️ 装备</h4><ul><li><b>诸葛连弩</b>：无限杀</li><li><b>青龙偃月刀</b>：杀被闪后可再出杀</li><li><b>丈八蛇矛</b>：两张手牌当杀</li><li><b>青釭剑</b>：无视目标防具</li><li><b>雌雄双股剑</b>：对异性用杀，对方令你摸一张或自弃一张</li><li><b>贯石斧</b>：杀被闪后弃两张牌强制命中</li><li><b>方天画戟</b>：最后一张手牌为杀时可打3个目标</li><li><b>寒冰剑</b>：弃两张牌改为令其弃两张牌</li><li><b>古锭刀</b>：目标无手牌时伤害+1</li><li><b>八卦阵</b>：判定红视为闪</li><li><b>仁王盾</b>：黑杀无效</li><li><b>藤甲</b>：普通杀/南蛮/万箭无效，火焰伤害+1</li><li><b>白银狮子</b>：每次受伤最多1点，失去时回1血</li><li><b>+1/-1马</b>：影响距离</li></ul></div>
    <div class="rule-section"><h4>🔗 连环与翻面</h4><ul><li><b>连环（横置）</b>：被【铁索连环】横置的角色受到属性伤害时，伤害传导给所有横置角色，随后全部重置</li><li><b>翻面</b>：与连环相互独立；翻面角色跳过其下一个回合并翻回正面</li></ul></div>`;
  } else if (tab === 'chars') {
    let html = '';
    for (const g of GRADE_ORDER) {
      const chars = CHARACTERS.filter((c) => c.grade === g);
      if (!chars.length) continue;
      html += `<div class="rule-section"><h4>📅 ${g}</h4>`;
      chars.forEach((c) => {
        const f = FACTIONS[c.faction];
        html += `<div style="padding:7px;background:rgba(0,0,0,.25);border-radius:6px;border-left:3px solid ${f.color};margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:19px">${c.avatar}</span><span style="color:${f.color};font-weight:700;font-size:13px">${c.name}</span><span style="font-size:11px;color:var(--muted)">${c.title} · ${f.name} · 体力${c.hp}</span></div>
          <div style="font-size:11px;margin-top:3px">${c.skills.map((s) => `<b style="color:#f5e0a0">${s.name}</b>（${s.type === 'active' ? '主动·需答题' : '触发'}）：${s.desc}`).join('<br>')}</div>
        </div>`;
      });
      html += `</div>`;
    }
    el.innerHTML = html;
  } else if (tab === 'ach') {
    el.innerHTML = `<div class="rule-section"><h4>🏅 成就一览</h4><div class="ach-grid">${
      ACHIEVEMENTS.map((a) => {
        const un = !!PROFILE.achievements[a.id];
        return `<div class="ach-item ${un ? 'unlocked' : 'locked'}"><div class="ach-icon">${un ? a.icon : '🔒'}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
      }).join('')
    }</div></div>`;
  }
}
