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

### Requirement: 物理拦截双层（git 钩子 + harness 集成门）
系统 SHALL 通过两个物理层强制 spec-coverage 门，二者 MUST 调用同一纯检查逻辑 `gateSpecCoverage`（单一真相）：(a) git `pre-commit` 钩子，由 tracked 脚本 `scripts/install-hooks.sh` 安装，对暂存文件运行检查、违规则非零退出阻断提交；(b) 接进 harness green/pre-merge 门，使 driver 自动跑的工作同受约束。检查的 git IO（读暂存/变更文件）MUST 为薄边界，判定逻辑 MUST 在纯函数内。

#### Scenario: 安装钩子后提交触发检查
- **WHEN** 运行 `scripts/install-hooks.sh` 后执行 `git commit`
- **THEN** `.git/hooks/pre-commit` 存在并调用 spec-coverage 检查；违规时提交被非零退出阻断

#### Scenario: 钩子与门复用同一纯逻辑
- **WHEN** 审查实现
- **THEN** git 钩子包装与 harness 门均委托 `gateSpecCoverage`，无第二份判定实现
