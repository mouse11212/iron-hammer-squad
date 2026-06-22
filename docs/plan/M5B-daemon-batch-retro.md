# 复盘:隔离/集成解耦 + 批后集成 + 轮询守护(②)

> 日期 2026-06-22 · change `2026-06-22-pipeline-daemon-batch` · 权威 V4 §9 军规 4/8、D4

## 交付

- **runIsolated 重构(解耦)**:done → squash 出 feature 分支,返回 `{result, branch?, committed}`,**移除 per-job integrate**;集成统一交批后(即使 N=1)。隔离=per-job、集成=per-batch,各单一职责。4 测试。
- **drainBatchIsolated(批后集成)**:N 路并行 worker 认领 inner-loop job → runIsolated(产分支)→ ack/fail;抽干后把 committed 分支统一交 batchIntegrate(无则跳过)。真内存队列 + 注入 runOne 测,3 测试(部分成功仅成功分支进集成 / 全失败跳过 / 空队列)。
- **driveParallelLoop(轮询守护)**:循环 drainRound → 计空轮 → sleep,连续空轮达上限退出(防无限空转);drain/sleep 注入,4 测试。main 块 `IH_DAEMON=1` 启守护、`IH_POLL_MS` 调间隔。
- driver gate 124 + 变异门(未动 mutate 文件,保持)绿。

## 关键决策

- **隔离与集成解耦**:批量集成要求先各自产分支、批后统一集成。runIsolated 不再 per-job integrate(M5-B 行为),集成移到 drainBatchIsolated。**测试变更(红线 5)**:isolated 用例从"断言 per-job integrate"改为"断言产分支、不 integrate"。
- **ack/fail 按 inner-loop 结果**:done→ack、其余→fail;集成成败不影响 job 终态(集成是批后另一层,held 升级人类)。
- **守护停止条件**:连续空轮达上限(非永久常驻),适合"事件来一批处理一批"+ 可控退出;真正长驻可设大 maxEmptyRounds。

## 暴露点

- relProjectDir 在批后集成 gate 里需要(集成 worktree 跑 green);drainBatchIsolated 由 deps 显式传入(operator 配置),未从 job spec 动态推导——多项目混批是后续问题(当前单项目假设)。

## ③ 全链真 e2e 验证(2026-06-22)

入队 inner-loop job → drainBatchIsolated → 隔离 worktree 内**真 claude 跑内循环** → done → squash 产分支 → batchIntegrate → `{ready:true, merged:[agent/e2e-iso-1], held:[]}` → main HEAD 不变 → 隔离(主检出无产物)→ 回收。249s,全链(①隔离+②批后集成+真 claude)端到端打通。

> ⚠️ **harness 硬化发现**:首跑撞**瞬时 API 错误**("socket connection closed unexpectedly")——测试 phase isError → job failed。**反向验证了失败路径正确**(不提交/不集成/回收)。但瞬时 API/网络抖动是**可重试**的基础设施问题,当前当硬失败 → 长跑流水线会被随机打断。**待硬化**:makePhaseInvoke/编排对瞬时 API 错误做有限重试(区分"模型/代码失败"与"基础设施抖动")。记入 RESUME 下一步①。

## 不在本切片(留后)

- 真实多 job 隔离 → 批后 batchIntegrate 的完整 e2e(各组件已分别真验证:runIsolated 真集成 M5-B、batchIntegrate 真冲突上一切片、drainBatchIsolated 真内存队列单测;全链真 git+真 claude 串视需要)。
- integration 跨批次累积;多项目混批的 relProjectDir 动态推导;held 通知。
