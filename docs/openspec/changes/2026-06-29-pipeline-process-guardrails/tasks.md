## 1. spec-coverage 纯核（纯，TDD + 变异门）

- [ ] 1.1 RED：`spec-coverage.test.ts`——改 `src/acceptance.ts` 无进行中 change → `{ok:false, offenders:['...acceptance.ts']}`
- [ ] 1.2 RED：改能力源码 + 同集含 `docs/openspec/changes/<id>/` → `{ok:true}`
- [ ] 1.3 RED：仅改 test/角色 md/docs → `{ok:true}`（不触发）
- [ ] 1.4 RED：仅改 `bin-*.ts`/`mcp-server.ts` → `{ok:true}`（非能力源码）
- [ ] 1.5 RED：`// @spec-exempt: 理由` 非空 → 该文件豁免；空理由 → 仍违规
- [ ] 1.6 GREEN：实现 `pipeline/driver/src/spec-coverage.ts` `gateSpecCoverage` + 类型 `SpecCoverageResult`
- [ ] 1.7 把 `spec-coverage.ts` 纳入 driver 静态变异门 mutate 列表

## 2. trace:check 一致校验（纯，TDD + 变异门）

- [ ] 2.1 RED：`trace-check.test.ts`——完整链 → `{ok:true, broken:[]}`
- [ ] 2.2 RED：spec 无 tests → `broken` 含 `spec-without-tests`，`ok:false`
- [ ] 2.3 RED：spec 无 commit → `broken` 含 `spec-without-commit`，`ok:false`
- [ ] 2.4 GREEN：在 `pipeline/metrics/src/weave-traces.ts`（或邻近纯模块）实现 `traceCheck(links): TraceCheckResult`
- [ ] 2.5 `spec-coverage`/`trace-check` 纯逻辑入 metrics/driver 变异门 mutate 列表（对应包）

## 3. 物理拦截层（薄 IO，e2e 验证）

- [ ] 3.1 `scripts/gate-spec-coverage`：读 `git diff --cached --name-only` → 调 `gateSpecCoverage` → 违规非零退出 + 打印 offenders
- [ ] 3.2 `scripts/install-hooks.sh`：安装 `.git/hooks/pre-commit` 调 `scripts/gate-spec-coverage`（幂等、可重装）
- [ ] 3.3 `bin-trace-check.ts` + `npm run trace:check`：weave 当前归档 → `traceCheck` → 断链非零退出 + 打印清单
- [ ] 3.4 接进 harness green/pre-merge 门（`gates.ts` 或 `batchIntegrate`）：spec-coverage + trace-check 任一不过则不放行集成

## 4. 杀手验证（证物理拦截真生效）

- [ ] 4.1 模拟"改 acceptance.ts 无 change"的暂存集 → 装好钩子后 `git commit` 被非零阻断（亲跑，留证据）
- [ ] 4.2 回填杠杆1/2 规约后 `npm run trace:check` 跑绿（断链清零）

## 5. 前置依赖（另立 change）

- [ ] 5.1 回填 `acceptance` + 反目标管道 OpenSpec 规约（把现有 `acceptance.test.ts` 等挂 Scenario），门上线前完成——否则现有杠杆码被判孤儿。
