## Context

VTax 仍 ephemeral:从 `.runtime/events.jsonl`(gitignored)派生,清空即"待埋点",fresh checkout 不可复现。续切片④ 证明"指标走 squash trailer 持久化 + git 挖采"可行。本切片把 VTax 纳入同机制,收尾 M4+ 可观测主体。

已确认:`runInnerLoopJob` 把事件落中心 `<pipeline>/.runtime/events.jsonl`(traceId=jobId);`runIsolated`(做 squash)有 `deps.repoRoot` 可读回该中心日志,按 jobId 过滤聚合。只 done run 走 squash。

## Goals / Non-Goals

**Goals:**
- VTax 持久进 git(随 done-run squash 提交的 `Metrics-Phase-Ms:` trailer)、可从 git 复现。
- **口径单一真相源**:driver 只报原始 op 分类耗时(机械事实),metrics 保留 D1 口径(impl/verif 解释权);复用既有 categorizeDuration/taxByTrace,零口径重写。
- 延续切片④ trailer 模式与 mineTrailers 基建。

**Non-Goals:**
- 不持久 escalated/failed run 指标(无提交)。
- 不持久 inner-loop 升级率/成本(需 ledger,另立)。
- 不回溯历史已合并 done run 补 trailer。
- 不改 D1 口径本身、不改 events.jsonl 的 live 用途(replay 仍用)。

## Decisions

**D1:trailer 写原始 op 分类耗时(choice A,用户确认)。**
- `Metrics-Phase-Ms: dev=95000 test=113000 review=476000 gate=12000 orchestrator-fix=5000`(仅非零)。driver **不**预算 impl/verif。
- *理由*:口径(哪类算验证)是度量定义,属 metrics;trailer 存未定性的原始事实 → 改口径时历史 trailer 自动按新口径重算、跨包契约纯数据无语义、metrics 直接复用 categorizeDuration。choice B(driver 预算 impl/verif)会把口径焊进历史 trailer 且复制口径到两包,弃。

**D2:driver 聚合 = 纯函数 + 注入读取。**
- 纯 `aggregatePhaseMs(events, jobId): Record<string,number>`——过滤 traceId=jobId,按 `op==='phase'?phase:op` 分类累加 durationMs。
- `runIsolated` 加注入 dep `readPhaseMs?: (jobId)=>Record<string,number>`,默认实现读 `join(repoRoot,'pipeline','.runtime','events.jsonl')` + aggregatePhaseMs;测试注入假值。squash 前算好传 `squashMessage`。
- `squashMessage(jobId, fixRounds, phaseMs?)`:在 Defect-Caught 块后追加 `Metrics-Phase-Ms:` 行(phaseMs 非空且有非零项时)。

**D3:metrics 换源 + 复用口径。**
- `mineTrailers(repoRoot,'Metrics-Phase-Ms')` 挖采(切片④ 基建)。
- 纯 `parsePhaseMsTrailer(desc): TaxEvent[]`——`<cat>=<ms>` 解析 → 还原最小事件(cat∈{dev,test,review}→`{op:'phase',phase:cat}`;gate/orchestrator-fix→`{op:cat}`),畸形跳过。
- per-US:每个 commit 一个 US,按 commit 短 hash 分组 → 复用 `taxByTrace`(把 commit 当 traceId)。聚合复用 `categorizeDuration`。
- `collect.ts`:VTax 不再读 events.jsonl,改 `mineTrailers` → parse → categorize/taxByTrace。

**D4:per-US 键 = commit 短 hash(choice 2,推荐)。**
- mineTrailers 返回 {commit,desc};jobId 在标题但挖采不取标题。commit hash 稳定可溯源,够用。

## Risks / Trade-offs

- [只 done-run VTax 持久,escalated 不持久] → 已知边界(同 Defect-Caught);escalated 未交付,其 tax 部分无意义。标注。
- [历史已合并 done run 无 trailer→VTax 不可重建] → 接受;此后每 done 持久,逐步积累。同切片②/④ 同类诚实限制。
- [读中心 events.jsonl 并发:多 run 并行写同一文件] → 按 traceId 过滤隔离本 run;append-only 行级,读时容忍尾部不完整行(跳畸形)。
- [driver aggregatePhaseMs 与 metrics categorize 看似重叠] → 不重叠:driver 只按 op 机械分桶(无 impl/verif 判断),metrics 才映射口径。职责清晰。

## Open Questions

- 无(机制、choice A、commit 键均经 brainstorm 与用户确认)。
