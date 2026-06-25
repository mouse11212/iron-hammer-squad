# Tasks

## 1. TDD：HIR sensor 纯函数族
- [x] 1.1 RED：写 `pipeline/metrics/test/hir-sensor.test.ts`——`hir`、`hirSeries`、`risingAlert`、`computeHir`、`readHirRuns`。先跑确认 RED。
- [x] 1.2 GREEN：实现 `pipeline/metrics/src/hir-sensor.ts`（`HirRun` 投影 + 纯 `hir`/`hirSeries`/`risingAlert` + 组装 `computeHir` + 专用薄 IO `readHirRuns` 保 ts），跑到全绿（17 测试）。
- [x] 1.3 阈值占位：θ=0.5/windowSize=5 默认值代码注释显式标「待长程标定」；k=3 标 KB 来源。

## 2. 门禁与诚实校验
- [x] 2.1 metrics gate 全绿：lint + tsc + vitest，既有测试零影响（71 → 88，+17）。
- [x] 2.2 真实 `runs-ledger.jsonl`（当前空）→ `computeHir` 返回 insufficient-data/rate null/不告警，确认不臆造。

## 3. 收尾
- [x] 3.1 `openspec validate --strict` 通过。
- [ ] 3.2 复盘 `docs/plan/M7-hir-retro.md` + 更新 backlog（M7-b ✅）+ RESUME 指针。
