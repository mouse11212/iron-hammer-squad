## ADDED Requirements

### Requirement: 安全评审 findings 契约
系统 SHALL 提供纯函数 `parseSecurityFindings(text)`,把安全评审 agent 的输出解析为结构化 `{findings: Finding[]}`,每个 Finding = `{category(STRIDE: spoofing|tampering|repudiation|info-disclosure|dos|elevation), severity(high|medium|low), desc(string), location?(string), recommendation?(string)}`;非法输入(非 JSON / 缺字段 / 枚举越界)即抛错带定位(仿 verdict 解析);findings 空数组合法(无威胁)。

#### Scenario: 解析合法 findings
- **WHEN** 传入 `{"findings":[{"category":"injection 用 tampering","severity":"high","desc":"未参数化 SQL"}]}` 形态的合法 JSON
- **THEN** 返回结构化 findings,字段校验通过

#### Scenario: 空 findings 合法
- **WHEN** 传入 `{"findings":[]}`
- **THEN** 返回空 findings(无威胁,不臆造)

#### Scenario: 非法即抛
- **WHEN** severity 越界(如 `"critical"`)或缺 desc 或非 JSON
- **THEN** 抛错带定位信息(不静默吞)

### Requirement: findings 确定性动作映射
系统 SHALL 提供纯函数 `mapFindingsToAction(findings)`,**确定性**按严重度决定动作:任一 `high` → `escalate=true`(升级人签,复用 held/handoff);`medium`/`low` 归入 `advise`(handoff advisory)。返回 `{escalate, high: Finding[], advise: Finding[]}`。**LLM findings 非确定,但动作映射确定**——LLM agent 不单独硬阻断(漏报风险),高危由人在环裁决(红线7)。

#### Scenario: 有 high → 升级
- **WHEN** findings 含至少一条 severity=high
- **THEN** `escalate=true`,high 列入 high,其余入 advise

#### Scenario: 仅 medium/low → 仅建议
- **WHEN** findings 无 high,只有 medium/low
- **THEN** `escalate=false`,全部入 advise(handoff advisory,不阻断)

#### Scenario: 空 findings → 无动作
- **WHEN** findings 为空
- **THEN** `escalate=false`,advise 为空
