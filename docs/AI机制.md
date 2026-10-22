# 学堂杀 · AI 与大模型接管机制

> AI 决策体系完整说明：启发式 AI（信念推断 + 博弈策略）与大模型（LLM）接管两套「决策提供者」。
> 玩法规则见 [游戏机制.md](./游戏机制.md)，工程实现见 [架构设计.md](./架构设计.md)。

## 1. 总览：双决策提供者

同一套引擎在每个决策点都会生成一组合法选项 `ChoiceOption[]`，然后按座位属性分流：

```
引擎生成合法选项 ChoiceOption[]
        │
        ├─ 真人座位           → waitChoice()      等玩家点击
        ├─ AI · heuristic     → 启发式脚本        规则式 / 概率式
        └─ AI · llm           → llmChooseAction() 大模型在选项中择一
```

座位的决策模式存在 `Player.aiMode`：

```565:566:src/core/types.ts
  isAI: boolean;
  /** 决策提供者：'heuristic' = 原启发式 AI；'llm' = 由大模型接管（仅当 isAI 时生效） */
  aiMode?: 'heuristic' | 'llm';
```

`applyLlmModes()` 在开局与**对局进行中**随时刷新该标记（改开关立即生效）：

```250:255:src/game/setup.ts
export function applyLlmModes(): void {
  G.players.forEach((p, i) => {
    if (!p.isAI) return;
    p.aiMode = llmEnabledForSeat(i) ? 'llm' : 'heuristic';
  });
}
```

**关键设计原则**：规则合法性永远由引擎保证。启发式脚本按固定套路出牌；大模型则**只能在枚举出的合法选项里挑一个**，不自由生成动作，因此不可能产生非法操作。

---

## 2. 启发式 AI

### 2.1 三层结构

| 层 | 文件 | 职责 |
|---|---|---|
| 大脑 | `src/game/aibrain.ts` | 信念推断、恩怨账本、目标评分、救援/无懈策略（纯逻辑，无动作依赖） |
| 执行 | `src/game/ai.ts` | `aiPlayPhase()` 出牌脚本、`aiSkillValue()` 技能估值、台词 |
| 接入 | `turn.ts` / `damage.ts` / `actions.ts` | 各决策点分流 |

> `aibrain` 的模块级状态（信念表、恩怨表）**刻意不放入 `G`**，因此不随联机 `state_sync` 下发——AI 的「心思」不会泄露给客户端。

### 2.2 信念推断系统

AI 不是上帝视角。它对每个其他玩家维护一份**身份信念分布**：对数得分（log-odds）+ softmax 归一化，`CLAMP = 5` 防止过度自信。

```28:32:src/game/aibrain.ts
/** beliefs[观察者][目标] = 身份信念得分（每个 AI 独立推断，互不共享） */
const beliefs = new Map<number, Map<number, Scores>>();
/** 恩怨：grudges[我][攻击过我的人] = 次数；favors[我][救过我的人] = 次数 */
const grudges = new Map<number, Map<number, number>>();
const favors = new Map<number, Map<number, number>>();
```

信念更新来自两个可观测事件（所有存活 AI 都会观察，除了当事人自己）：

**`noteAttack(src, tgt)`** — 谁攻击了谁：

| 观察 | 信念更新 |
|---|---|
| 打**明置主公** | 反贼 +2.2，内奸 +0.5，忠臣 −0.9，主公 −1 |
| 打**疑似主公方**（主+忠信念 ≥ 0.5） | 反贼 +0.9，忠臣 −0.5 |
| 打**疑似反贼方** | 忠臣 +0.8，反贼 −0.5，内奸 +0.15 |

**`noteSave(saver, saved)`** — 谁救了谁：

| 观察 | 信念更新 |
|---|---|
| 救明置主公 | 忠臣 +1.5，反贼 −0.8 |
| 救疑似反/内（≥0.55） | 反贼 +1.0，忠臣 −0.5 |
| 救其他人 | 忠臣 +0.5 |

已揭示身份与阵亡者**直接锚定为确定值**（得分置 `CLAMP`）。

### 2.3 目标选择：按身份的混合策略

`pickAiTarget(idx)` 对每个在攻击范围内的目标打分：

| 身份 | 策略 |
|---|---|
| 主公 / 忠臣 | `P.rebel + P.spy + 记仇×0.8 − 感恩×0.6 − P.lord×1.5`（坚决回避疑似主公） |
| 反贼 | 正常：`P.lord×1.5 + P.loyal×0.9 − P.rebel×1.4 + …`；**佯攻**：`P.loyal×1.2 + P.spy×0.4 − P.rebel×0.9 + …` |
| 内奸 | 按两阵营期望兵力「拉偏架」：反贼势大打反贼，主公方势大打忠臣，均衡时打恩怨目标；残局（≤2 人）必须出手 |

另有两项博弈行为：

- **佯攻（隐藏意图）**：反贼在前期（round ≤ 2）以 `conceal = max(0.05, 0.4 − round×0.12)` 的概率伪装成忠臣攻击，且**必定出手**不观望。
- **观望（低暴露）**：最优目标得分 < 0.25 时，75% 概率按兵不动，避免无意义出手暴露阵营。

残血加成 `(4 − hp) × 0.12`，但目标装备【白银狮子】时不加成（每次最多受 1 点伤害，残血反而难打穿）。

### 2.4 救援与无懈

`aiShouldSave()` 返回意愿强度，含**欺骗性救援**：

- 反贼在反贼势大时以 12% 概率「假意救主公」骗取信任；
- 内奸以 35% 概率救主公维持忠臣伪装，但主公方稳操胜券时不再救；
- 反贼救反贼同伴 85%（偶尔囤桃）；
- 内奸救「弱势方」维持均衡。

`aiShouldCounter()`（无懈可击）：未被无懈时抵消「对自己/盟友有害」的锦囊；**已被无懈时**，若上一个无懈者是敌人且原锦囊对我方有利（如桃园结义），则再无懈将其恢复。

同阵营判定：身份均已公开时按主忠 / 反内，否则退化为**学科阵营** `faction`。

### 2.5 出牌脚本 `aiPlayPhase()`

固定优先级流水线（每步带 `sleep` 制造节奏感）：

```
主动技（62% 触发；70% 选估值最高、30% 随机）
  → 装备所有装备牌
  → 【桃】回血至满
  → 无中生有 → 五谷丰登
  → 铁索连环（横置最多 2 名敌方；无敌方则 40% 重铸）
  → 火攻 → 借刀杀人 → 决斗
  → AOE（仅当场上无同阵营存活者，避免误伤）
  → 【酒】+【杀】（藤甲目标只用属性杀；连环时优先属性杀触发传导）
  → 丈八蛇矛（两手牌当杀）
  → noteAiTurn()
```

技能估值 `aiSkillValue()` 按效果类型加权：`targetDamage` 1.5/点、`targetLoseHp` 1.3/点、`gainHand` 0.9、`selfDraw` 0.6/张，`costCard` 扣分。

### 2.6 台词

`aiSpeak()`：45% 概率（`Math.random() > 0.55` 则不说）按角色取台词，写入聊天区并广播。

---

## 3. 大模型接管（LLM）

### 3.1 模块

| 文件 | 职责 |
|---|---|
| `src/llm/config.ts` | 配置持久化（`xuetangsha_llm_v1`）、厂商预设、`llmReady()` |
| `src/llm/types.ts` | `LlmConfig`、9 种 `LlmDecisionKind` |
| `src/llm/prompts.ts` | **上下文构造** |
| `src/llm/client.ts` | OpenAI 兼容适配器 + `fetch` + 超时 + JSON 容错解析 |
| `src/llm/agent.ts` | 决策路由、思考指示、全链路回退 |
| `src/ui/llmSettings.ts` | 设置弹窗、接管座位、测试连接 |

支持 OpenAI / DeepSeek / 通义 / 智谱 / Ollama / 自定义，统一走 `/chat/completions`。

### 3.2 配置

```6:19:src/llm/config.ts
export function defaultLlmConfig(): LlmConfig {
  return {
    enabled: false,
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 800,
    timeoutMs: 20000,
    takeoverAll: true,
    takeoverSeats: [],
    debug: false,
  };
}
```

- `llmReady()` = `enabled && baseURL && model`。
- 密钥仅存本机 localStorage；遇 CORS 可把 Base URL 指向本地代理（如 `http://localhost:8787/v1`），复用同一套逻辑。
- 接管粒度：全部 AI 座位，或勾选指定座位（座位 0 通常为真人）。

### 3.3 上下文设计（核心）

一次决策的上下文由 6 段拼装（`buildDecisionMessages`）：

```
system ── SYSTEM_BASE（角色设定 + 输出契约 + 进攻倾向纠偏）
       └─ 身份目标 roleHint

user   ── ① 自身视角 selfView（私有信息：手牌/装备/技能/体力/自己的身份）
       ── ② 他人视角 othersView（严格公开信息：体力/手牌数/装备/已揭示身份 + 距离与可攻击标记）
       ── ③ 信念摘要 beliefView（对各座位身份的推断概率）
       ── ④ 恩怨摘要 grudgeView（谁攻击过你 / 谁救过你）
       ── ⑤ 近期战报 historyView（最近若干条对局记录）
       ── ⑥ 【决策】引导语 + 枚举选项 enumOpts + 输出格式要求
```

#### 无状态、全量重述

**没有多轮对话历史**。每次决策都是全新的 `messages = [system, user]`，把当前局面完整重述一遍。这样避免了历史膨胀，也避免了上下文与引擎状态不同步；跨回合的「记忆」由 ③④⑤ 三段显式注入。

#### `system` — 角色设定 + 输出契约 + 行为纠偏

```69:75:src/llm/prompts.ts
const SYSTEM_BASE =
  '你是桌游《学堂杀》（三国杀-like 学科阵营身份局）中一名由大模型驱动的 AI 玩家。' +
  '请基于当前局面与你的身份目标，做出最合理的决策。' +
  '你只能在给出的「可选动作」列表里选择，严格按要求的 JSON 格式输出，不要输出多余文字。' +
  '【进攻倾向】不要过度保守：只要手牌中有【杀】且攻击范围内存在敌对阵营（身份目标中的敌人）角色，' +
  '就应优先出【杀】打击，推进你的阵营目标；仅在确实没有任何收益（无牌可出 / 所有动作都会损害自己）时才选择「结束出牌」。' +
  '出【杀】后还需在弹出的「选择目标」中指定一名敌对角色，请务必完成这一步，不要中途取消。';
```

【进攻倾向】一段是**实测后的纠偏补丁**——模型一度过度保守、总选「结束出牌」，于是把激励写进 system。`target` 的引导语中「不要选 −1 取消」同理。

system 尾部追加动态身份目标：`你的身份目标：反贼（目标：最先击杀主公）。优先保护自己阵营、打击敌对阵营。`

#### ① 自身视角（私有信息）

完整手牌（含花色点数）、装备、技能、体力、自己的身份（无条件可见）。

#### ② 他人视角（严格公开信息）

信息不对称被显式建模：他人手牌**只给数量不给内容**；身份仅在 `roleRevealed` 时给出，否则写「身份:隐藏」。此外注入：

- **距离**：你到该座位的实际距离 `distBetween`（已含 ±1 马与技能修正）；
- **可攻击标记**：`inRange` 为真时标注「✅在你攻击范围内」，否则「✖超出攻击范围」；
- **对方到你的距离**：供模型评估自身暴露程度。

#### ③ 信念摘要

把 `aibrain.beliefProbs` 的 softmax 结果注入，只保留概率最高的两项，形如：

```
你的身份推断（基于观察，非确定）：
  座位1 王五：疑似 反贼 62% / 忠臣 21%
  座位3 赵六：疑似 忠臣 55% / 内奸 24%
```

这让模型具备启发式 AI 已有的**身份推断能力**，是「打谁」决策的关键依据。

#### ④ 恩怨摘要

```
恩怨：王五 攻击过你 2 次；赵六 救过你 1 次。
```

#### ⑤ 近期战报

取最近若干条 `playLog`（渲染为「张三 使用【杀】→ 李四」），让模型看到**谁对谁做了什么**。已揭示身份的阵亡信息也从这里体现。

#### ⑥ 决策指令

按 `LlmDecisionKind` 分流：

| kind | 引导语要点 |
|---|---|
| `play` | 出牌阶段选动作；有【杀】且场上有敌对目标应优先出杀；技能通常需答题 |
| `target` | 选目标座位（−1 = 取消）；务必选定敌对角色，不要取消 |
| `discard` | 选择要弃置的牌 |
| `rescue` | 濒死自救方式 |
| `shan` | 选出手牌中的【闪】 |
| 其他 | 请选择一项 |

#### 枚举选项

引擎算好的合法动作被编号列出，`value` 为内部标识（`sha_123`、`conv_45_sha`、`skill_xxx`），并标注不可用与原因（`★限定 / ☆觉醒 /（需答题）/（本局已用）/（牌不足）`）。

即：**引擎回答「什么能做」，模型只回答「做哪个」**。

#### 请求与解析

```30:37:src/llm/client.ts
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        response_format: { type: 'json_object' },
      }),
```

`AbortController` 控制超时（默认 20s）；`parseJsonSafe()` 会剥掉 ```json 围栏、截取首尾花括号再 `JSON.parse`，双保险。

### 3.4 决策路由与挂接点

```mermaid
sequenceDiagram
    participant T as 引擎 turn/damage/actions
    participant A as llm/agent
    participant P as llm/prompts
    participant C as llm/client
    participant M as 大模型 API

    T->>T: 生成合法选项 ChoiceOption[]
    T->>A: choosePlay / chooseAmong / llmShouldCounter...
    A->>A: llmReady()?
    A->>P: buildDecisionMessages(idx, kind, opts, instruction)
    P-->>A: [system(基线+身份目标), user(自身+他人+信念+恩怨+战报+指令+选项)]
    A->>A: G.thinkingSeat = idx; render()
    A->>C: callLlm(messages)
    C->>M: POST /chat/completions（20s 超时）
    M-->>C: {"choice": "sha_123"}
    C-->>A: parseJsonSafe
    A->>A: 白名单校验 valid.find(o => o.value === v)
    A-->>T: value（或 null → 安全回退）
    A->>A: G.thinkingSeat = null; render()
```

| 挂接点 | 位置 | 函数 |
|---|---|---|
| 参悟答题 | `turn.ts:98` | `llmQuizDecide` |
| 出牌阶段主循环 | `turn.ts:517` | `llmChooseAction('play')` |
| 目标选择 / 选牌 / 弃牌 | `turn.ts:535` | `llmChooseAction('target'/'discard'/…)` |
| 无懈可击 | `actions.ts:674` | `llmShouldCounter` |
| 濒死救援 | `damage.ts:16` | `llmShouldSave` |

> ⚠️ **已知缺口**：AI 的**出闪**（`actions.ts` `if (t.isAI)` 有闪必出）与**濒死自救**（`damage.ts` 自动吃桃）是硬编码分支，**不经过 LLM 路由**，因此 `agent.ts` 中 `'shan'` / `'rescue'` 两个引导语分支目前是死代码。

### 3.5 容错与防死锁（四层兜底）

1. **超时**：`AbortController`，默认 20s；
2. **解析失败** → 返回 `null`；
3. **白名单二次校验**：`valid.find(o => String(o.value) === String(v))`，命中才采纳；`"skip"` / `-1` 映射到取消项；
4. **绝不回退 `waitChoice`** —— 这是硬约束。AI 座位若掉进等待真人点击的分支会**永久卡死**，所以失败一律回退「结束出牌」（出牌）或「取消项」（其他）。

```529:545:src/game/turn.ts
async function chooseAmong(idx: number, opts: ChoiceOption[], type: PendingType): Promise<string | number> {
  const p = G.players[idx];
  // 大模型接管座位：可用则问模型，失败/不可用回退「取消项」等安全默认；
  // 绝不回退到 waitChoice（对本地 AI 会永久等待输入而卡死）
  if (p.isAI && p.aiMode === 'llm') {
    if (llmReady()) {
      const v = await llmChooseAction(idx, opts, type as LlmDecisionKind);
      if (v !== null && v !== undefined) return v;
    }
    const cancel = opts.find((o) => o.value === -1 || String(o.value) === 'skip');
    const fb = cancel ? cancel.value : opts[0]?.value ?? -1;
    if (llmDebug())
      addLog(`🤖[LLM·座位${idx}] 决策回退: ${type} → ${JSON.stringify(fb)}（${cancel ? '取消项' : '首个选项'}）`, 'sys');
    return fb;
  }
  return waitChoice(idx, opts, type);
}
```

另外，`aiMode === 'llm'` 但 `llmReady()` 为假时（对局中关掉开关），出牌阶段**回退到 `aiPlayPhase()` 启发式**而非直接「结束出牌」，避免座位躺平：

```174:179:src/game/turn.ts
  if (p.isAI && (p.aiMode !== 'llm' || !llmReady())) {
    if (llmDebug() && p.aiMode === 'llm')
      addLog(`🤖[LLM·座位${idx}] 出牌回退: 大模型未就绪 → 改用启发式 AI 出牌`, 'sys');
    await aiPlayPhase(idx);
    return;
  }
```

#### 连续失败自动降级

每个座位维护连续失败计数，**连续 3 次决策失败即本局将该座位降回 `heuristic`** 并写入战报，避免整局反复超时拖慢节奏。降级只在本次对局内生效（`applyLlmModes()` 或新开局会重置计数）。

### 3.6 联机同步

LLM 只在**房主端**运行（房主权威）。调用期间设置 `G.thinkingSeat = idx`，随 `state_sync` 下发，客户端渲染呼吸式「思考中」指示。

### 3.7 调试

开启 `debug` 后，每次决策向战报打印「原始输出 / 最终选择 / 回退原因」：

```
🤖[LLM·座位2] 已选择: kind=play → "sha_417"（【杀】♠7）
🤖[LLM·座位2] 非法选择: kind=target 模型返回 9 不在合法选项中
🤖[LLM·座位2] 出牌回退: 大模型未就绪 → 改用启发式 AI 出牌
```

---

## 4. 两套机制对比

| 维度 | 启发式 AI | 大模型接管 |
|---|---|---|
| 决策依据 | 信念分布 + 恩怨 + 固定优先级脚本 | 自然语言局面理解 + 枚举选项择一 |
| 身份推断 | ✅ 完整信念系统 | ✅ 信念摘要注入上下文 |
| 攻击范围 | ✅ `inRange` 精确计算 | ✅ 距离与可攻击标记注入上下文 |
| 历史记忆 | ✅ 信念/恩怨跨回合累积 | ✅ 战报 + 恩怨摘要注入（无原生多轮记忆） |
| 合法性 | 保证 | 保证（枚举约束 + 二次校验） |
| 响应速度 | 瞬时 | 每决策点 1 次网络请求（默认 20s 超时） |
| 失败风险 | 无 | 四层兜底 + 连续失败自动降级，零死锁 |
| 行为多样性 | 固定套路 | 高，但仍可能保守 |
| 成本 | 零 | Token 消耗 |

---

## 5. 待办与改进方向

| 优先级 | 状态 | 问题 | 改进方向 |
|---|---|---|---|
| P1 | ✅ 已解决 | 上下文缺**攻击范围/距离** | 注入 `distBetween` / `inRange` |
| P2 | ✅ 已解决 | **信念系统未注入 LLM** | 注入 `beliefProbs` 归一化摘要 |
| P3 | ✅ 已解决 | **无历史记忆** | 注入近期战报 + 恩怨计数 |
| P7 | ✅ 已解决 | 无 few-shot；连续失败不降级 | system 加示例；连续 3 次失败本局降级 |
| P4 | ⏳ 待办 | 每决策点一次全量请求，单回合 3~6 次 | 回合级规划（复用已预留的 `LlmPlayAction`） |
| P5 | ⏳ 待办 | 出闪 / 濒死绕过 LLM（硬编码） | 接入统一 `chooseAmong` 路由 |
| P6 | ⏳ 待办 | 启发式答题用固定 `0.6`，LLM 回退用动态 `aiQuizRate` | 统一为 `aiQuizRate` |
