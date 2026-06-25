## Why

M6 安全门第四切片（M6-d）。M6-a/b 是确定性检测器(密钥/敏感面);M6-d 用 **STRIDE/OWASP 方法论的安全评审 agent** 补上确定性规则覆盖不到的威胁(注入/越权/不安全反序列化/失败路径副作用…)。落 V4 §136(安全 Agent: gstack /cso OWASP+STRIDE)、军规7。**关键**:LLM agent 非确定,**不单独当硬合并门**(漏报风险)——产结构化 findings,由**确定性映射器**按严重度决定动作(高危→人签、低危→advisory),动作确定即便 findings 来自 LLM。

## What Changes

- 新增 `pipeline/roles/security-review-agent.md`:安全评审角色 guide——**内嵌 STRIDE 6 类**(Spoofing/Tampering/Repudiation/Info-disclosure/DoS/Elevation)+ OWASP 相关检查(注入/鉴权/敏感数据/反序列化/SSRF/失败路径副作用);**只读评审不改文件**;输出**结构化 findings JSON** 契约;offline 自包含(gstack `/cso` 作更丰富选项提及,非依赖)。
- 新增 `pipeline/driver/src/security-findings.ts`:**纯** `parseSecurityFindings(text)`(解析 findings JSON,非法即抛,仿 `verdict.ts`)+ **纯** `mapFindingsToAction(findings)`(确定性:有 `high` → escalate 人签;medium/low → advise)。穷尽单测。
- **可调用集成(首切片)**:安全评审作为可调用的 pre-merge 步骤;high-severity → 复用 M6-b held/handoff 升级人签,低危进 handoff advisory。**不强接进每个 inner-loop run**(留后续按长程验证决定)。

## Capabilities

### New Capabilities
<!-- 无:扩展现有 security-gate。 -->

### Modified Capabilities
- `security-gate`: 新增 Requirement「安全评审 findings 契约」「findings 确定性动作映射」——agent 产 STRIDE/OWASP 结构化 findings,纯映射器按严重度决定升级/建议(非确定 findings + 确定动作)。

## Impact

- **新增**:`pipeline/roles/security-review-agent.md`(角色 guide);`pipeline/driver/src/security-findings.ts`(纯 parser + mapper)+ 测试。
- **不影响已实现功能**:首切片**不改 inner-loop 状态机/既有 gate**——只加角色 + 纯 parser/mapper(独立单元),既有测试零影响。可调用,不强接进每个 run。
- **范围(YAGNI/红线3)**:只**安全评审契约 + 角色 + 确定性动作映射 + 可调用**。**不**改 inner-loop 加常态安全 phase(重/贵/非确定,留后续按长程验证);**不**让 LLM agent 单独硬阻断;**不**依赖 gstack 必须加载。
- **求真/可靠性**:LLM findings 非确定 → 动作映射确定 + 高危人在环(红线7);漏报风险靠"高危人签 + 不单独硬门 + 与 M6-a/b 确定性门互补"缓解。
- 与 M6-a/b 区别:M6-a/b=确定性检测(regex/路径);M6-d=非确定 LLM 评审 + 确定动作映射。
