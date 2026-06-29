## Why

过程审计（2026-06-29）发现：杠杆1/杠杆2-2a 的能力代码（`acceptance.ts` 等）**绕过了 OpenSpec 活规约 SoT**——用 superpowers 设计文档+计划顶替了规约，`specs/` 下无 `acceptance` 规约、`weave-traces` 织链看不到这块。

根因不是"选错技能"，而是**结构性缺陷**：技能路由（v4 §4.2）与追溯链（§4.4）只被编码成 prose 意图——是 §4.1 控制矩阵里最弱的「推断性前馈引导」，**零确定性门**。工程给"产出质量"上了确定性门（lint/test/变异/密钥），却把"自己的过程纪律"（SoT 主权、追溯一致）留作 prose，于是必然漂移（未上门的意图在长链路漂移，正是工程要消灭的失效模式，递归咬到建造者）。助推因素：superpowers 由 SessionStart priming + 链式工作流，OpenSpec 是手敲斜杠命令——无门的纪律挡不住"最省力路径"。

本切片把这两条最承重的纪律从 prose 升级为**物理确定性门**（不靠大模型决策）。

## What Changes

- 新能力 `spec-coverage-gate`：确定性门 `gateSpecCoverage`——变更集含能力源码（`pipeline/*/src/**/*.ts`，排除 `*.test.ts`/bin shim）时，同分支 MUST 含对应 OpenSpec change，否则退出非零。支持 `// @spec-exempt: <非空理由>` 豁免。纯逻辑核 + 薄 git IO。
- 扩展 `traceability`：新增"追溯链一致门" `traceCheck`——校验 `change→spec→tests→commit` 各节点完整一致，断链（孤儿 spec=无 tests/无 commit）则报告并退出非零。纯确定性（基于 OpenSpec 归档 + git，无 LLM）。
- 物理拦截双层：(a) git `pre-commit` 钩子（tracked `scripts/install-hooks.sh` 安装）每次提交运行 spec-coverage 门；(b) 两门接进 harness green/pre-merge 门，使 driver 自动跑的工作同受约束。钩子与门复用同一纯检查逻辑（单一真相）。

## Capabilities

### New Capabilities
- `spec-coverage-gate`: spec-first 覆盖门——能力源码改动须同分支有 OpenSpec change（确定性、可豁免、双层物理拦截）。

### Modified Capabilities
- `traceability`: 新增"追溯链一致门"——把"链节缺失即显式标注"升级为"断链即退出非零的确定性门"。

## Impact

- **新增**：`pipeline/driver/src/spec-coverage.ts`（纯核 `gateSpecCoverage`）+ 测试；`scripts/install-hooks.sh` + `scripts/gate-spec-coverage`（薄 git IO 包装）；git `pre-commit` 钩子。
- **扩展**：`pipeline/metrics/src/weave-traces.ts`（加 `traceCheck` 一致校验）+ `bin-trace-check.ts` + `npm run trace:check`；接进 harness green/pre-merge 门（`gates.ts` / `batchIntegrate`）。
- **依赖前置（红线3 从窄到宽）**：门上线前 MUST **回填**杠杆1/2 的 OpenSpec 规约（`acceptance` + 反目标管道），否则门会（正确地）把现有杠杆码判为孤儿——回填另立 change。
- **新文件入静态变异门** mutate 列表（`spec-coverage.ts`）。
- **验证来源**：本工程 2026-06-29 过程审计（杠杆1/2 绕过 SoT）。**杀手验证**：在"无 OpenSpec change 却改 acceptance.ts"的模拟提交上，spec-coverage 门 MUST 拦截退出非零。
