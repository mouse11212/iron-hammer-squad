# 设计：driver 自动驱动多角色内循环(PEV 链)

> 日期 2026-06-18 · 状态:已与 BOSS 对齐(brainstorm),待 OpenSpec 规约化 · 作者:铁锤小队 orchestrator
> 关联:V4 §4.2/§4.6、backlog ① Loop、`pipeline/driver/`、`pipeline/workflows/orchestration-pwj.md`、D9 决策
> KB grounding:`topics/{pev-loop, orchestrator-patterns, loop-engineering, agent-drift}`(2026-06-18 查)

## 0. 目标(一句话)

把多角色全流程(测试→开发→评审×2→回修)从**人工剧本**变成 **driver 自动驱动**:事件到达 → driver 按 PEV 串起整条内循环,阶段间确定性 gate,phase 内允许 claude 自主 spawn 但全程落盘,must-fix 自动回修闭环(带止损),全程可观测可度量。

取代现状:`drive-parallel.ts` 的 worker 对每个 job 只 `invoke(prompt)` 跑一次 claude。

## 1. 已锁定的设计岔路(brainstorm 决议)

| # | 岔路 | 决议 | 依据 |
|---|---|---|---|
| D-a | 编排器放哪层 | **混合**:driver 当高层状态机 + 阶段间确定性 gate;phase 内允许 claude 自主 spawn,**但必须全程 stream-json 落盘**(可观测硬约束) | BOSS 选;PEV 反对把验证退化成 post-hoc 自查 |
| D-b | 第一切片范围 | **全链含自动回修闭环**(测试→开发→评审→must-fix 回修↺) | BOSS 选 |
| D-c | 验证载体 | **fincards 上选/造一个小 US** 跑真实端到端 | 方案 A 边验证边抽取 |
| D-d | must-fix 回修机制 | **热上下文 resume**(spike 已验证可行),fresh spawn 降为回退 | 见 §4 spike |
| D-e | 回修止损 | `maxFixRounds=2`,超限→`blocked-escalated` 阻塞升级人类 | 对抗 agent-drift;红线 6 |
| D-f | 评审→driver 交接 | 结构化 verdict JSON 文件,driver 确定性读取(不解析自由文本) | 确定性 gate |
| D-g | 角色间交接 | 共享 repo 文件系统(测试 agent 写 `test/`→开发 agent 读盘) | orchestrator-patterns:teammates 靠 spawn prompt + 外部状态,不继承对话 |
| D-h | 崩溃恢复 | 整链重跑(phase 对 repo 文件幂等覆盖);**第一切片不做 mid-chain 精细恢复** | start narrow |

## 2. 架构:PEV 状态机

driver 当高层状态机,按 Plan-Execute-Verify 把一个 US 串成 phase 链。每个角色 phase 发一次 `claude -p`;phase 之间由 TS 跑确定性 gate。

```
PLAN(driver 确定性,无 claude:据 job 组装上下文/路径)
  → TEST phase(claude:测试 agent,记 testSessionId)
      → [RED gate: 测试文件存在 且 npm test 失败(因实现缺失,非测试写错)]
  → DEV phase(claude:开发 agent,记 devSessionId)
      → [GREEN gate: lint + tsc + npm test 全绿]
      → [变异门: stryker 存活率 ≥ 阈值]
  → REVIEW phase(claude:评审两遍,phase 内可并行;产出 verdict.json)
      → [读 verdict: {decision, mustFix:[{域,desc,file?}], niceToHave}]
  → 裁决:
      mustFix 空                         → DONE
      mustFix 非空 且 fixRound < 上限     → 按域 resume(devSessionId/testSessionId)注入 must-fix → 回 GREEN gate ↺
      mustFix 非空 且 fixRound ≥ 上限     → BLOCKED-ESCALATED(记 must-fix + 归属,升级人类)
  phase 非 0 退出 / gate 异常             → FAILED(记 trace)
```

状态映射 PEV:Plan=driver 组装(减自由度)· Execute=TEST/DEV phase · Verify=RED/GREEN/变异门/评审(pre+runtime+post+plan-alignment 四时点,非 post-hoc)。

## 3. 组件与边界(每个一职责,可独立测试)

| 组件 | 文件 | 职责 | 注入替身 |
|---|---|---|---|
| **inner-loop 编排器** | `driver/src/inner-loop.ts`(新) | 纯编排逻辑 `runInnerLoop(job, deps)`:跑 PEV 链 + 回修止损 + 状态转移。自身不做 IO | 全部 deps 注入 |
| **phase 边界** | `driver/src/invoke.ts` 扩展 `makePhaseInvoke` | `claude -p --output-format json`(拿 session_id/usage/result)+ 可选 `stream-json --verbose` 落 trace;支持 `--session-id`/`--resume` | — |
| **gate runner** | `driver/src/gates.ts`(新) | `runRedGate`/`runGreenGate`/`runMutationGate`(跑 npm test/lint/tsc/stryker,判定布尔 + 摘要) | ✅ |
| **verdict reader** | `driver/src/verdict.ts`(新) | 读评审产出的 verdict JSON,校验 schema,返回 `{decision, mustFix[], niceToHave}` | ✅ |
| **prompt builder** | `driver/src/prompts.ts`(新) | 由 `roles/*.md` + `guides/agent-conventions.md` + US 上下文(spec 切片/目标路径)合成 spawn prompt;回修时附 must-fix | — |
| **per-job run-state** | `.runtime/runs/<jobId>/state.json` + trace 目录 | phase 转移 + 时间戳 + gate 结果 + fixRound + sessionId + usage + trace 路径 | — |
| **worker dispatch** | `drive-parallel.ts` 改 | `job.kind==='inner-loop'→runInnerLoop`;否则 `invoke`(向后兼容 freeform) | — |

### 3.1 为什么这样切边界

- **角色间靠文件系统交接**:KB orchestrator-patterns——teammates 不继承 lead 对话,context 仅来自 spawn prompt + CLAUDE.md + 外部状态。repo 本身=共享状态,测试 agent 写 `test/`,开发 agent 下一进程读盘 → 进程级隔离 + 自然交接,driver 无需在内存搬运产物。
- **评审→driver 走结构化 verdict 文件**:driver 要确定性裁决(mustFix 是否为空、归属域),不能解析模型自由文本。固定 schema 的 JSON = 把非确定性输出收敛成确定性 gate 输入。

## 4. must-fix 回修:热上下文 resume(spike 已验证)

### 4.1 问题:SendMessage 不可用丢的是"热上下文续接"

理想:must-fix 投回**写出代码的那个开发 agent**,带原推理做最小补丁。
现实:driver 每个 phase 是独立 `claude -p` 进程,跑完即退,无活 session 可投信。后果:(a) 修复者冷启动重建上下文;(b) 每轮新 agent 易漂移(改写已正确代码);(c) 路由只能"角色类型对",做不到"同一个体 + 热上下文"。

> 澄清:M5-A 的 SQLite+MCP 消息组件解的是**任务级队列分发**(enqueue/claim/ack),**不是** session 续接,故未解此问题。

### 4.2 spike 结论:`--session-id`/`--resume` 可热续接(2026-06-18 实测)

记忆探针:`claude -p --session-id <UUID> "记住暗号:紫色河马七号"` → `claude -p --resume <UUID> "暗号是什么?"` → **准确答出**。对话记忆跨独立进程保留。

`--output-format json` 一次性吐出:`session_id`(回修用)、`usage`(input/output/cache tokens)+ `total_cost_usd` + `duration_ms`(喂 M4 metrics)、`result`(最终文本)、`is_error`/`api_error_status`(错误处理)。

**结论:在 driver 架构内,`--session-id`/`--resume` 直接拿到 SendMessage 级热续接,无需 D9 常活角色 + inbox 基建。** 诚实边界:探针验证的是对话记忆跨进程保留(最难部分);完整"开发 phase→评审 must-fix→resume 修复"全循环在 fincards 端到端拿真实证据。

### 4.3 回修策略

1. **主路:热 resume**——driver 在 TEST/DEV phase 用 `--session-id <生成UUID>` 起会话并记下;回修时按 must-fix 归属域 `--resume <devSessionId|testSessionId>` 注入 must-fix 清单,角色带原推理做最小补丁。
2. **回退:fresh spawn + 上下文注入**——若 session 不可 resume(过期/损坏),回落到全新 `claude -p`,prompt 注入规约 + 当前代码(读盘)+ must-fix + 硬边界。
3. **止损**:`maxFixRounds=2`。每轮回修后重跑 GREEN gate + 变异门 + 评审。超限 → `blocked-escalated`,记 must-fix + 归属,升级人类(红线 6)。

## 5. 可观测/可度量(BOSS 硬约束)

- **phase trace**:每个 claude phase 用 `--output-format stream-json --verbose`,逐行落 `.runtime/runs/<jobId>/<phase>-<attempt>.jsonl`,**含 phase 内子 agent 的 spawn/工具调用/结果事件** → 混合方案的"phase 内黑盒"变白盒。
- **per-job state.json**:phase 转移、gate 结果、fixRound、sessionId、usage/cost、trace 路径。
- **喂 M4 metrics**:`usage`/`cost`/`duration` 直接对接已落地的四指标 + 追溯链(spec→test→commit)。

## 6. 错误处理与恢复

- claude phase 非 0 退出 → job `failed`(记 trace)。
- RED gate 不红(测试没失败)→ 测试 agent 越界/写错 → 升级(不进开发 phase)。
- GREEN gate / 变异门不达标 → 进回修 loop(归属:GREEN→开发;变异门→测试缺口或开发)。
- worker 崩溃 → `recover()` 重置 job 为 queued → **整链重跑**(phase 对 repo 文件幂等覆盖)。第一切片不做 mid-chain 精细恢复。

## 7. TDD 与验证(项目纪律)

- 纯编排 `runInnerLoop` 用注入替身做**确定性测试**,覆盖:
  - happy path(测试红→开发绿→评审过→DONE)
  - RED 不红 → 升级,不进开发
  - GREEN 失败 → 回修 → 通过
  - 评审 must-fix → resume 回修 → 干净 → DONE
  - 回修超限 → blocked-escalated
  - phase 非 0 → failed
  - 域归属路由(实现 bug→devSessionId;测试缺口→testSessionId)
- IO 边界(真 claude/真 gate/真 fs)隔离到薄边界,少量集成测试。
- 纯逻辑纳入变异门。
- **端到端**:fincards 选/造一个小 US 跑真实全流程,产出真实基线(回修轮次分布、回修后 gate 通过率、超限升级率)——不编数字。

## 8. 抽取线(方案 A)

fincards 验证通过后,抽 inner-loop 编排能力进 `pipeline/`:更新 `pipeline/workflows/orchestration-pwj.md` 的"驱动方式"段(现已注明"下一步:把 driver 单步执行接到本剧本全流程"),标验证来源。抽取≠冻结,随后续验证修正。

## 9. 风险与未决

- **回修 drift**:热 resume 降低单轮误差,但跨多文件/意图密集 must-fix 仍可能被误改;靠止损 + 每轮 gate/评审捕获。监控点已埋(§7 基线)。
- **session 过期窗口**:`--resume` 对长时间挂起的 job 可能失效 → 回退 fresh spawn 已覆盖。
- **变异门成本**:每轮回修跑 stryker 较慢;第一切片可先只在最终轮跑变异门(GREEN gate 每轮跑),待基线评估再定。**(规约化时确认此项)**
- **并发 × resume**:多 worker 并行各 resume 不同 session,session id 为键应隔离;压测留意。

## 10. 不变量(沿用内循环剧本)

- 写测试 ≠ 写实现(进程级上下文隔离,物理坐实)。
- 确定性逻辑可测;网络/时钟/随机隔离到边界。
- 失败路径不破坏既有产物(M2-A 教训)。
- 人类门禁不可绕过:blocked-escalated 必须人类裁决。
