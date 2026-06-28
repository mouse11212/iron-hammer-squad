# Harness 设计合理性评审角色（首切片）· 设计

> 状态：设计已获 BOSS 批准（2026-06-28）。本文档为 spec，下一步转 OpenSpec change + TDD 落地。
> 来源：词灵岛长程验证 issue#9 / issue#12（真人试玩暴露：功能门验"正确性"，验不出"设计是否达成目的"）。
> 载体：`pipeline/`（harness 本身；引擎基建，orchestrator 直接 TDD 建）。

## 1. Why（要解决的结构性缺口）

当前 harness 通篇优化"**实现 vs 规约的正确性**"，默认"规约=真相"。但规约可以**句句正确、整体跑偏**——词灵岛 #2 铁证：判分逻辑每条都对、318 测试全绿、变异门满分，但 UI 把答案印出来了 → **整个"听音选词"没达成"靠听辨词"的目的**。**没有任何一步校验"规约/设计是否达成产品意图"**——这本质需人判（issue#12），但 harness 能把它**结构化、前置、留痕**。

本切片补**第一块**：在实现前，由独立对抗性 agent 评审规约的"合目的性"，产出结构化 findings，人裁。

## 2. 范围（首切片，从窄到宽）

**做（IN）**：
- 新角色 `pipeline/roles/design-soundness-agent.md`：独立对抗性评审一份**规约切片**，产出结构化 findings。
- 纯函数 `pipeline/driver/src/design-findings.ts`：`parseDesignFindings` 校验/解析 agent 的结构化输出（非法即拒）。
- **orchestrator 可调用**（手动），**不自动接进 inner-loop 每轮**（仿 M6-d security-review-agent 首切片）。
- 真实验证：在**真实的 US-1 听音选词规约**上跑，确认能产出"答案不得在答题前可得"类反目标。

**不做（OUT，YAGNI/红线3）**：
- 不自动接进每轮 inner-loop（贵/非确定，留后续按需）。
- 反目标 → test-agent 自动写确定性测试（杠杆1，后续切片）。
- 实现后的验收关 / 人工试玩清单（杠杆2，后续切片）。
- 确定性"动作映射/硬阻断"——本切片只产 findings + 人裁，不做 escalate-hold 自动路由。

## 3. 角色：design-soundness-agent.md

- **定位**：独立、对抗性的"设计合理性"评审者。**专门被提示去找"行为正确但跑偏"**——不是查实现 bug，而是查"这规约达成它声称的产品意图了吗？用户会注意到哪些失败模式？"
- **关键纪律（防共享盲点）**：它评审的规约由 orchestrator 写；故 prompt 必须强制其**站在终端用户/对抗者视角**，**不得假设规约作者是对的**，主动设想"一个孩子/家长拿到成品会怎样发现它没用"。
- **只读评审**：不改规约、不写代码；只产 findings。
- **自包含**：prompt 内含"合目的性评审"方法（意图对齐→反目标穷举→失败模式），不依赖外部检索。

## 4. 输出 schema（结构化，纯函数可解析）

agent 产出 JSON（`parseDesignFindings` 校验）：
```
{
  intentRestatement: string,        // 意图复述：一句话，这功能为谁、达成什么（用户视角）
  antiGoals: [                      // 反目标：行为正确但失败的条件
    { desc: string, testable: boolean }   // testable=true → 后续可转确定性测试；false → 后续转人工试玩项
  ],
  failureModes: string[],           // 用户会注意到的失败方式
  suggestedAcceptance: string[],    // 建议验收标准（用户视角"算成了"）
}
```
**校验规则（parseDesignFindings，契约严）**：`intentRestatement` 非空串；`antiGoals` 数组每项含非空 `desc` + 布尔 `testable`；`failureModes`/`suggestedAcceptance` 为字符串数组（可空）。任一违规 → 抛 Error（信息明确指向违规字段，遵 test-agent 断言信息纪律）。非 JSON / 缺字段 → 拒。

## 5. 流程与人裁

```
规约切片 → [design-soundness-agent 评审] → 结构化 findings
         → parseDesignFindings 校验
         → BOSS 复核：增删反目标/确认意图/拍板
         → 确认项追加进规约切片(留痕,后续切片可消费)
         → 通过则进 test/dev；发现严重设计缺陷则人在建造前改规约
```
- **agent 不单独硬阻断**（仿 security-review，红线7 人在环）：findings 是"供人判的候选"，不是自动门。
- 本切片**产出落点**：findings（结构化）+ 人的决策记录；**人确认的反目标/验收标准由 BOSS 手动写回规约切片文本**（首切片不做自动回写、不自动喂下游——为后续杠杆1/2 留的接口是"结构化 schema 本身"，而非自动管道）。

## 6. 落地（driver）

仿 `driver/security-findings.ts` 的分层：
- `design-findings.ts`：纯 `parseDesignFindings(raw: string): DesignFindings`（解析+校验，非法抛错）。**纯函数·TDD·纳入变异门**。
- 调用胶水（薄）：orchestrator 用既有 phaseInvoke 跑 agent（注入角色 prompt + 规约切片）→ 收 findings → parseDesignFindings → 呈给人。**薄 IO，端到端覆盖**，不写进 inner-loop 状态机。
- **不改** inner-loop.ts / gates.ts（不接每轮）。

## 7. 测试策略

- **纯逻辑（TDD+变异门）**：`parseDesignFindings`——合法输出解析正确 / 各字段缺失或类型错→抛错（信息指向字段）/ 反目标 testable 非布尔→拒 / 非 JSON→拒 / 空数组合法。
- **薄 IO**：调用胶水端到端覆盖（真 agent 一次）。
- **真实验证（杀手锏，证"能拦 #2"）**：把 design-soundness-agent 跑在 `iron-hammer-output/wordspirit` US-1 听音选词的**原始规约切片**上（见 scratchpad/观察日志 US-1 切片），确认 findings 的 antiGoals 含"答案不得在答题前可得/必须靠听"类条目（testable=true）。**这直接证明它当初能拦住 #2。**

## 8. 与既有角色的关系

- **互补 `product-clarify-agent`（M2-B）**：澄清角色处理**模糊**需求（缺信息→问）；本角色处理**完整但可能跑偏**的规约（句句对→查合目的性）。两者覆盖"需求质量"的两个不同失效面。
- **复用 `security-review-agent`（M6-d）范式**：独立 agent 产结构化 findings + 确定性解析 + 人在环不硬阻断 + 首切片可调用不接每轮。本切片**结构同构、风险最低**。

## 9. 验收（本切片"算成了"）

- `design-soundness-agent.md` 角色就位；`parseDesignFindings` gate 全绿 + 变异门达标。
- 真 agent 在 US-1 听音选词规约上跑出含"必须靠听/答案不得提前可得"的反目标（证明能拦 #2）。
- orchestrator 可手动调用整条（规约→agent→解析→呈人）。
- 不影响既有 inner-loop（不接每轮，既有测试零回归）。
