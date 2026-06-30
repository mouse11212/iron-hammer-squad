## 1. spec-coverage 纯核（纯，TDD + 变异门）

- [x] 1.1–1.5 RED：`spec-coverage.test.ts` 10 用例（无 change 违规 / 有 change 通过 / 仅 test·role·docs 不触发 / bin shim 不触发 / @spec-exempt 豁免与空理由）
- [x] 1.6 GREEN：`pipeline/driver/src/spec-coverage.ts` `gateSpecCoverage` + `SpecCoverageResult`
- [x] 1.7 `spec-coverage.ts` 纳入 driver 静态变异门 mutate 列表（stryker.conf.json）

## 2. trace:check 一致校验（纯，TDD；tests 缺失降级警告）

- [x] 2.1–2.3 RED+GREEN：`trace-check.test.ts` 9 用例（完整链 / spec-without-tests→warnings / spec-without-commit→broken / missing-spec→broken / 多字段 / 多链 / warnings 不计入 ok / 枚举契约）
- [x] 2.4 GREEN：`pipeline/metrics/src/trace-check.ts` `traceCheck`（broken/warnings 拆分；BOSS 06-30 裁决：tests=0 不阻断）
- [x] 2.5 metrics 包无 stryker（E4 未配）→ 穷尽精确断言单测兜底（9 用例）

## 3. 物理拦截层（薄 IO，e2e 验证）

- [x] 3.1 `pipeline/driver/src/bin-spec-coverage.ts`（薄 IO：读暂存 + 内容 → gateSpecCoverage → 违规非零退出 + 修复提示）+ `scripts/gate-spec-coverage`（shell）
- [x] 3.2 `scripts/install-hooks.sh`：安装 `.git/hooks/pre-commit`（幂等可重装）；已实证阻断
- [x] 3.3 `pipeline/metrics/src/bin-trace-check.ts` + `npm run trace:check`（报告门：broken 决定 exit，warnings 不影响）
- [x] 3.4 **按 X 裁决（KB 锚定）：spec-coverage 不接 inner-loop green**（Ashby 必要多样性 + 过度约束失效模式）；全仓覆盖靠 (a) pre-commit 钩子。trace-check 作报告门不接阻断（tests 派生局限 + prose capability）

## 4. 杀手验证（证物理拦截真生效）

- [x] 4.1 模拟"能力源 probe 无 change"暂存 → `git commit` 被钩子非零阻断（HEAD 未变，无垃圾 commit，亲跑留证）
- [x] 4.2 `npm run trace:check` 跑绿（33 条链，broken=0；5 warnings 为历史归档 commit 无 test + prose capability，不阻断）

## 5. 前置依赖（另立 change，已完成）

- [x] 5.1 回填 `acceptance` + 反目标管道 OpenSpec 规约——由 `2026-06-29-pipeline-backfill-lever-specs`（commit `c09a4d8`）完成

## 6. spec 同步（KB 锚定 × 裁决）

- [x] 6.1 traceability spec：traceCheck 的 spec-without-tests 降级 warnings（不计入 ok），加 missing-spec scenario + 报告门 scenario
- [x] 6.2 spec-coverage-gate spec：Requirement 2 改为"主落点 pre-commit + 刻意不接 inner-loop"（Ashby / 过度约束 / 运行节奏① KB 锚点）
