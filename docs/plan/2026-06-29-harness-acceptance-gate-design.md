# Harness 杠杆2：epic 实现后验收关 · 设计

> 状态：设计已获 BOSS 批准（2026-06-29）。本文档为 spec，分两刀实现（2a 先、2b 后），终点是「epic 收口后可验合目的性、可升级、可全自动」的验收管道。
> 来源：词灵岛 issue#9（UI 无确定性功能门）+ issue#12（功能门验正确性、验不出合目的性）+ issue#13（评审缺「升级人类但不阻塞叶子」通道）。
> 上游：杠杆1（反目标→确定性测试）已交付，产 `DesignFindings{intentRestatement, antiGoals[{desc,testable}], failureModes[], suggestedAcceptance[]}`。杠杆1 消费 `testable=true` 反目标；**杠杆2 消费这份产物的另一半**：`testable=false` 反目标 + `suggestedAcceptance` + `failureModes`。
> 载体：`pipeline/`（harness）+ `iron-hammer-output/wordspirit`（三年级 epic 已收口，作真实验证数据源/视觉验收载体）。

## 1. Why

杠杆1 把 `testable` 反目标接成了实现**前**的确定性测试。但 `DesignFindings` 里还有一半天生**测不了**——非 testable 反目标（"对三年级是否连贯/是否有挫败感"）、`suggestedAcceptance`（用户视角"算成了"）、`failureModes`（用户会注意到的失败方式）。这些是"功能全对、目的没达成"的重灾区（issue#12），UI 级尤甚（issue#9 模式③无确定性门）。

杠杆2 在 **epic/可玩增量收口后**设一道验收关：把这半边产物聚合成结构化验收清单，用**视觉 agent（playwright）预核 + 人 verdict 复核**核对，三级 verdict 分流——**和杠杆1 同构的「默认人门、渐进可跳过→全自动」范式**（BOSS 裁定的最终全自动方向）。

**关键架构观察（对称性）**：同一份 `DesignFindings` 喂两个时点——`testable` → 杠杆1（实现前测试）、非 `testable`+验收建议 → 杠杆2（实现后验收）。`acceptance.ts` 的纯核几乎是 `design-findings.ts` 的镜像，复用既有严格校验/变异门范式，降低实现风险。

## 2. 终态管道（epic 收口后）

```
[杠杆1 扩] 每个 US 的 design-soundness 跑完 → 总是持久化 DesignFindings
                                            （现仅 block-hold 路径写 → 改成总写到已知位置）
                       ↓
epic 收口（人手动触发 bin-acceptance）
   → ① 聚合各 US persisted findings 的「非 testable 反目标 + suggestedAcceptance + failureModes」  [纯函数]
   → ② epic 级补一刀 design-soundness（注入整 epic 意图 + 可玩增量描述）产涌现验收点              [复用首切片 agent]
   → ③ 装配 AcceptanceChecklist（每项:来源US / desc / 怎么试 / 期望）                              [纯函数]
   → ④ acceptance-agent 用 playwright 逐项跑场景 + 截图/snapshot → 「证据 + 初判 verdict(三级) + 理由」 [视觉 agent]
   → ⑤ verdict 复核：block=人看证据拍板 / auto=agent 初判直采                                       [人门 / 渐进]
   → ⑥ 分流落账：blocker→升级人类裁决 · advise→归档不阻 · pass→放行                                 [三级分流]
```

**渐进自治**：`IH_ACCEPTANCE=off`(不跑) / `block`(默认，人复核 verdict) / `auto`(agent 初判直采，全自动)。默认 block——守红线3「从窄到宽」。同 `IH_DESIGN_REVIEW` 范式。

**触发**：人手动（epic 收口时人跑 `bin-acceptance`）。与外循环现状一致（issue#4 外循环刻意人在环未自动化），本杠杆不碰外循环自动化。

## 3. 决策记录（brainstorm 2026-06-29）

| 决策点 | 选定 | 理由 |
|---|---|---|
| 验收粒度/时点 | **epic/可玩增量收口后** | 「人工试玩」需可玩整体；与词灵岛 epic 收口实际节奏一致 |
| 核对机制 | **视觉 agent 预核 + 人 verdict 复核** | 复用 US-5 已验证的 playwright 视觉路径；给「全自动终点」一个真实视觉眼睛 |
| verdict 处理 | **三级：blocker→升级人类 / advise→记录不阻 / pass→放行** | 收编 issue#13（advise=升级可见但不阻塞叶子的天然中间态）；守红线6/7 |
| 清单来源 | **聚合 per-US 持久化 findings + epic 级补一刀** | epic 级有涌现验收点（整链连贯）不在任何单 US findings 里 |
| 触发方式 | **人手动** | 与外循环人在环现状一致，不在本杠杆碰外循环自动化 |

## 4. 切片 2a — 持久化 + 纯核 + 角色（先做，独立可交付）

**做**：
- **杠杆1 扩：design-soundness 后总持久化 DesignFindings**。现状 `inner-loop-runner` 仅在 `block` 的 hold 路径写 `design-findings.json`；改成 design-soundness phase 跑完（不论 off/auto/block）**总是**把解析出的 `DesignFindings` 持久化到每个 US 的已知位置（如 `<runsDir>/<usId>/design-findings.json`）。`off`（不跑 phase）则无此文件——聚合时容缺。
- **`pipeline/driver/src/acceptance.ts`（新）四纯函数**（无 IO，仿 `design-findings.ts` 严格校验，非法即抛指向字段）：
  - `aggregateAcceptanceItems(findingsList: DesignFindings[]): AcceptanceItem[]` — 从多份 findings 抽「非 testable 反目标的 desc + 各 suggestedAcceptance + 各 failureModes」，去重、标来源（哪个 findings/US），归类（反目标/验收点/失败模式）。
  - `buildAcceptanceChecklist(aggregated, epicSupplement): AcceptanceChecklist` — 把聚合项 + epic 级补充项装配成清单（每项:id / source / kind / desc / howToTry / expected）。
  - `parseAcceptanceVerdicts(raw: string): AcceptanceVerdict[]` — 解析 agent 产的 verdict JSON（每项 `{itemId, tier: 'blocker'|'advise'|'pass', evidence, reason}`），非法即抛指向字段（仿 `parseDesignFindings`：JSON 非法/顶层非对象数组/tier 非枚举/字段缺失各有定位错误）。
  - `resolveAcceptance(mode, verdicts, humanConfirmed): AcceptanceDecision` — 据模式+人确认决定放行/升级/hold + 哪些项升级（仿 `resolveDesignReview`）：
    - `auto` → 用 agent 初判 verdicts：有 blocker→`escalate`(列 blocker 项) + advise 归档；无 blocker→`pass` + advise 归档。
    - `block` + `humanConfirmed===null` → `hold`（待人复核）。
    - `block` + 人确认 verdicts → 按确认后的 tier 分流（同 auto 逻辑，但用人改过的）。
    - `off`/未知 → `pass`（安全兜底，不跑即放行）。
- **`pipeline/roles/acceptance-agent.md`（新）**：epic 级视觉验收 agent。站终端用户/对抗视角，用 playwright 按清单逐项跑场景、截图/snapshot，对每项产「证据 + 三级初判 verdict + 理由」，输出 JSON。**read-only 不改实现**（守红线4 角色不混同：验收 agent ≠ 实现 agent）。

**不做（2a）**：不接 epic 入口、不跑真 agent（那是 2b）。

**验收（2a）**：design-findings 总持久化；`acceptance.ts` 四纯函数 TDD 完成 + driver 变异门达标（≥90 聚合，新文件入 `stryker.conf.json` mutate 列表）；`acceptance-agent.md` 角色就位；**用词灵岛三年级 epic 的真实 persisted findings 离线验聚合判别力**（聚合应抽出 #2 同型非 testable 反目标 + 静音类 suggestedAcceptance）；driver gate 全绿零回归。

## 5. 切片 2b — epic 入口接线 + e2e（后做，接成完整管道）

**做**：
- **`pipeline/driver/src/bin-acceptance.ts`（新）epic 验收入口**。输入：epic 内 US id 列表 + `projectDir` + epic 意图描述 + `IH_ACCEPTANCE` 模式。流程：读各 US persisted findings（容缺）→ `aggregateAcceptanceItems` → epic 级补一刀 design-soundness（复用 design-soundness-agent + `parseDesignFindings`，注入 epic 意图+增量描述）→ `buildAcceptanceChecklist` → 跑 acceptance-agent（playwright）→ `parseAcceptanceVerdicts` → `resolveAcceptance` → 落账。复用既有 phaseInvoke/instrument（进 events.jsonl，可观测/可回放）。
- **verdict 复核（block 默认）**：verdicts + 证据渲染成交接物 `acceptance-review.md` 递人；人确认/改 tier 回流（读 `<runsDir>/acceptance-confirmed.json`，复用杠杆1 held/handoff 范式）；`auto` 跳过人用 agent 初判。
- **分流落账**：`escalate`→写升级交接物递人裁决（blocker 列表 + 证据）；`advise`→归档 `acceptance-report.md`（不阻）；`pass`→放行。结果落 ledger 一行。
- **止损/降级**：epic 补刀/agent 预核瞬时崩用既有重试；解析失败→记录并降级（不阻断，缺项不臆造 verdict）。

**不做（2b，留后续）**：验收清单→是否「真跑了对应场景」的强校验（先靠人复核 + 证据兜底）；多 epic/多年级聚合；外循环自动触发。

**验收（2b）**：`bin-acceptance` 在词灵岛三年级 epic 上真跑 e2e（`block` + `auto` 各一）：聚合+epic补刀产清单（events.jsonl 可见）→ acceptance-agent 用 playwright 跑出证据+verdict → 三路径各验一次（blocker→升级 / advise→归档不阻 / pass→放行）；`block` 递人确认、`auto` 全自动；`off` 整关不跑回现状；driver 既有测试零回归。

## 5.5 组件（落点）

| 文件 | 切片 | 职责 |
|---|---|---|
| `pipeline/driver/src/inner-loop-runner.ts`（+ design-findings 持久化） | 2a | design-soundness 后总持久化 DesignFindings 到 per-US 已知位置 |
| `pipeline/driver/src/acceptance.ts`（新） | 2a | 四纯函数核（aggregate / buildChecklist / parseVerdicts / resolveAcceptance） |
| `pipeline/roles/acceptance-agent.md`（新） | 2a | 视觉验收 agent 角色（playwright，三级初判，read-only） |
| `pipeline/driver/src/bin-acceptance.ts`（新） | 2b | epic 验收入口：聚合→补刀→agent→verdict→落账 |
| 配置 `IH_ACCEPTANCE` | 2b | off/block/auto 渐进自治开关 |
| `pipeline/driver/stryker.conf.json` | 2a | 加 `src/acceptance.ts` 入 mutate 列表 |

## 6. 数据结构（草案，实现时 TDD 定稿）

```ts
// 聚合后的一条验收项（来自某 US 非 testable 反目标 / suggestedAcceptance / failureModes，或 epic 级补充）
interface AcceptanceItem {
  id: string;                                   // 稳定 id（供 verdict 回指）
  source: string;                               // 来源：US id 或 'epic'
  kind: 'anti-goal' | 'acceptance' | 'failure-mode';
  desc: string;
  howToTry?: string;                            // 怎么试（agent/人据此跑场景）
  expected?: string;                            // 期望（"算成了"的样子）
}
interface AcceptanceChecklist { items: AcceptanceItem[]; }

// agent 逐项产出
interface AcceptanceVerdict {
  itemId: string;
  tier: 'blocker' | 'advise' | 'pass';
  evidence: string;                             // 截图路径/snapshot 摘要/观察
  reason: string;
}

// resolveAcceptance 产出
interface AcceptanceDecision {
  action: 'pass' | 'escalate' | 'hold';
  escalated: string[];                          // 升级的 blocker itemId
  advised: string[];                            // 归档不阻的 advise itemId
}
```

## 7. 测试策略

- **2a 纯逻辑（TDD + 变异门）**：四纯函数全覆盖——aggregate（去重/标来源/容缺）、buildChecklist（装配/空清单）、parseVerdicts（合法解析 + 各非法字段定位抛错，仿 `design-findings.test.ts` 的"造合法再按需破坏"工厂）、resolveAcceptance（off/block-hold/block-confirmed/auto + blocker/advise/pass 分流矩阵）。新文件入 stryker mutate 列表，变异门 ≥90 聚合。
- **2a 离线判别力验证**：拿词灵岛三年级 epic 跑过的真实 persisted findings 喂 `aggregateAcceptanceItems`，断言抽出 #2 同型非 testable 反目标 + 静音类 suggestedAcceptance——零 agent 成本验聚合判别力（同杠杆1-1a 用 `Play.test.tsx` 离线验判别力之招）。
- **2b 真 e2e**：词灵岛三年级 epic 真跑（block + auto 两模式）：phase 落 events、清单生成、playwright agent 产证据、三路径分流各验一次。

## 8. 范围与渐进

- 2a 独立交付（持久化 + 纯核 + 角色，补 issue#12 的"合目的性"半边纯逻辑）；2b 接成 epic 验收管道（达成 BOSS"最终全自动"）。
- 渐进自治：`off`→`block`→`auto` 三档随信任推进，默认 `block`（红线3 从窄到宽）。
- 红线守护：blocker 升级人类（红线6/7 不替人拍板、人类门禁）；advise 不阻（issue#13）；acceptance-agent read-only 不改实现（红线4 角色不混同）。
- 收编 issue#9（UI 现在有 epic 级视觉验收门）+ issue#12（合目的性可验）+ issue#13（advise 不阻塞通道）。
