# inner-loop-orchestration Specification

## Purpose
TBD - created by archiving change 2026-06-18-pipeline-driver-inner-loop. Update Purpose after archive.
## Requirements
### Requirement: PEV 阶段链编排
driver SHALL 对一个 `kind='inner-loop'` 的 job,按 测试 → 开发 → 评审 的顺序串起 phase 链,每个角色 phase 经一次 `claude -p` 执行,**阶段之间由 driver 跑确定性 gate** 决定是否进入下一 phase。编排逻辑 MUST 是可注入替身的纯逻辑(claude 边界、gate、verdict 读取、时钟均注入),自身不直接做 IO。

#### Scenario: 全链 happy path
- **WHEN** 一个 inner-loop job 被处理,测试 phase 产出红测试、开发 phase 转绿、评审 verdict 无 must-fix
- **THEN** job 依次经过 测试→RED gate→开发→GREEN gate→评审,最终状态为 DONE,各 phase 转移被记录

#### Scenario: 某 phase 的 claude 调用失败
- **WHEN** 任一角色 phase 的 `claude -p` 以非 0 退出码结束
- **THEN** job 标记为 failed,记录该 phase 的 trace 与退出码,不继续后续 phase

### Requirement: RED gate——测试必须先红
开发 phase 之前,driver SHALL 校验测试 phase 产出的测试**存在且失败**(失败原因是被测实现缺失,而非测试自身写错)。测试未失败时 MUST 不进入开发 phase,而是升级。

#### Scenario: 测试如期变红
- **WHEN** 测试 phase 写出测试,运行测试套件失败(实现缺失)
- **THEN** RED gate 通过,进入开发 phase

#### Scenario: 测试没有失败
- **WHEN** 测试 phase 后运行测试套件并未失败(测试 agent 越界写了实现,或测试本身无效)
- **THEN** RED gate 不通过,不进入开发 phase,升级为需人工/上游处置,记录原因

### Requirement: GREEN gate 与变异门
开发 phase 之后,driver SHALL 跑确定性 GREEN gate(lint + 类型检查 + 测试套件全绿)。job 进入 DONE 之前,变异门 MUST 至少达标一次(末轮必跑);为控成本,中间回修轮 MAY 跳过变异门。GREEN gate 不通过时进入回修。

#### Scenario: 实现转绿且变异门达标
- **WHEN** 开发 phase 后 lint/类型/测试全绿,且变异门存活率达到阈值
- **THEN** 进入评审 phase

#### Scenario: GREEN gate 不通过
- **WHEN** 开发 phase 后测试或 lint 或类型检查未通过
- **THEN** 不进入评审,转入回修(归属开发域)

### Requirement: 结构化 verdict 确定性裁决
评审 phase SHALL 产出固定 schema 的结构化 verdict 文件:`{decision, mustFix: [{域, desc, file?}], niceToHave}`。driver SHALL 仅依据该结构化字段裁决(must-fix 是否为空、各项归属域),MUST NOT 依赖对模型自由文本的解析。

#### Scenario: verdict 无 must-fix
- **WHEN** 评审 phase 产出的 verdict 中 mustFix 为空
- **THEN** job 进入 DONE

#### Scenario: verdict 含 must-fix
- **WHEN** 评审 phase 产出的 verdict 中 mustFix 非空
- **THEN** 转入回修,逐条 must-fix 按其归属域路由

### Requirement: 热上下文回修与域归属路由
must-fix 回修 SHALL 按归属域续接对应角色的会话:实现 bug 路由回**开发**角色,测试缺口路由回**测试**角色。driver SHALL 优先用 `claude -p --resume <对应角色 sessionId>` 注入 must-fix(热上下文续接);当目标 session 不可 resume 时,MUST 回退为携带规约 + 当前代码上下文 + must-fix 的全新 spawn。

#### Scenario: 实现 bug 回修
- **WHEN** 一条 must-fix 归属为实现 bug
- **THEN** driver resume 开发角色的 session 并注入该 must-fix,开发角色带原推理做补丁

#### Scenario: 测试缺口回修
- **WHEN** 一条 must-fix 归属为测试缺口
- **THEN** driver resume 测试角色的 session 并注入该 must-fix(开发角色不得改测试)

#### Scenario: session 不可 resume 回退
- **WHEN** 目标角色 session 已过期或无法 resume
- **THEN** driver 回退为全新 `claude -p`,prompt 注入规约切片 + 读盘所得当前产物 + must-fix + 角色硬边界

### Requirement: 回修止损与升级
回修轮次 SHALL 受 `maxFixRounds` 上限约束。每轮回修后 MUST 重跑 GREEN gate 与评审。回修轮次达上限仍存在 must-fix 时,job MUST 进入 `blocked-escalated` 终态,记录残留 must-fix 与归属,阻塞升级人类,不静默放过。

#### Scenario: 回修后变干净
- **WHEN** 一轮回修后重跑评审,verdict 的 mustFix 变为空
- **THEN** job 进入 DONE,记录所用回修轮次

#### Scenario: 回修超限
- **WHEN** 回修轮次达到 maxFixRounds 仍有 must-fix 未解
- **THEN** job 进入 blocked-escalated,记录残留 must-fix + 归属域,升级人类裁决

### Requirement: phase trace 与 per-job 可观测
每个角色 phase SHALL 落结构化 trace(`stream-json --verbose` 逐行 JSONL),**包含 phase 内 claude 自主 spawn 的子 agent 的 spawn/工具调用/结果事件**。每个 inner-loop job SHALL 记录 per-job 运行状态:phase 转移、gate 结果、fixRound、各角色 sessionId、token usage 与 cost、trace 路径,供 M4 metrics 消费。

#### Scenario: phase 内自主 spawn 子 agent
- **WHEN** 某 phase 的 claude 在内部 spawn 了子 agent(如评审两遍)
- **THEN** 该 phase 的 trace 文件包含子 agent 的 spawn 与工具调用事件,可追溯

#### Scenario: 一次 inner-loop 完成后的可度量
- **WHEN** 一个 inner-loop job 跑完(DONE 或 blocked-escalated)
- **THEN** per-job 状态含全部 phase 转移、各 phase 的 usage/cost、回修轮次,可被 metrics 读取

### Requirement: 崩溃恢复——整链重跑
inner-loop job 在执行中途崩溃时,SHALL 能被恢复机制回收为 queued 并重新认领,重跑整条 phase 链。phase 对 repo 文件的写入 MUST 是幂等覆盖(重跑不产生损坏或叠加产物)。本能力不要求 mid-chain 精细断点续跑。

#### Scenario: 回修中途崩溃
- **WHEN** 一个 inner-loop job 在回修途中 worker 崩溃
- **THEN** 恢复后该 job 被回收为 queued,可重新认领并从头重跑整链,不残留半成品破坏既有产物

### Requirement: 瞬时 API 错误判别
系统 SHALL 提供纯判别:给定 phase 结果文本,识别其是否为**瞬时基础设施错误**(如 socket/连接断开、超时、overloaded、rate limit、5xx、closed unexpectedly)。判别 MUST 不把普通失败(测试断言失败、实现错误等无瞬时信号的文本)误判为瞬时。

#### Scenario: 识别瞬时错误
- **WHEN** 结果文本为 "API Error: The socket connection was closed unexpectedly"
- **THEN** 判为瞬时(可重试)

#### Scenario: 不误判普通失败
- **WHEN** 结果文本为普通失败描述(无瞬时信号)
- **THEN** 判为非瞬时(不重试)

### Requirement: phase 瞬时错误有限重试
新会话 phase 遇瞬时 API 错误时,系统 SHALL 有限重试(上限可配,默认 2)并在重试间退避;**每次重试使用全新 session-id**(避免同 id 残留冲突)。非瞬时错误 SHALL NOT 重试。重试耗尽仍错误则按失败处置。

#### Scenario: 瞬时错误后重试成功
- **WHEN** 某 phase 首次返回瞬时错误、重试返回成功
- **THEN** 该 phase 视为成功,且重试用了不同的 session-id

#### Scenario: 非瞬时错误不重试
- **WHEN** 某 phase 返回非瞬时错误
- **THEN** 不重试,直接按失败处置

#### Scenario: 重试耗尽仍瞬时错误
- **WHEN** 瞬时错误持续超过重试上限
- **THEN** 按失败处置(exitCode 非 0),不无限重试

### Requirement: orchestrator 域确定性代修
评审产出的 must-fix 可标 `orchestrator` 域并携带白名单结构化 `action`(首类 `register-mutation-target`:把本切片新交付的纯逻辑文件登记进产品 stryker.conf 的 mutate 列表,使其在交付后获得持续变异覆盖)。inner-loop 遇 orchestrator 域 must-fix 时 SHALL 调用注入的**确定性代修器**(非 agent——改门禁配置不在 test/dev 授权边界,红线4 角色不混同);代修成功则继续回修循环(SHALL 重跑 gate + review 确认 must-fix 已闭环);代修失败、`action` 不在白名单、或未注入该能力时 SHALL `blocked-escalated`(红线6 阻塞升级,**不静默吞**),residual 保留该 must-fix。代修 SHALL 白名单驱动、确定性、可审计(对冲自演进 harness 回归不可预见的风险)。

#### Scenario: orchestrator 代修成功后继续并收敛
- **WHEN** review 标 orchestrator 域 + `register-mutation-target` action,且代修器成功登记文件进 stryker.conf
- **THEN** 继续回修循环,下一轮 review 复审确认 must-fix 已闭环 → done;登记改动随动态 squash 一并交付

#### Scenario: 不识别的 action 或无能力即升级
- **WHEN** orchestrator 域 must-fix 的 action 不在白名单(或无 action,或未注入 orchestratorFix 能力)
- **THEN** blocked-escalated,residual 保留该 must-fix(不静默吞、不让 agent 越权代劳)

#### Scenario: orchestrator 域 must-fix 仅由评审提出
- **WHEN** must-fix 为 orchestrator 域
- **THEN** 其来源为 review verdict(GREEN gate / 变异门内部产生的 must-fix 只归 impl/test 域,不会冒充 orchestrator 域,防逃逸阀)

### Requirement: squash 提交持久化 caught 缺陷
系统 SHALL 在 done run squash 出 feature 分支时,在 squash 提交消息追加机器写的 trailer,使该 run 的可观测指标随提交持久进 git:(a) 据 `fixRounds` 追加 `Defect-Caught: inner-loop 回修轮 <k>`(每回修轮一行,fixRounds=0 不追加);(b) 据本 run 各阶段耗时追加一行 `Metrics-Phase-Ms: <cat>=<ms> ...`(原始 op 分类耗时:dev/test/review/gate/orchestrator-fix,仅非零项;**不应用 impl/verif 口径**,口径归 metrics)。trailer 由系统写入,供 metrics 与 escaped 同口径挖采、并据以复现 Verification Tax。

#### Scenario: 有回修轮 → 追加 Defect-Caught
- **WHEN** 一个 done run 的 `fixRounds=2` 触发 squash
- **THEN** squash 提交消息含 2 行 `Defect-Caught: inner-loop 回修轮 1`/`... 回修轮 2`

#### Scenario: 据阶段耗时追加 Metrics-Phase-Ms
- **WHEN** 一个 done run 各阶段耗时为 dev=95000、test=113000、gate=12000(review/orchestrator-fix=0)
- **THEN** squash 提交消息含一行 `Metrics-Phase-Ms: dev=95000 test=113000 gate=12000`(仅非零项,原始 op 分类、不预算 impl/verif)

#### Scenario: 干净 run → 无 Defect-Caught 但仍有 Metrics-Phase-Ms
- **WHEN** 一个 done run `fixRounds=0` 但有 dev/test 阶段耗时
- **THEN** 无 `Defect-Caught:` 行,但有 `Metrics-Phase-Ms:` 行(VTax 不依赖缺陷,每 done run 都持久阶段耗时)

#### Scenario: escalated run 不持久
- **WHEN** 一个 run 状态为 `blocked-escalated`(不 squash、无提交)
- **THEN** 不产生任何 trailer(其 caught 与 VTax 不持久,为已知边界)

