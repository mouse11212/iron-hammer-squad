## ADDED Requirements

### Requirement: 隔离与集成解耦
隔离执行(runIsolated)SHALL 在 inner-loop `done` 时只 squash 出 feature 分支并返回其分支名与提交结果(`{result, branch, committed}`),**不在 per-job 内做集成**。集成统一由批后步骤承担(即使单 job 也走批量集成)。

#### Scenario: 隔离只产分支
- **WHEN** 一个隔离 job 结果为 done 且 squash 成功
- **THEN** 返回该 feature 分支名与 committed=true,且**未触发任何集成操作**

#### Scenario: 非 done 不产分支
- **WHEN** 隔离 job 结果非 done
- **THEN** committed=false,无 feature 分支供集成

### Requirement: 批后集成
一批隔离 job 完成后,系统 SHALL 收集所有 committed 的 feature 分支交 `batchIntegrate` 统一集成,产出 `{ready, merged, held}`;无 committed 分支时跳过集成。集成结果停在 HITL,不写 main。

#### Scenario: 批后统一集成
- **WHEN** 一批 3 个隔离 job 中 2 个 done(各产分支)、1 个 failed
- **THEN** 仅对 2 个 feature 分支调 batchIntegrate,failed 的不参与

#### Scenario: 批内无成功分支
- **WHEN** 一批 job 全部非 done
- **THEN** 跳过集成,不创建/改动 integration 分支

### Requirement: 轮询守护
系统 SHALL 提供常驻轮询驱动:循环执行 recover → drain(并行 worker)→ 批后集成 → 等待轮询间隔,直至满足停止条件(如连续空轮次达上限)。轮询/等待 SHALL 可注入(clock/sleep)以确定性测试。

#### Scenario: 持续消费新入队
- **WHEN** 守护运行期间陆续有新 job 入队
- **THEN** 每轮 drain 消费当轮队列,批后集成,空轮达停止上限后退出

#### Scenario: 空队列即停
- **WHEN** 启动时队列为空且无新入队,达连续空轮上限
- **THEN** 守护退出,不无限空转
