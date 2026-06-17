## Why

需求澄清(M2-B)定下下一步优先级=**多源聚合**(用户=个人投资者,痛点=信息过载)。同时 M2 要验证**多角色编排**(测试 Agent≠开发 Agent + 评审两遍)。本切片用"多源聚合"这个真实增量,既推进产品,又作为多角色编排的首个真实载体。

## What Changes

- fincards 从单 feed 升级为**聚合多个 Bloomberg topic feed**（markets + economics + technology，均实测可用）。
- 新增聚合逻辑：合并多 feed 条目 → 按 link **去重**（同文常跨 topic 重复）→ 按 pubDate 倒序。
- 单个 feed 抓取失败**不拖垮整体**（resilience：跳过失败源，其余照常）。
- main 改为：抓 N feed → 各自 parse → aggregate(去重/排序) → filterToday → render。
- **过程用多角色子 agent 交付**：测试 Agent 先写聚合用例（看不到实现）、开发 Agent 实现（不能改测试）、评审两遍。

## Capabilities

### New Capabilities
- `news-aggregate`: 把多个 feed 的 NewsItem 合并、按 link 去重、按时间倒序，并对单源失败保持韧性。

### Modified Capabilities
<!-- 不改 news-parse/render/filter 行为，仅新增聚合层；fetch 复用(多次调用)。 -->

## Impact

- fincards 新增 `src/aggregate.ts` + 测试；`main.ts` 改为多 feed 流程；`fetch.ts` 复用（按 URL 多次调用）。
- 复用 M0 TDD + M1 变异门（aggregate 为纯逻辑，纳入变异范围）。
- 首次落地 Planner-Workers-Judge 多角色编排（V4 §3.1、§4.2、§4.6）。
