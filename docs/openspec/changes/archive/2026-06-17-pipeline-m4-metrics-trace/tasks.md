## 1. 脚手架

- [x] 1.1 `pipeline/metrics/` 初始化 Node+TS(复用约定)
- [x] 1.2 `src/types.ts`：MetricsSnapshot、TraceLink、Numstat、DefectRecord

## 2. 纯计算 + 渲染（test-first）

- [x] 2.1 `compute.test.ts`：TRR / Churn / VerificationTax(null) / DefectEscape(0) 边界，RED
- [x] 2.2 实现 `compute.ts`(四指标纯函数)使绿
- [x] 2.3 `board.test.ts`(含 trace 正/反查) → 实现 `board.ts` + `trace.ts` 使绿(13 测试全绿)

## 3. 采集器 + 入口（薄 IO）

- [x] 3.1 `collect.ts`：git numstat churn + 归档/活跃 change 计数(TRR) + 读 defects/traces → 快照
- [x] 3.2 `bin-report.ts`：collect → board → 写 `docs/metrics/dashboard.md`
- [x] 3.3 seed `data/traces.json`(M0–M3 各里程碑) + `data/defects.json`(3 缺陷均 caught, escaped 0)

## 4. 门禁 + 真实采集

- [x] 4.1 快 gate 全绿(lint+tsc+vitest，13 测试)
- [x] 4.2 真实运行:本仓采集生成看板——TRR 83.3% / churn +20871-6525 / DefectEscape 0% / 追溯链 5 条

## 5. E4 抽取 + 收尾

- [x] 5.1 metrics 落 `pipeline/metrics/`；README 更新(E4 ② 可观测就位)
- [x] 5.2 复盘 + 追溯链 + 归档 + 提交推送
