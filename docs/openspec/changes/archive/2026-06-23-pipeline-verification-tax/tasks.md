## 1. 事件耗时归类（纯，TDD）

- [x] 1.1 RED：写 `events-tax.test.ts`——`categorizeDuration` 按 D1 口径累加(dev→实现;test/review/gate/orchestrator-fix→验证)，跳无 durationMs 的 squash/integrate
- [x] 1.2 RED：空列表 → `{implementationMs:0, verificationMs:0}`
- [x] 1.3 RED：`taxByTrace` 按 traceId 分组、各组算 tax(复用 verificationTax)
- [x] 1.4 GREEN：实现 `pipeline/metrics/src/events-tax.ts`(`categorizeDuration` + `taxByTrace` 纯，复用 `compute.ts` 的 `verificationTax`)

## 2. 事件读取（薄 IO，TDD）

- [x] 2.1 RED：`readEventsJsonl` 逐行 parse、跳畸形行、缺文件返回 []
- [x] 2.2 GREEN：实现 `readEventsJsonl`(本地最小 event 形状，不 import driver)

## 3. 接入 collect + 类型 + 看板

- [x] 3.1 `types.ts`：`MetricsSnapshot` 加 `implementationMs: number|null` + `taxByTrace`(per-US 明细，可选)
- [x] 3.2 `collect.ts`：读 `<repoRoot>/pipeline/.runtime/events.jsonl` → `categorizeDuration` → 填 verificationMs/implementationMs/verificationTax；无实现事件回落 null
- [x] 3.3 `board.ts`：Verification Tax 行补显示实现/验证 ms + 新增「Verification Tax 按 US」可选小节

## 4. 验证（工作节奏 §4–5）

- [x] 4.1 lint + tsc + vitest 全绿
- [x] 4.2 变异级单测：`events-tax.ts` 用穷尽精确断言覆盖各 op/phase 归类与边界（metrics 包暂无 stryker 变异门基建——E4 抽取时未配；包级变异门另立基建任务，不在本切片 scope）
- [x] 4.3 集成/真实验证：用真实 sink 写一个含 dev/test/review/gate 的 events.jsonl → `npm run report` → 看板 Verification Tax 出真值(与手算一致)、per-US 明细正确

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 `openspec validate pipeline-verification-tax --strict` 通过
- [x] 5.2 更新 `pipeline/README.md`(metrics:Verification Tax 已真值化) 与 `docs/context/RESUME.md`
- [x] 5.3 复盘要点并入 `docs/plan/M4plus-event-log-retro.md`(或新增简短续记)
- [x] 5.4 `openspec archive pipeline-verification-tax` → `git commit` + `push`
