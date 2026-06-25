## Context

M6-d 安全评审 agent。现有 `review-agent.md` 第二遍已做非正式数据安全评审(M2-A 抓到安全 bug);M6-d 升格为 STRIDE/OWASP 方法论结构化评审。verdict.ts 已是"agent 产结构化裁决 → 解析 → 驱动动作"的先例。

## Goals / Non-Goals

**Goals:**
- STRIDE/OWASP 方法论安全评审角色(offline 自包含),产结构化 findings。
- **非确定 findings + 确定动作映射**:高危→人签、低危→advisory;LLM 不单独硬阻断。
- 纯 parser/mapper 可穷尽单测(像 verdict.ts);可调用,不改 inner-loop。

**Non-Goals:**
- 不改 inner-loop 状态机加常态安全 phase(重/贵/非确定,留后续按长程验证)。
- 不让 LLM agent 单独硬阻断(漏报风险)。
- 不依赖 gstack 必须加载(角色 .md 自包含;/cso 作更丰富选项)。
- 不做全 OWASP 深度(首切片覆盖高频类,从窄到宽)。

## Decisions

**D1:非确定 findings + 确定动作映射(用户确认)。** agent 产 findings(非确定),纯 `mapFindingsToAction` 按严重度确定动作:有 high → escalate 人签(复用 M6-b held/handoff);medium/low → advise。动作确定即便 findings 来自 LLM——这是把不可靠 agent 纳入可靠 harness 的关键(同 review→verdict→mustFix 模式)。漏报靠"高危人在环 + 不单独硬门 + 与 M6-a/b 确定门互补"缓解。

**D2:findings schema = STRIDE 类 + 严重度 + 定位。** `{category(STRIDE6), severity(high|medium|low), desc, location?, recommendation?}`。STRIDE 6 类作 category 枚举(覆盖注入/越权/信息泄露/失败副作用等映射到 tampering/elevation/info-disclosure…)。parser 仿 verdict.ts 严格校验、非法即抛。

**D3:角色 .md 自包含。** `security-review-agent.md` 内嵌 STRIDE 6 类速查 + OWASP 相关检查清单 + 输出 JSON 契约 + "只读不改文件"。gstack `/cso` 作"更丰富方法论"可选提及,不作硬依赖(offline-first)。

**D4:首切片可调用,不强接 inner-loop(用户确认)。** 交付 角色 + 纯 parser/mapper + 真跑验证;high→escalate 的实际 held/handoff 路由是"接进 run"的后续工作。本切片证明契约端到端(agent 产 findings → parse → map → escalate 决策)。

## Risks / Trade-offs

- [LLM 漏报真实漏洞] → 不单独硬门;高危人签;与确定性 M6-a/b 互补;角色 .md 给明确 STRIDE/OWASP 检查清单提高召回。接受非确定本质,人在环兜底。
- [LLM 误报(噪声 findings)] → 低危仅 advisory 不阻断;映射器确定,人可忽略 advise。
- [真跑成本] → 首切片只需一次小样本真跑验证契约(DoD),不常态化。
- [findings schema 演进] → parser 严格校验 + 枚举;新 category/字段按真实需要扩(从窄到宽)。

## Open Questions

- 无(动作语义、集成深度、自包含均经 brainstorm 与用户确认)。
