# 内循环剧本（单个最小单元）

> 验证来源: M0(端到端跑通)、M1(加变异门)、M2-A(多角色化) · 状态: active

## 前置

- 该单元已有 OpenSpec 规约切片(可执行 SoT，`validate --strict` 通过)。
- 单元足够小,可"短命快合"(几小时~几天合回，V4 §9 / §10 US 大小上界)。

## 步骤

1. **规约切片**:确认 OpenSpec change 的 specs(WHEN/THEN)就位且 strict 通过。
2. **测试先行**(测试 Agent，`roles/test-agent.md`):据规约写 RED 测试，隔离实现。
3. **实现**(开发 Agent，`roles/dev-agent.md`):TDD GREEN，纯逻辑/IO 分层，不改测试。
4. **Plan-Alignment**(待 Hook 化):复用现有组件?遵守 Never/边界?(当前由评审承担)
5. **评审两遍**(评审 Agent，`roles/review-agent.md`):计划对齐 + 代码评审(Judge)。
6. **门**(`gates/quality-gates.md`):快 gate 全绿 → 变异门 ≥ 阈值。
7. **合并**:过集成门后并入(V4 §9 集成分支兜底 + squash)。
8. **追溯 + 复盘**:记 spec→test→commit;复盘暴露点 → 固化为对 harness/`pipeline/` 的 diff(Steering Loop)。

## 上下文策略(D3)

不强制每单元重置;按"任务相关性 + 上下文预算"评估并记录(相关性高+预算够→不重置)。

## 不变量

- 写测试 ≠ 写实现(上下文隔离)。
- 确定性逻辑可测;网络/时钟/随机隔离到边界。
- 失败路径不破坏既有产物(M2-A 教训)。
