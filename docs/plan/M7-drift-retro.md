# 复盘 · M7 drift 监控首切片：工具序列一致性 sensor（M7-a）

> 日期 2026-06-25 · change `pipeline-drift-toolseq-sensor` · 新 capability `drift-monitor`
> M7 = 项目**根命题**(agent drift = 单步误差长链路复利累积,整个 harness 对抗的根本)。V4 §6 / D5。

## KB 接地（强制,先查再决策）

按 CLAUDE.md「AI 开发领域决策前必须查 KB」,先读 KB 权威页再设计:
- `[[topics/agent-drift]]` + `[[sources/arxiv-agent-drift-2026]]`(arXiv:2601.04170,Rath 2026)。
- **ASI(Agent Stability Index)**:12 维复合度量,4 类加权——Response Consistency 0.30 / Tool Usage 0.25 / Inter-Agent Coordination 0.25 / Behavioral Boundaries 0.20;滚动 50 交互窗口;**τ=0.75 连续三窗触发**。
- **drift 三型**:Semantic(embedding cosine)/ Coordination(共识率/handoff/role adherence)/ Behavioral(**Tool Sequencing Consistency=Levenshtein** / 错误模式聚类 / Human Intervention Rate=「终极 drift indicator」)。
- **进展规律**:~200 交互后 coordination robust→brittle;成功率 87.3%→50.6%(-42%)、人工干预 +216%、agent 冲突 +487%。
- 阈值/窗口/Levenshtein 法**均取自 KB**,非训练数据(求真)。

## 做了什么

挑 ASI 里**最可确定性/离线/已可从现有 `events.jsonl` 算**的信号——Tool Sequencing Consistency——建 sensor + 滚动窗口告警框架。

- 纯 `opSequence(events, traceId)`:按 ts 取一个 US 的 op token 序列(token=`phase:<role>`|op)。
- 纯 `levenshtein(a,b)`(token 数组编辑距离,DP)+ `seqConsistency(a,b)=1-dist/max(len)`∈[0,1]。
- 纯 `driftAlert(series, τ=0.75, k=3)`:连续 k 个一致性<τ 即告警(KB 连续三窗),报首触发位;不足 k→不告警。
- 薄 `readDriftEvents`(读 events.jsonl 保 ts)+ `computeDrift`(按 US 分组→相对基线序列算一致性序列→告警;US 不足 k+1→`insufficient-data`)。

## 验证来源（可溯源）

- metrics gate 全绿:lint+tsc+**71 测试**(58→71,+13),**既有 58 零影响**。
- **合成验证**:基线 + 渐变漂移序列(一致性 1→0.667→0.333→0)→ 连续三窗<τ **正确告警**;稳定序列→不告警;US<4→insufficient-data。
- **真实 events.jsonl 诚实路径**:当前 0 事件(ephemeral/未长程)→ `computeDrift` 返回 `insufficient-data` 不告警——**机制不臆造未发生的 drift**。

## 贯穿洞察 / 设计哲学

- **把不确定性关在纯函数外**(同 M6-d):drift 信号本身要长程数据才显现,但 sensor 的**计算逻辑全是确定性纯函数**(Levenshtein/一致性/告警)——可穷尽单测。数据的「有没有/够不够」与逻辑的「对不对」分离。
- **"建机制 + 阈值待标定 + 无数据不告警"= 第三次复用「待埋点」哲学**(M4+ 待埋点 → NFR 待长程标定 → M7 insufficient-data)。**未做长程任务测试就没有 drift**,诚实标 insufficient-data,不臆造已发生 drift(红线1)。τ=0.75/k=3 用 KB 默认,真实数据来了再标定。
- **从窄到宽选信号**:ASI 12 维,先做纯/离线/已可算的(工具序列);需 embedding(语义)/多 agent(共识)的排后;缓解(EMC/ABA/DAR)/拓扑改造留最后。框架(滚动窗口+τ+连续 k 告警)建好可复用给后续 sensor。
- **KB 强制接地的价值**:ASI/EMC/ABA/DAR/τ 都是专有术语,凭记忆必臆造——先查 KB 把框架/阈值/方法论钉死,再落地。

## 固有限制 / 待后续

- **events.jsonl ephemeral** → drift 需长程序列,持久化/长程积累待后续(可接 ledger 类持久存储)。
- **op 序列粒度=phase/gate 级**,非 agent 内部 tool 调用(stream-json 未落 events);首切片用 phase/gate 级作 Tool Sequencing 代理,可后续细化。
- **fixed-baseline vs rolling-window**:首切片用首 US 作固定基线(可测可解释);随真实 drift 数据校验/切 rolling。
- **真 drift 信号待长程任务测试**:这是 M7 整体的前置——长程跑起来前,所有 drift sensor 都只能"建好机制 + 待数据"。

## M7 后续候选

M7-b 人工干预率 sensor(escalation/held 率,已有数据,KB「终极指标」)→ M7-c 语义相似度(需 embedding)→ M7-d 共识/协调(需多 agent)→ M7-e 复合 ASI(12 维加权汇总,纳入 §7)→ M7-f 缓解 EMC/ABA/DAR → M7-g 两级拓扑(router+specialists)。
