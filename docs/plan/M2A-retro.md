# M2-A 复盘（fincards-m2a-multisource-aggregate）

> 日期 2026-06-17。M2-A = 多源聚合(真实功能)+ 首次多角色编排(Planner-Workers-Judge)。对应 V4 §3.1、§4.2、§4.6。

## 交付结果

- **产品**:fincards 单源→多源,聚合 Bloomberg markets/economics/technology 三个 feed,按 link 去重、按时间倒序、单源失败韧性。真实运行:三源各 30 → 去重 87 → 今日 44 → 卡片页,status ok。
- **编排**:主 session 当 orchestrator,真 spawn 4 个子 agent:测试 Agent / 开发 Agent / 评审 Agent×2。
- **质量**:快 gate 33 测试全绿;变异门 **All files 100%、aggregate 100%、0 存活**。

## 多角色编排有效性(M2 要证明的核心)

| 角色 | 行为 | 边界是否守住 |
|---|---|---|
| 测试 Agent | 写 8 场景测试,RED | ✅ 未碰 src(隔离上下文使"写测试≠写实现"成为物理事实) |
| 开发 Agent | 实现 aggregate + main,GREEN | ✅ 未改测试;且**升级**了测试文件的 tsc `!` 缺陷(边界顶出问题) |
| 评审 Agent×2 | 独立评审 | ✅ 只读;**Judge 抓出实现+测试自己没发现的真实缺陷** |

**关键证据:角色隔离把缺陷顶到表面。** 评审#2 揪出:
1. **数据安全 bug**:全源失败时 main 仍写空页覆盖上次成功产物 → 已修(失败保留旧产物)。
2. **2 个真实测试缺口**(非等价):Invalid Date 排序靠 V8 sort 运气通过 → 根因重构(分区:NaN 不进比较器)→ 变异 100%。

## 暴露的、可固化的点(→ M3 候选 / Steering Loop)

1. **SendMessage 不可用**:无法续上已结束的子 agent 会话,纠错只能由 orchestrator 以集成者身份代修(注明域归属)。→ M5/D9 第三方消息组件应支持"把 must-fix 路由回拥有该域的角色"。
2. **角色 Agent 需共享"项目约定 Guide"**:测试 Agent 漏写 `!`(不知道 noUncheckedIndexedAccess + 项目用 `items[0]!` 约定)。→ 给所有角色子 agent 注入一份项目约定前馈 Guide(V4 §4.1 Guides),使首次产出即合规。
3. **变异测试杀不掉的根因常在实现**:比较器内判 NaN 依赖 sort 实现的未定义行为,示例测试杀不掉——改成确定性结构(分区)才可杀。可复用结论:遇"靠运气通过"的存活变异,优先重构实现而非堆测试。

## 追溯链

spec `fincards-m2a-multisource-aggregate` → test(aggregate.test.ts)→ 评审两遍 → 实现/重构 → commit(待提交)。
