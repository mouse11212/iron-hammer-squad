## 1. 编排准备（Planner）

- [x] 1.1 主 session 作为 orchestrator；用 OpenSpec tasks.md 作为 task 状态（未单建 JSON——完整消息/状态机制留 M5/D9）
- [x] 1.2 明确角色边界：测试 Agent 只写 test、开发 Agent 只写 src、评审 Agent 只读

## 2. 测试 Agent（Worker A，先于实现）

- [x] 2.1 spawn 测试子 agent：据规约写 `test/aggregate.test.ts`（8 场景），看不到实现，RED
- [x] 2.2 orchestrator 校验：测试存在且 RED；测试 Agent 未越界（无 src/aggregate.ts）

## 3. 开发 Agent（Worker B）

- [x] 3.1 spawn 开发子 agent：实现 `src/aggregate.ts` 使测试转绿；未改测试；升级了 tsc `!` 边界问题
- [x] 3.2 开发子 agent 改 `main.ts`：三源 fetch→parse→aggregate→filterToday→render；单源失败韧性 + 三态 run log

## 4. 评审两遍（Judge）

- [x] 4.1 评审 Agent #1（计划/规约对齐）：通过——三 Requirement 对齐、复用分层、无越界
- [x] 4.2 评审 Agent #2（代码评审）：有条件通过——揪出 2 个 must-fix（数据安全 bug + 2 个真实测试缺口）

## 5. 门禁与集成

- [x] 5.1 快 gate 全绿（lint+tsc+vitest，33 测试）
- [x] 5.2 变异门：aggregate 纳入 mutate；根因重构（分区）后 **All files 100%、aggregate 100%、0 存活**
- [x] 5.3 真实运行 main：三源各 30 → 去重 87 → 今日 44 → 生成 dist/index.html，status ok

## 6. 收尾

- [x] 6.1 复盘 M2-A（`docs/plan/M2A-retro.md`）：编排有效性 + must-fix 落实 + M3 候选
- [x] 6.2 追溯链 + 提交推送
