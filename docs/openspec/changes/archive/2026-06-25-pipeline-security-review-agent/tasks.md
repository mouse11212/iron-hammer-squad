## 1. findings 解析（纯，TDD）

- [x] 1.1 RED：写 `security-findings.test.ts`——`parseSecurityFindings` 解析合法 `{findings:[{category,severity,desc,...}]}`;字段/枚举校验
- [x] 1.2 RED：空 findings 合法;非法(severity 越界/缺 desc/非 JSON)即抛带定位
- [x] 1.3 GREEN：实现纯 `parseSecurityFindings(text): {findings: Finding[]}`(`pipeline/driver/src/security-findings.ts`,仿 verdict.ts)

## 2. 动作映射（纯，TDD）

- [x] 2.1 RED：`mapFindingsToAction`——有 high → escalate=true(high 入 high、余入 advise);仅 medium/low → escalate=false 全入 advise;空 → 无动作
- [x] 2.2 GREEN：实现纯 `mapFindingsToAction(findings): {escalate, high, advise}`

## 3. 安全评审角色 guide

- [x] 3.1 写 `pipeline/roles/security-review-agent.md`:内嵌 STRIDE 6 类 + OWASP 相关检查清单 + 输出 findings JSON 契约 + 只读不改文件 + offline 自包含(gstack /cso 作可选提及)

## 4. 验证

- [x] 4.1 driver gate 全绿(lint+tsc+vitest;parser/mapper 穷尽精确断言;**既有 240 测试零影响**)
- [x] 4.2 真实验证:对一个含漏洞的样本 diff 跑安全评审(真 claude,注入角色)→ 产 findings → `parseSecurityFindings` 接受 → `mapFindingsToAction` 正确(高危→escalate);确认契约端到端可用。**若真跑不可行则用代表性 findings JSON 验证 parser/mapper 并诚实标注 agent e2e 待接 run**

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 backlog M6 段标 M6-d ✅(首切片:契约+角色+映射,接 run 留后续)
- [x] 5.2 `openspec validate pipeline-security-review-agent --strict` 通过
- [x] 5.3 更新 `pipeline/README.md`(安全门:安全评审 agent)与 `docs/context/RESUME.md`(M6-d 完成)
- [x] 5.4 复盘并入 `docs/plan/M6-secret-scan-retro.md`(续记 M6-d)
- [x] 5.5 `openspec archive pipeline-security-review-agent` → `git commit` + `push`
