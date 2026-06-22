# worktree-integration Specification

## Purpose
TBD - created by archiving change 2026-06-22-pipeline-m5b-worktree-integration. Update Purpose after archive.
## Requirements
### Requirement: worktree 隔离创建
对一个隔离 inner-loop job,系统 SHALL 从指定 base ref 创建一个独立 git worktree 与专属 feature 分支(命名 `agent/<jobId>`),与主检出共享同一 `.git`。worktree 路径 SHALL 在运行时目录下(可回收),不污染主检出。

#### Scenario: 创建隔离 worktree
- **WHEN** 为 job `j1` 发起隔离执行,base 为 main
- **THEN** 在运行时目录创建 worktree 并建分支 `agent/j1`(自 main),主检出当前分支/工作区不受影响

### Requirement: 依赖软链入 worktree
因 worktree 为仓库级检出而 `node_modules` 被 gitignore(不随检出),系统 SHALL 在 worktree 内被测工程目录下创建指向主检出 `node_modules` 的符号链接,使 worktree 内的 gates(lint/类型/测试/变异)可运行。

#### Scenario: 软链依赖
- **WHEN** worktree 创建后准备运行 inner-loop
- **THEN** worktree 内被测工程目录的 `node_modules` 软链到主检出的 `node_modules`,gates 在 worktree 内可正常解析依赖

### Requirement: inner-loop 在 worktree 内执行
隔离执行 SHALL 让 inner-loop 的 projectDir 指向 worktree 内的被测工程子路径,使测试/开发 agent 的所有文件写入发生在该 worktree,而非主检出或其它 job 的 worktree。

#### Scenario: 隔离执行
- **WHEN** 两个隔离 job 并发执行
- **THEN** 各自的文件写入隔离在各自 worktree,互不覆盖

### Requirement: 成功后 squash 提交
inner-loop 结果为 `done` 时,系统 SHALL 把该切片改动(限定其 targetPaths,不盲加)在 feature 分支提交为**单个** commit;结果非 `done`(failed/blocked-escalated)时 SHALL NOT 提交。

#### Scenario: done 后单提交
- **WHEN** 隔离 inner-loop 结果为 done
- **THEN** feature 分支多出且仅多出一个包含切片改动的 commit

#### Scenario: 非 done 不提交
- **WHEN** 隔离 inner-loop 结果为 failed 或 blocked-escalated
- **THEN** feature 分支无新提交,改动不进入集成

### Requirement: 集成分支兜底
系统 SHALL 把 feature 分支以 squash 方式合并进 `integration` 分支(在独立 integration worktree 内操作,不切换主检出 HEAD),随后在 integration 上跑集成 gate;集成 gate 全绿才视为可推进,**不全绿则停止推进**(兜底:不让未验证改动接近 main)。

#### Scenario: 集成全绿
- **WHEN** feature 分支 squash-merge 进 integration 且集成 gate 全绿
- **THEN** integration 分支处于"可供人类合 main"的就绪态

#### Scenario: 集成不全绿
- **WHEN** 集成 gate 未通过
- **THEN** 不推进到 main,记录失败原因,integration 保持上一就绪态(main 不受影响)

### Requirement: HITL main 边界
系统 SHALL NOT 自动把 integration 合并到 main(军规 1/2:合并是人类决策点,绝不直接动 main)。集成全绿后 SHALL 停下并产出可供人类签字合并的就绪信号。

#### Scenario: 停在 HITL
- **WHEN** 集成分支全绿就绪
- **THEN** 系统停止,不对 main 做任何写操作,产出"待人类合并"的状态供签字

### Requirement: worktree 回收
隔离执行结束后,系统 SHALL 回收 feature worktree(军规 3:完成且无未提交改动自动回收),不残留临时 worktree 目录。

#### Scenario: 回收
- **WHEN** 隔离执行结束(无论结果)
- **THEN** 该 job 的 feature worktree 被移除,主 `.git` 的 worktree 记录被清理

### Requirement: 批量多分支集成
系统 SHALL 支持把 N 个 feature 分支汇入集成分支:在独立 integration worktree(从 base 重置)内,依次对每个 feature 执行 squash-merge;clean-merge 且集成 gate 全绿的保留,其余回滚。全程不切换主检出 HEAD、不写 main。

#### Scenario: 多个无冲突 feature 全部合入
- **WHEN** 三个互不冲突的 feature 分支批量集成且各自集成 gate 全绿
- **THEN** integration 分支含三者(各一 squash commit),ready 为真,held 为空

### Requirement: 冲突不自动解决、回滚升级
merge 冲突的 feature,系统 SHALL 回滚该次合并(`reset --hard` 到合并前)并标记为 held(reason=conflict),**不自动解决冲突**(军规 1:代码归人),**不阻塞其它 feature** 继续集成。

#### Scenario: 某 feature 与已集成内容冲突
- **WHEN** 批量集成中某 feature 与先前已合入的 feature 冲突
- **THEN** 该 feature 被回滚并列入 held(reason=conflict),其余无冲突 feature 仍照常合入;integration 不残留冲突标记

### Requirement: 逐 feature 集成 gate
系统 SHALL 在每个 feature 合入后跑集成 gate;gate 不通过的 feature SHALL 回滚并标记 held(reason=gate),不污染 integration。

#### Scenario: 某 feature 合入后 gate 红
- **WHEN** 某 feature clean-merge 但集成 gate 未通过
- **THEN** 该 feature 被回滚并列入 held(reason=gate),integration 保持该 feature 合入前的状态

### Requirement: 部分推进与就绪信号
系统 SHALL 返回 `merged`(已合入分支)与 `held`(挂起分支及原因)。仅当 held 为空且 merged 非空时 ready 为真(可供人类合 main);held 非空时 SHALL 产出挂起清单供人类处理。系统 SHALL NOT 自动合并 integration 到 main。

#### Scenario: 部分合入
- **WHEN** 批量集成后部分 feature 合入、部分 held
- **THEN** ready 为假,merged 与 held 清单如实返回,main 无任何写操作

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

