# 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范与语义化版本。

## [1.1.0] - 2026-10-17

### 新增

- **TypeScript 工程化重构**：原 2800 行单文件 `docs/学堂杀.html` 重构为 34 个模块（core/data/game/net/profile/ui 六层），TypeScript strict 模式零错误；原文件保留为 1:1 复刻基线
- **单文件构建体系**：Vite + vite-plugin-singlefile，`npm run build` 一键产出两个可直接双击运行的单一 HTML 文件
- **PeerJS 双模式**：`cdn` 模式（约 150 KB，CDN 引入）与 `bundled` 模式（约 235 KB，peerjs 内嵌、联机可离线），经 `VITE_PEERJS_MODE` 与 Vite alias 切换，CDN 模式下 peerjs 不进入产物
- **联机协议类型化**：全部 12 种联机消息定义为 `NetMessage` 联合类型，收发两侧强制同步演进
- **测试与校验脚本**：`scripts/smoke.mjs`（单机冒烟）、`scripts/smoke-net.mjs`（双页面联机冒烟）、`scripts/verify-dist.mjs`（产物单文件校验）、`scripts/extract-bank.mjs`（题库数据再生成）
- 开发工作流：`npm run dev` HMR 开发服务器、`npm run typecheck` 类型检查
- 新增 `README.md`、`CODEBUDDY.md`（Agent 协作指南）、`.gitignore`

### 变更

- 卡牌 id 计数器等模块级可变状态收敛至所属模块导出（`cards.ts` / `log.ts` / `chat.ts` / `marks.ts` / `ui/lobby.ts`），消除跨模块直接赋值
- 原散落在脚本顶层的初始化调用与事件绑定收口至 `main.ts` 的 `init()`，保证 ESM 模块无顶层副作用
- `docs/学堂杀.html` 的题库数据由脚本提取生成 `src/data/questionBankData.ts`，与原文件保持同源

### 修复

- 无（本次为纯工程重构，游戏逻辑逐行平移，未改动任何玩法数值与行为）

## [1.0.0] - 初始版本

- 单文件 HTML 版《学堂杀 · 九科争鸣》：九科阵营、35 名角色、12 年级题库（216 题）、完整卡牌与身份局规则、AI 对手、PeerJS 联机、本地档案与成就

[1.1.0]: https://example.com/compare/v1.0.0...v1.1.0
[1.0.0]: https://example.com/releases/tag/v1.0.0
