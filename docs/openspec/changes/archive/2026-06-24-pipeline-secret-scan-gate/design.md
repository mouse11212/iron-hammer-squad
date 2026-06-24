## Context

M5+ 进 M6（NFR/安全门），首切片密钥扫描门。失败驱动:RESUME §6 真实 PAT 泄露。落 V4 §8/§4.7/军规7 的最小 harness-native 起点。CodeQL/Dependabot 需 CI/云(D9 本地非云常驻张力大)→ 首切片用纯 TS 检测器。`gates.ts` 已有 `changedPathsFromStatus`(取改动路径)与 `makeGates(run,opts)` 建 red/green/mutation。

**硬约束(用户)**:不影响已实现功能。

## Goals / Non-Goals

**Goals:**
- 确定性检测本次改动 diff 的硬编码密钥,命中阻断交付(纳入既有 must-fix 流)。
- 高精度模式 + 内联豁免,低误报、不为消 FP 弱化门。
- **零破坏**:既有功能/测试完全不受影响。

**Non-Goals:**
- 不做敏感面分类升级(M6-b)、NFR 门(M6-c,需 NFR 上游)、OWASP agent(M6-d)、CodeQL/Dependabot(M6-e,需 CI)。
- 不回溯扫全树;不升级人类(密钥=agent 自修,人签留 M6-b)。
- 不引外部 secret-scanner(offline)。

## Decisions

**D1:命中=green 红让 agent 自修(用户确认)。** 硬编码密钥的正确处置=移除/参数化,是 agent 能做且该做的(像 lint),非"敏感改动需人签"。人签门留 M6-b。

**D2:高精度模式 + 内联豁免(用户确认)。** 低 FP 的 provider 前缀(`ghp_`+36/`github_pat_`/`AKIA`+16/PEM 块)+ 通用 `key/secret/token/password = "…"` 字面量;合法例外用 `// allowlist-secret: <理由>`(同行/上一行,**须带理由**,防滥用)。绝不无理由弱化(红线:不滥用 inline-disable)。

**D3:零破坏 = 向后兼容注入 + 改动文件范围 + 真实零 FP 验证。**
- **可选注入**:`makeGates` green 加可选 `secretScan?: () => Promise<GateResult>`(或等价 step)。**不注入 → green 完全照旧**(既有 222 测试 + 既有调用方零变化)。真实装配(`inner-loop-runner` 的 makeGates 调用)注入真实扫描。沿用 `emit?`/`readPhaseMs?` 注入式可选 dep 模式。
- **只扫改动文件**:复用 `changedPathsFromStatus(porcelain, prefix)` 取本次改动路径,读其内容扫描。旧代码不被回溯拦截。
- **真实零 FP 验证**:对当前 fincards 全量源码跑 `scanSecrets` 确认零命中(预检 grep 已干净)→ 证明既有干净交付 gate 仍绿。

**D4:分层 = 纯检测器 + 薄 IO。**
- 纯 `scanSecrets(files: {path,content}[]): Finding[]`(模式 + 行定位 + 豁免判定),穷尽单测。
- 薄 `secretScanGate(projectDir, run?): Promise<GateResult>`:取改动文件(git status)→ 读内容 → scanSecrets → 组装 GateResult。

## Risks / Trade-offs

- [误报拦截既有/合法代码] → 高精度 provider 模式(低 FP)+ 内联豁免 + 真实 fincards 零 FP 验证;通用赋值模式仅匹配引号包裹非空值,降 FP。
- [漏报(未知密钥格式)] → 首切片覆盖高频 provider + 通用赋值;新格式后续按真实失败追加(红线3 从窄到宽)。不追求全覆盖。
- [注入改了 green 行为破坏既有] → 默认 no-op 注入,既有调用方不传=零变化;driver 全量 gate(222 测试)须保持绿(回归门)。
- [高熵检测 FP 高] → 首切片**不**上纯熵检测(FP 高),只用结构化模式 + 赋值字面量;熵法留后续(若真实漏报驱动)。

## Open Questions

- 无(命中语义、豁免、零破坏手法均经 brainstorm 与用户确认)。
