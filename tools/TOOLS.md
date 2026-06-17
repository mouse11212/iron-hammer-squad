# 铁锤小队 · 离线工具包（TOOLS.md）

> 目的：离线、快速地把依赖装进各角色 Agent。据 `docs/requirements/铁锤小队-Harness工程构思-v4.md` 识别。
> 最后更新：2026-06-16。总体积约 214M。

## 包结构

```
tools/
├─ skills/                  # vendored 技能/工具源（离线）
│  ├─ superpowers/          # CC 插件 5.1.0（14 skills）
│  ├─ frontend-design/      # CC 插件（Anthropic）
│  ├─ claude-obsidian/      # CC 插件 1.9.2（26 skills）
│  ├─ openspec/             # OpenSpec 1.4.1 @1b06fdd —— 已构建(node_modules+dist)，离线可运行
│  └─ gstack/               # gstack 1.58.1.0 @c7ae632（60 skills，浏览器工具需 bun）
├─ bin/openspec             # OpenSpec 离线启动器（exec 预构建 CLI）
├─ install-offline.sh       # 离线安装器：把技能装进目标仓库 .claude/
└─ TOOLS.md                 # 本文件
```

## A. 工具清单

| 工具 | 形态 | 版本 | 离线状态 | V4 用途 |
|---|---|---|---|---|
| **superpowers** | CC 插件（14 skills） | 5.1.0 | ✅ 源码已离线 | TDD、writing/executing-plans、worktrees、subagent-driven dev、code-review（§4.2 开发/测试/评审） |
| **frontend-design** | CC 插件 | — | ✅ 源码已离线 | UX/UI 设计（§4.2 UX/UI Agent） |
| **claude-obsidian** | CC 插件（26 skills） | 1.9.2 | ✅ 源码已离线 | KB grounding、wiki-query、项目日志（§11） |
| **OpenSpec** | CLI `openspec` + CC 命令/技能 | 1.4.1 | ✅ **已构建，离线可运行**（含 node_modules + dist） | 活规约 SoT、`validate --strict`、proposal/specs/design/tasks（§3.4、§4.4 规约 Agent） |
| **gstack** | CC skill 集合（60 skills + `setup`） | 1.58.1.0 | ⚠️ 方法论技能离线可用；**浏览器工具(/qa /browse)需 bun** 构建 browse 二进制 | /office-hours、/plan-*-review、/qa、/review、/cso、/ship、/retro、/learn（§4.2 多角色） |

## B. 本项目已完成的「项目级技能」安装（`./.claude/`）

| 安装项 | 位置 | 说明 |
|---|---|---|
| OpenSpec 命令 | `.claude/commands/opsx/`（5 个，如 `/opsx:propose`） | 经 `openspec init --tools claude` 生成 |
| OpenSpec 技能 | `.claude/skills/openspec-{propose,apply-change,archive-change,explore,sync-specs}` | 同上 |
| OpenSpec 规约工作区 | `docs/openspec/`（changes/ specs/） | 活规约脚手架；根目录留 `openspec → docs/openspec` 软链供 CLI 识别（**勿删**，OpenSpec 目录名写死为 `<根>/openspec`） |
| gstack | `.claude/skills/gstack` → 符号链接 `tools/skills/gstack` | 60 个 SKILL.md 可发现 |

> `openspec` 命令需在 PATH 中：`export PATH="<repo>/tools/bin:$PATH"`，验证 `openspec --version` → 1.4.1。
> 本仓库未把 superpowers/frontend-design/claude-obsidian 链入项目级（它们本机已全局可用，避免重名）。

## C. 在新（含离线）机器上安装

```bash
cd tools
./install-offline.sh /path/to/目标仓库            # 装 OpenSpec + gstack
./install-offline.sh /path/to/目标仓库 --with-plugins  # 额外链入 3 个插件（目标机无全局插件时）
export PATH="$PWD/bin:$PATH"
```

## D. 运行依赖说明（务必知悉，非全部开箱即用）

- **OpenSpec**：✅ 已含 `node_modules`，**真离线可运行**。注意它需要目标机有 **Node ≥ 20.19**。重建命令：`cd skills/openspec && npm install && node build.js`（其 `prepare` 钩子调 pnpm，本包改用 `node build.js` 直接构建绕过）。
- **gstack**：源码已离线，但 **未含 `node_modules` 与 browse 二进制**。
  - 方法论类技能（规划/审查/复盘/发布/安全方法论）：放进 `.claude/skills/` 即可用，**无需 bun**。
  - 浏览器类工具（`/qa` 无头 Chromium、`/browse`）：需 **bun**（本机未装）+ 在目标仓库内 `cd skills/gstack && ./setup --local` 构建 browse 二进制并装 playwright。bun 安装见 gstack/setup 顶部提示。
  - **延后决定（2026-06-16）**：经核对 V4，gstack 仅 **`/qa 真实浏览器`（§4.2 测试 Agent）** 需要 bun/playwright/字体；其余 gstack 技能（/plan-*、/review、/cso、/ship、/retro、/learn、designer 等）均为 markdown 方法论技能，**无此依赖**。`/qa` 仅用于对**产品 Web UI** 做功能/集成测试，不在 harness 自身构建关键路径上。**故 gstack 浏览器离线功能暂不完善，待小队首次交付带浏览器界面的产品时再装 bun 激活。**

## E. 不 vendor（原生 / 约定 / 服务 / 待选型）

| 工具 | 类别 | 原因 |
|---|---|---|
| Claude Code 本体 / Hooks / MCP | 运行时原生 | 宿主与内置能力，无需下载（§3.1、§4.1） |
| Conventional Commits / Trunk-Based / Feature Flags | 约定/方法论 | 规范而非软件（§9） |
| CodeQL / Dependabot | CI/安全服务 | GitHub 托管，随 CI 配置（§9 军规7、§4.7） |
| 变异测试 / linter / 类型系统 | 语言相关 | 技术栈选定后按栈安装（§4.6、§13） |
| 第三方消息组件（Redis/NATS/文件队列） | D9 待选型 | 尚未定档（§3.1） |
| Claude Agent SDK / Managed Agents | 按需升级路径 | 非默认编排层，不预置（§3.1） |
| DeerFlow | 已决策暂不引入 | 决策 D7（§3.1） |
| bun | gstack 工具链 | 浏览器工具依赖；按需在目标机安装（见 D 节） |
