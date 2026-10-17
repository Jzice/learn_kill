# 学堂杀 · 九科争鸣

一款运行在浏览器中的**学科主题身份竞技卡牌游戏**（类三国杀规则）：玩家扮演语文、数学、英语、物理、化学、生物、历史、地理、政治九大"科目阵营"的名人角色（鲁迅、牛顿、门捷列夫、秦始皇……），在主公/忠臣/反贼/内奸的身份局中出牌博弈，而**答题是核心成长机制**——答对题目可获得"学识""护盾""连击"等奖励，用于免伤、摸牌、发动技能。

本项目由单文件 HTML 游戏（`docs/学堂杀.html`，保留为 1:1 复刻基线）工程化重构为 **TypeScript 模块化工程**，并可完整编译回**单一 HTML 文件**，双击即玩、零部署成本。

## 功能特性

- **完整卡牌体系**：基本牌（杀/闪/桃/酒）、10 种锦囊、7 种装备，含判定区（乐不思蜀/闪电）、距离计算、武器射程
- **35 名角色**：覆盖初一上至高三下 12 个年级，每名角色拥有主动技（需答题发动）与触发技；主公额外获得阵营主公技
- **答题驱动**：内置 216 道九科题目；出牌、参悟、濒死免伤、发动技能均可通过答题增益；支持导入本地 JSON/JS 题库或从 URL 加载
- **AI 对手**：空位由 AI 补齐，具备装备、桃救援、敌方识别、随机台词
- **联机对战**：基于 PeerJS 的房主权威架构，6 位房间号建房/加入，实时同步牌局、战报、聊天；掉线自动转 AI
- **本地档案**：积分、11 级段位（蒙童→宗师）、12 项成就、分科目正确率统计（localStorage）
- **双端适配**：桌面环形座位 + 移动端 Dock/抽屉布局

## 快速开始

```bash
npm install        # 首次安装依赖
npm run dev        # 开发服务器（HMR）
npm run build      # 构建两种模式到 dist/
```

无需服务器，直接打开构建产物即可游玩：

| 产物 | PeerJS 方式 | 适用场景 |
|---|---|---|
| `dist/学堂杀.html` | CDN script 标签 | 体积最小（约 150 KB），需联网联机 |
| `dist/学堂杀.bundled.html` | 内嵌 peerjs 包 | 完全自包含（约 235 KB），联机可离线 |

## 命令一览

| 命令 | 说明 |
|---|---|
| `npm run dev` / `npm run dev:bundled` | 开发服务器（对应两种 PeerJS 模式） |
| `npm run build` | 同时构建两种模式 |
| `npm run build:cdn` / `npm run build:bundled` | 单独构建某一模式 |
| `npm run typecheck` | TypeScript 严格模式检查（`tsc --noEmit`） |
| `npm run clean` | 清理 dist |

### 冒烟测试（无头 Chromium）

```bash
node scripts/smoke.mjs "学堂杀.html"       # 单机：大厅→开局→答题/出牌→AI 推进，含控制台错误检查
node scripts/smoke-net.mjs "学堂杀.html"   # 联机：双页面建房→加入→状态同步→战报广播
node scripts/verify-dist.mjs               # 校验产物为单文件且 PeerJS 模式正确
```

## 工程架构

```
src/
├── main.ts            # 入口：挂载 window 全局（内联 onclick）+ 初始化序列，无游戏逻辑
├── core/              # types.ts（领域类型 + NetMessage 联合类型）dom/sound/fx
├── data/              # factions / grades / characters / cards / questionBank（纯数据层）
├── game/              # 引擎：state(G) rules quiz damage actions skills turn ai loop
│                       #      choice(Promise 桥) marks log chat setup
├── net/               # network(NET/同步协议) protocol rooms peer.cdn/peer.bundled
├── profile/           # localStorage 档案 / 等级 / 成就 / 结算
└── ui/                # render(单一重渲染入口) hand lobby modals dock playzone
scripts/               # build/dev 包装、题库数据提取、冒烟测试、产物校验
docs/学堂杀.html        # 原版单文件（1:1 复刻基线，请勿修改）
```

**关键设计**

- **单一状态驱动渲染**：全局 `G` 状态对象 + 顶层 `render()` 全量重绘（与原版一致，无框架）
- **房主权威联机**：房主运行游戏循环并广播 `state_sync` 快照（80ms 防抖）；远程选择/答题经 Promise 桥接（`choose_request`/`quiz_response`）；断线自动转 AI
- **PeerJS 双模式**：`VITE_PEERJS_MODE=cdn|bundled` 经 Vite alias 切换 `#peer` 实现，CDN 模式下 peerjs 不进入产物
- **模块化不变量**：`G` 字段形状不可变（联机序列化依赖）；内联模板调用的函数必须在 `main.ts` 挂载并在 `globals.d.ts` 声明；模块间允许函数级循环引用但禁止顶层副作用

详见 [CODEBUDDY.md](./CODEBUDDY.md)。

## 玩法规则

- **身份**：主公（公开）需消灭所有反贼与内奸；忠臣保护主公；反贼杀死主公；内奸需最后单挑主公获胜
- **回合**：判定 → 摸牌（2 张）→ 参悟答题（答对多摸 1 张 + 奖励）→ 出牌 → 弃牌（手牌上限=体力）
- **答题奖励**：答对 +1 学识；学识可抵伤害（2 点挡 1 伤）、当闪、濒死自救；连击 3/5/7 有额外奖励
- **积分**：胜 +120 / 负 +40 / 每题 +6 / 成就 +30；段位从蒙童到宗师共 11 级

## 技术栈

TypeScript 5.6（strict）· Vite 5 · vite-plugin-singlefile · PeerJS 1.5 · Playwright（测试）

## 许可

Private project.
