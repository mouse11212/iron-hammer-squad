## ADDED Requirements

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
