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
inner-loop 结果为 `done` 时,系统 SHALL 把该切片改动在 feature 分支提交为**单个** commit;改动范围 SHALL 据 `git status --porcelain` **动态捕获**实际改动(不限扩展名/目录、含删除),**不依赖外部预先声明的 targetPaths**——预测错路径/命名会静默丢弃 done 的成果——也不盲加 `-A`。捕获 SHALL 排除依赖软链(linkDeps 创建的 node_modules symlink 等非切片产物,避免污染交付物为指向本机绝对路径的不可移植 symlink)。结果非 `done`(failed/blocked-escalated)时 SHALL NOT 提交;无改动时不空提交。

#### Scenario: done 后单提交(动态捕获实际改动)
- **WHEN** 隔离 inner-loop 结果为 done,agent 在 worktree 内创建/修改了文件(无论写在 src/ 或 test/、何种命名)
- **THEN** feature 分支多出且仅多出一个 commit,包含据 git status 捕获的全部切片改动(不要求调用方预先声明路径)

#### Scenario: 排除依赖软链
- **WHEN** worktree 工程内含 linkDeps 创建的 node_modules symlink(因 .gitignore 带尾斜杠只匹配目录而被 porcelain 列出)
- **THEN** squash 不捕获 node_modules,交付物只含切片产物

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

### Requirement: 集成分支跨批次累积
batchIntegrate SHALL 把 integration 分支当作跨批次累积的暂存区:当 integration 分支**不存在**时从 base 创建;当其**已存在**时复用(checkout 已累积分支,**不重置到 base**),在其之上合入本批 feature。使多轮/多批的已验证 feature 持续累积,不被后批覆盖。

#### Scenario: 首批从 base 创建
- **WHEN** integration 分支尚不存在,batchIntegrate 处理第一批 feature
- **THEN** 从 base 创建 integration 并合入本批 clean+green 的 feature

#### Scenario: 后批在已有 integration 上累积
- **WHEN** integration 分支已存在(含前批合入的 feature),batchIntegrate 处理新一批
- **THEN** 复用现有 integration(不重置到 base),把新批 feature 合到其上;前批已合入的 feature 仍在

### Requirement: 累积态下的冲突处置
新批 feature 与**已累积**内容冲突时,SHALL 沿用 per-feature 回滚(reset 到合前 HEAD)+ held 升级,不影响已累积内容与其它 feature。

#### Scenario: 新批 feature 冲突于已累积内容
- **WHEN** 新批某 feature 与 integration 已累积的内容冲突
- **THEN** 该 feature 回滚 held(conflict),integration 保留既有累积内容,其它新 feature 照常合入

### Requirement: 集成 gate 按 feature 所属项目动态推导
批后集成的 per-feature gate SHALL 在**该 feature 所属 job 的项目目录**内运行(green + 依赖软链),而非整批共用一个固定目录。系统 SHALL 据各 job 的 spec.projectDir 推导 `branch → 项目目录` 映射,gate 时按当前 feature 的分支路由到对应目录。

#### Scenario: 单项目批(回归)
- **WHEN** 一批 feature 同属一个项目
- **THEN** 每个 feature 的集成 gate 在该项目目录跑,行为与此前一致

#### Scenario: 多项目混批
- **WHEN** 一批含分属不同项目的 feature(如 A→项目甲、B→项目乙)
- **THEN** A 的集成 gate 在项目甲目录跑、B 的在项目乙目录跑,各自在自己项目内被验证,不互相错用目录

### Requirement: gatePerFeature 携带分支标识
batchIntegrate 调用 gate 时 SHALL 传入当前 feature 的分支标识,使调用方能据此路由(项目目录等)。

#### Scenario: gate 收到分支
- **WHEN** batchIntegrate 对某 feature 分支跑集成 gate
- **THEN** gate 收到该分支标识

### Requirement: 集成交接报告(HITL)
批后集成完成后,系统 SHALL 产出一份 durable、人类可执行的集成交接报告,内容包含:已集成待合 main 的 feature 清单与建议的 squash 合并命令(人类执行)、挂起(held)的 feature 及其原因与处理指引、整体状态(全 ready / 部分挂起)。报告 SHALL 明确合并 main 是人类决策(军规 1/2),不自动合并。

#### Scenario: 全部已集成
- **WHEN** 批后集成 ready(held 空、merged 非空)
- **THEN** 报告列出 merged feature + 建议的人类 squash 合并命令,标注状态为可合 main

#### Scenario: 部分挂起
- **WHEN** 集成结果含 held(冲突/gate)
- **THEN** 报告分别列出已集成与挂起项;每个挂起项注明原因(conflict/gate)与处理指引;状态为部分挂起

#### Scenario: 本批无成功 feature
- **WHEN** 无 committed 分支(integration 为空)
- **THEN** 报告说明本批无集成产出

### Requirement: 交接产出可观测
drainBatchIsolated SHALL 在批后集成完成后调用交接钩子(产出报告 + 摘要),使结果 durable 落地而非仅内存返回。

#### Scenario: 集成后触发交接
- **WHEN** drainBatchIsolated 完成一批集成
- **THEN** 交接钩子被调用并收到该批集成结果的报告

### Requirement: 敏感改动集成时 held 升级人签
系统 SHALL 在批量集成时支持**可选注入**敏感改动检查:合某 feature 前对其改动路径分类,命中敏感面(鉴权/CI/基础设施)则将该 feature 标为 held(`reason='sensitive'`,带命中 `categories`)**不自动合**,路由人签(红线7 人类门禁不可绕过、军规7、D1);该 feature 工作保留为分支,人类签字后手动合。**不注入检查则批量集成行为与既有完全一致**(向后兼容)。与冲突/gate held 互不影响、可并存。

#### Scenario: 未注入检查 → 行为照旧
- **WHEN** 批量集成未注入敏感检查
- **THEN** 仅按 clean+green/冲突/gate 红判定,held reason 仅 conflict|gate(既有行为零变化)

#### Scenario: 注入且 feature 触及敏感面 → held(sensitive) 不自动合
- **WHEN** 注入检查,某 feature 改动含 `.github/workflows/x.yml`
- **THEN** 该 feature held(reason='sensitive',含 ci 类别),不并入 integration、不触 merge,路由人签

#### Scenario: 注入但 feature 仅普通源码 → 照常合入
- **WHEN** 注入检查,feature 仅改 `src/*.ts`(clean+green)
- **THEN** 正常合入 merged(敏感不命中,交付不受影响)

#### Scenario: 敏感 held 与 conflict/gate held 并存
- **WHEN** 一批中 a 触及敏感面、b 冲突、c 干净普通
- **THEN** a held(sensitive)、b held(conflict)、c merged;main 不动

