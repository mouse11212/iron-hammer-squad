# Tasks

## 1. TDD：语义 sensor 纯函数族
- [x] 1.1 RED：写 `pipeline/metrics/test/semantic-sensor.test.ts`——`cosine`/`semanticConsistencySeries`/`computeSemanticDrift`。先跑确认 RED。
- [x] 1.2 GREEN：实现 `pipeline/metrics/src/semantic-sensor.ts`（`EmbedFn`/`SemanticResponse` + 纯 `cosine`/`semanticConsistencySeries` + 组装 `computeSemanticDrift` 复用 `driftAlert`），跑到全绿（12 测试）。
- [x] 1.3 阈值占位：τ=0.75/k=3 默认显式标 ASI 框架来源 + 「语义专用阈值待长程标定」。

## 2. 门禁与诚实校验
- [x] 2.1 metrics gate 全绿：lint + tsc + vitest，既有测试零影响（88 → 100，+12）。
- [x] 2.2 诚实路径：不注入 embed / 响应不足 → `computeSemanticDrift` 返回 insufficient-data（单测覆盖），不臆造已发生语义漂移。

## 3. 收尾
- [x] 3.1 `openspec validate --strict` 通过。
- [ ] 3.2 复盘 `docs/plan/M7-semantic-retro.md` + 更新 backlog（M7-c ✅）+ RESUME 指针。
