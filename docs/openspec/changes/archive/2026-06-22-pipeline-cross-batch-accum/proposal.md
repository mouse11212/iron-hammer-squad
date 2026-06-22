## Why

当前 `batchIntegrate` 每次以 `git worktree add -f -B integration <wt> <base>` **重置 integration 分支到 base**,只装本批 feature。在②轮询守护多轮运行下,后一批会**丢弃前几批已验证合入的 feature**——integration 暂存区只反映最后一批,违背"暂存区累积全部已验证工作待人类合 main"的军规 8 语义。本切片改为**跨批次累积**:integration 首次(不存在)从 base 建,之后在已有 integration 上累加。

## What Changes

- `batchIntegrate` 不再无条件 `-B` 重置:先查 integration 分支是否存在(`git rev-parse --verify`)——存在则**复用**(checkout 已累积分支,不重置),不存在则**从 base 建**。
- 新批 feature 与已累积内容的冲突,沿用现有 per-feature 回滚 + held 升级。
- "清空重来"为 HITL(人类合 main 后删 integration 分支),不在自动流水线内。

## Capabilities

### Modified Capabilities
- `worktree-integration`: batchIntegrate 由"每批重置 base"改为"首建后跨批次累积"。

## Impact

- **代码**:`worktree.ts` batchIntegrate 加分支存在判别 + 条件创建/复用。
- **测试变更(红线 5)**:batch 用例从断言"-B 重置"改为"首批从 base 建、后续复用累积";记录。
- **真相源**:V4 §9 军规 8(集成分支=暂存区)、②daemon 多轮。
- **不在本切片**:多项目混批;held 通知;integration 自动合 main(仍 HITL)。
