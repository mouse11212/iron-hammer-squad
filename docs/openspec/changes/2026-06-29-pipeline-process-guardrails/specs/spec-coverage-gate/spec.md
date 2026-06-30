## ADDED Requirements

### Requirement: 能力源码改动须有 SoT 规约（spec-first 覆盖门）
系统 SHALL 提供确定性纯函数 `gateSpecCoverage(changedPaths: string[]): SpecCoverageResult`，判定一个变更集是否违反"能力源码须先有 OpenSpec 活规约/进行中 change"的纪律：当变更集含**能力源码**（匹配 `pipeline/*/src/**/*.ts`，排除 `*.test.ts` 与已知 bin shim `bin-*.ts`/`mcp-server.ts`）时，变更集 MUST 同时含至少一个进行中 OpenSpec change 路径（`docs/openspec/changes/<id>/**`，排除 `archive/`）。否则判定为违规。该函数 MUST 纯确定性、不调用 LLM。违规时返回违规文件清单。

#### Scenario: 改能力源码但无进行中 change → 违规
- **WHEN** changedPaths 含 `pipeline/driver/src/acceptance.ts` 且不含任何 `docs/openspec/changes/<id>/`（非 archive）路径
- **THEN** 返回 `{ ok: false, offenders: ['pipeline/driver/src/acceptance.ts'] }`

#### Scenario: 改能力源码且同变更集含进行中 change → 通过
- **WHEN** changedPaths 含 `pipeline/driver/src/acceptance.ts` 且含 `docs/openspec/changes/2026-06-29-x/proposal.md`
- **THEN** 返回 `{ ok: true, offenders: [] }`

#### Scenario: 仅改测试/文档/角色 prose → 不触发
- **WHEN** changedPaths 仅含 `pipeline/driver/test/acceptance.test.ts`、`pipeline/roles/x.md`、`docs/**`
- **THEN** 返回 `{ ok: true, offenders: [] }`（无能力源码即不要求 change）

#### Scenario: bin shim / mcp-server 不算能力源码 → 不触发
- **WHEN** changedPaths 仅含 `pipeline/driver/src/bin-enqueue.ts` 或 `pipeline/driver/src/mcp-server.ts`
- **THEN** 返回 `{ ok: true, offenders: [] }`

#### Scenario: 带非空理由的豁免注释 → 豁免该文件
- **WHEN** 某能力源码改动文件含 `// @spec-exempt: 纯重构无行为变更` 且无进行中 change
- **THEN** 该文件不计入 offenders（豁免理由非空）

#### Scenario: 豁免注释理由为空 → 仍违规
- **WHEN** 某能力源码改动文件含 `// @spec-exempt:`（理由空白）
- **THEN** 该文件仍计入 offenders（空理由不构成豁免）

### Requirement: 物理拦截主落点 = git pre-commit 钩子（不接 inner-loop green，KB 锚定）
系统 SHALL 通过 git `pre-commit` 钩子强制 spec-coverage 门：由 tracked 脚本 `scripts/install-hooks.sh` 安装 `.git/hooks/pre-commit` → `scripts/gate-spec-coverage` → `pipeline/driver/src/bin-spec-coverage.ts`（薄 IO：读暂存 + 内容）→ 纯核 `gateSpecCoverage`（单一真相，无第二份判定）。违规时非零退出阻断提交；违规信息含可执行修复提示（建 change 或 `// @spec-exempt: 理由`），符合"sensor 信号为 LLM 消费优化"（Böckeler positive prompt injection）。**全仓覆盖靠此钩子**——computational gate 便宜到可随每次提交实时运行（Böckeler 运行节奏① During coding session）。

**(b) harness inner-loop green 门刻意不接**（BOSS 2026-06-30 裁决 + KB 锚定）：门的模型是 `pipeline/<pkg>/src/**` 能力源（Ashby 必要多样性——sensor 只能调节它有模型的部分）；inner-loop 跑产品代码（`iron-hammer-output/`），**不在门的模型范围** → 接进去为装饰门（对产品永远 `ok=true`）或假阳性，属"过度约束"真实失效模式（Augment 三层：Start narrow, measure, then expand）。inner-loop 亦不跑 `pipeline/` 自身（轨⑤ harness 工程走 superpowers:SDD，非 inner-loop）。

#### Scenario: 安装钩子后提交触发检查
- **WHEN** 运行 `scripts/install-hooks.sh` 后执行 `git commit`
- **THEN** `.git/hooks/pre-commit` 存在并调用 spec-coverage 检查；违规时提交被非零退出阻断

#### Scenario: 钩子 → bin → 纯核 复用单一真相
- **WHEN** 审查实现
- **THEN** `scripts/gate-spec-coverage`（shell）→ `bin-spec-coverage.ts`（薄 IO）→ `gateSpecCoverage`（纯核），无第二份判定实现

#### Scenario: inner-loop green 门不接 spec-coverage（Ashby 边界）
- **WHEN** 审查 harness green 门（`makeGates` 的 `GateOptions`）
- **THEN** spec-coverage **不**作为 green 注入项（对比 secretScan 注入）；全仓覆盖靠 pre-commit 钩子，因门的模型（`pipeline/<pkg>/src/**`）不含 inner-loop 跑的产品代码
