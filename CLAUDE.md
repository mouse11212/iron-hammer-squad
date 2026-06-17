# 铁锤小队（Iron Hammer Squad）

## 项目目标

构建一套 **harness 级的 AI SDLC 流水线**：给定需求，最大限度地用 AI / AI 团队完整实现从需求到交付的软件开发生命周期。
本工程追求的不是"看起来全自动"，而是 **在已知可靠性边界内，可观测、可度量、可问责地交付**。

核心哲学：**人定目标、人判质量、人担责；AI 编排执行。** 对抗的根本问题是单步误差在长链路中的复利累积（agent drift）——用纪律化的 harness 把误差拦在放大之前。

## 当前阶段

**构思阶段，尚无代码。** 落地/开发计划待构思收敛后另行规划。设计真相源见 `docs/requirements/铁锤小队-Harness工程构思-v4.md`（最新版）。

## 整体架构（三层模型）

工程分三个纵向楼层，各司其职，**互不冲突**（范围可画满，但 harness 约束从窄到宽逐步加固）：

| 层 | 职责 | 关键词 |
|---|---|---|
| ③ Compound / Steering | 小队越用越强：每次失败→诊断根因→固化进下层→该类错误结构性不可重现 | 复盘产物 = 对 rules/lint/gate/skill 的 diff |
| ② Harness | 流水线每一步**单次执行可靠** | Guides(前馈) + Sensors(反馈) + Quality Gates |
| ① Loop Engineering | **无人值守地反复跑完整 SDLC**（你要的"流水线"在这） | 外循环(工程级) + 内循环(单 US) |

产物：可运行软件 + ReleaseNote + 手册。详细角色↔技能路由、工作流、DoD、门禁见 `docs/requirements/铁锤小队-Harness工程构思-v4.md`。

## 知识库 Grounding（强制）

- **KB_ROOT**：`/Users/gourouhundun/Documents/01_工作/研究课题/LLMwiki/workspaces/ai-dev-learning`
- **凡涉及 AI 开发领域（harness / agent / 编排 / 上下文 / 测试反作弊等）的决策，必须先查 KB 再决策，不得凭记忆或训练数据。**
- **检索方式**：用 `claude-obsidian` 技能（`wiki-query`）做**按需逐层披露**（hot → index → 相关页），不要全量灌入（避免 context rot）。
- KB 指导与当前规约冲突时 → **升级人类裁决**，agent 不得自行覆盖规约。

## 目录与文件约定

| 内容 | 位置 | 命名 |
|---|---|---|
| **最终交付物：harness SDLC 流水线本身** | **`pipeline/`**（根目录） | — |
| 非项目本身文件：总结 / 计划 / 开发实现计划 / 临时讨论 / 临时脚本等 | `docs/` 下 | — |
| 用本项目**做出的产出**（小队交付的软件，流水线的验证载体） | `iron-hammer-output/`（即"铁锤小队输出"） | **文件夹一律用英文命名** |

> **`pipeline/` = 最终产物**（roles/gates/guides/workflows）。抽取线方案 A：能力在 `iron-hammer-output/` 上验证后抽取进 `pipeline/`，且**随后续验证持续修正**（抽取≠冻结）。详见 `pipeline/README.md` 与 backlog「抽取线 E」。当前 E0（已抽 M0–M2）。

> 不要把总结、计划、临时脚本散落到根目录——一律进 `docs/`。

## 核心禁止事项

1. **禁止臆造**：不得编造无来源的数字、事实或决策。引用 KB 须可溯源（KB 本身的纪律是"先验证再摄取、剔除真来源上叠加的假细节"）。
2. **禁止跳过 KB**：AI 开发领域决策前未查 KB 即拍板 = 违规。
3. **禁止一次性拉满**：不得第一天就上全自动 + 全门禁。harness **从窄到宽**（Start narrow, measure, then expand），过度约束是已知失效模式。
4. **禁止角色混同**：写测试的 agent ≠ 写实现的 agent。
5. **禁止弱化测试**：agent 不得随意修改/删除既有测试；变更测试需独立记录与门禁。
6. **禁止替人拍板**：遇"未知 / 缺信息 / 无法判断" → 阻塞升级交还人类。
7. **人类门禁不可绕过**：产品范围、架构锁定、规约变更、安全敏感改动、生产部署必须人类签字。

## 工具与技能（离线包 `tools/`，完整清单见 `tools/TOOLS.md`，角色↔技能映射见 V4 §4.2）

| 工具 | 形态 | 版本 | 状态 |
|---|---|---|---|
| **OpenSpec** | CLI `openspec` + 项目级命令/技能 | 1.4.1 | ✅ 已构建离线可运行；已 `init` 装为项目级（`.claude/commands/opsx`、`.claude/skills/openspec-*`、`openspec/`） |
| **gstack** | CC skill 集合（60 skills） | 1.58.1.0 | ✅ 已装为项目级（`.claude/skills/gstack`）；⚠️ 浏览器工具(/qa /browse)需 bun |
| **superpowers** | CC 插件（14 skills） | 5.1.0 | 已 vendor（本机全局可用） |
| **frontend-design** | CC 插件 | — | 已 vendor（本机全局可用） |
| **claude-obsidian** | CC 插件（26 skills） | 1.9.2 | 已 vendor（本机全局可用） |

- **使用 OpenSpec 命令**：先 `export PATH="$PWD/tools/bin:$PATH"`（验证 `openspec --version`）；斜杠命令如 `/opsx:propose`。
- **新机器离线安装**：`tools/install-offline.sh <目标仓库> [--with-plugins]`。
- 不预置项（原生/约定/服务/待选型）：Claude Code 本体、Hooks/MCP、CodeQL/Dependabot、变异测试/linter、消息组件(D9)、Agent SDK、DeerFlow(D7)、bun —— 原因见 `tools/TOOLS.md` E 节。

## 落地方案（方案一：PRD + OpenSpec + backlog）

文档分层，避免多 SoT 打架：

| 层 | 文件 | 角色 |
|---|---|---|
| 架构宪法 | `docs/requirements/铁锤小队-Harness工程构思-v4.md` | 机制权威，回查细节用 |
| 北极星 PRD | `docs/requirements/铁锤小队-PRD-v1.md` | 愿景/范围/成功标准（人读，**非 SoT**） |
| 能力排序 | `docs/plan/铁锤小队-能力backlog-v1.md` | 简→繁 里程碑（M0→M8），施工路线 |
| **可执行规约 SoT** | OpenSpec 活规约（实体在 `docs/openspec/`，`/opsx:propose`） | 机器判定的真相源 |

> ⚠️ **勿删根目录 `openspec` 软链**：OpenSpec 把工作区目录名写死为 `<项目根>/openspec`（无配置项可改）。我们把实体规约放在 `docs/openspec/`，根目录保留 `openspec → docs/openspec` 软链让 CLI/技能仍能识别。**这个软链是 OpenSpec 正常工作的必需品，不是遗留垃圾，不要清理。**

> 施工节奏：拿起 backlog 一个切片 → `/opsx:propose` 写规约 → TDD 实现 → 确定性 gate → 短命快合。**当前下一步：M0 单 US 内循环最小切片。**

## 参考文档

- 架构宪法（构思 v4）：`docs/requirements/铁锤小队-Harness工程构思-v4.md`（历史 v3 同目录）
- 北极星 PRD：`docs/requirements/铁锤小队-PRD-v1.md`
- 能力 backlog：`docs/plan/铁锤小队-能力backlog-v1.md`
- 离线工具清单：`tools/TOOLS.md`
- 知识库关键页：`KB_ROOT/wiki/topics/{harness-engineering, pev-loop, guides-and-sensors, loop-engineering, agent-drift}.md`、`KB_ROOT/wiki/questions/{how-to-build-high-quality-harness, agentic-harness-hardcore-problems}.md`
