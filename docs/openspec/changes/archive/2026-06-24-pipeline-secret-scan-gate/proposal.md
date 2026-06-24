## Why

M5+ 进入 M6（NFR 门 + 安全门）。首切片做**密钥扫描门**——失败驱动:RESUME §6 记录过真实 GitHub PAT 泄露事件。落地 V4 §8 安全门 / §4.7 / 军规7"CodeQL/Dependabot 类供应链/安全扫描前置"的**最小 harness-native 起点**:确定性扫本次改动 diff 找硬编码密钥/凭证,命中即阻断交付。CodeQL/Dependabot 需 CI/云(与本地非云常驻 D9 张力大),故首切片用纯 TS 高精度检测器(offline)。

## What Changes

- 新增 `pipeline/driver/src/secret-scan.ts`:**纯检测器** `scanSecrets(files: {path,content}[]): Finding[]`——高精度模式匹配 GitHub PAT(`ghp_`/`github_pat_`)、AWS(`AKIA…`)、PEM 私钥块、通用 `api_key/secret/token/password = "…"` 高熵字面量;返回 `{path,line,rule}[]`。支持内联豁免 `// allowlist-secret: <理由>`(同行/上一行,可审计,绝不为消 FP 弱化门)。
- 薄 IO:读本次改动文件内容(复用 `gates.ts` 的 `changedPathsFromStatus` + 读文件);驱动门函数 `secretScanGate(projectDir): Promise<GateResult>`。
- **向后兼容集成**:`makeGates` green 门加**可选注入** secret-scan step——既有调用方/测试**不注入即零行为变化**(默认 no-op);真实装配处打开。命中密钥 → green 红 → inner-loop 当 must-fix → dev 移除/改环境变量(像 lint 错,不升级人类——人签留 M6-b)。
- **只扫本次改动文件**(不回溯全树),保护既有交付不被旧代码边界串拦截。

## Capabilities

### New Capabilities
- `security-gate`: harness 安全门能力。首个 Requirement = 密钥扫描门(确定性检测硬编码凭证,命中阻断交付,内联豁免)。M6 后续(敏感面升级/NFR 门/OWASP)在此 capability 扩展。

### Modified Capabilities
- `inner-loop-orchestration`: green 门加可选 secret-scan step(向后兼容注入,默认 no-op;真实装配启用)——命中密钥使 green 红,纳入既有 must-fix 回修流。

## Impact

- **新增**:`pipeline/driver/src/secret-scan.ts`(纯检测器 + 薄 reader + 门函数)+ 测试;backlog M6 立项段。
- **修改**:`pipeline/driver/src/gates.ts`(makeGates green 加可选注入 secret-scan;不注入零变化);真实装配处(`inner-loop-runner.ts` makeGates 调用)注入真实扫描。
- **约束:不影响已实现功能**:① 可选注入默认 no-op → 既有 222 driver 测试 + 既有 makeGates 调用方零变化;② 只扫改动文件 → 旧代码不被回溯拦截;③ **真实零误报验证**:对当前 fincards 全量源码跑 `scanSecrets` 确认零命中(既有干净交付 gate 仍绿)。clean 代码行为完全不变,只对含密钥的新交付新增拦截。
- **范围(YAGNI/红线3)**:只密钥**检测门**。**不**做敏感面分类升级(M6-b)、NFR 门、OWASP agent、CodeQL/Dependabot。
- **offline-first**:纯 TS 检测器,不引外部 secret-scanner/CodeQL。
