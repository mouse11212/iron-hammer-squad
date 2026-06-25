# 复盘 · M6 安全门首切片：密钥扫描门（M6-a）

> 日期 2026-06-24 · change `pipeline-secret-scan-gate` · 新 capability `security-gate` + 改 `inner-loop-orchestration`
> M5+ 进入 M6（NFR 门 + 安全门）的第一个切片，从窄到宽（红线3）。

## 做了什么

把"质量门"从功能正确性扩到安全：确定性扫本次改动 diff 找硬编码密钥，命中即阻断交付。

- **纯检测器** `scanSecrets(files): Finding[]`（`driver/secret-scan.ts`）：高精度模式——GitHub PAT(`ghp_`+36/`github_pat_`)、AWS(`AKIA`+16)、PEM 私钥块、通用 `api_key|secret|token|password = "非空"`；带 1-based 行号 + 规则名。内联 `// allowlist-secret: <理由>` 豁免（同行/上一行，**空理由不豁免**防滥用）。
- **薄门函数** `secretScanGate(projectDir, porcelain, prefix)`：复用 `changedPathsFromStatus` 取改动文件 → 读内容 → scanSecrets → 命中 ok:false（摘要 path:line:rule）。
- **向后兼容注入** green：`makeGates` 加可选 `secretScan?`；不注入则 green 行为完全照旧，`inner-loop-runner:169` 真实装配启用。命中 → green 红 → 既有 must-fix 回修流（dev 移除/参数化，**不升级人类**——人签留 M6-b）。

## 验证来源（可溯源）

- driver gate 全绿：lint+tsc+**232 测试**（222→232，+10：secret-scan 7 + gates 注入 3）。
- **真实验证（非破坏）**：临时 dir 注入假 `ghp_…` → 门红（摘要 `src/config.ts:1 [github-pat]`）；移除→绿；`// allowlist-secret: 测试夹具` 豁免→绿；无改动→绿。

## 「不影响已实现功能」——用户硬约束的三重保证（实证）

这是本切片的核心纪律。三重保证各有实证：
1. **向后兼容注入（默认 no-op）**：secretScan 是可选注入；**既有 222 driver 测试零改动全部通过**，既有 makeGates 调用方不传即零行为变化。沿用 `emit?`/`readPhaseMs?` 注入式可选 dep 模式（本仓一以贯之）。
2. **只扫本次改动文件**（复用 `changedPathsFromStatus`，不回溯全树）：旧代码里的边界串不会拦截新的无关交付。
3. **真实零误报验证**：对 fincards 产品全量 **25 文件**跑 scanSecrets → **0 命中**。净效果——clean 代码（如 fincards 现状）gate 行为完全不变，只对含密钥的新交付新增拦截。

> 自检副产物：whole-repo 扫描时本切片自身的检测器源（regex 定义）与测试夹具会命中——已对 `secret-scan.ts` 的规则行加 `// allowlist-secret: 检测器规则定义本身`；测试夹具是 intentional 假密钥，且 gate 操作上只扫产品交付（不扫 harness 源）。

## 揪出的坑 / 隐性知识

- **模式长度要钉准**：首版测试夹具用 `ghp_`+38 字符，而规则 `ghp_[A-Za-z0-9]{36}\b` 要求恰好 36 + 词边界 → 不匹配。是**测试夹具**长度错（非实现 bug），改 `'ghp_'+'x'.repeat(36)`。教训：provider token 模式长度敏感，夹具要精确。
- **检测器自身会自命中**：定义密钥模式的源码、测试假密钥都会被 whole-repo 扫描命中——但 gate 只扫产品改动 diff，不扫 harness 源，操作上无碍；对规则行加内联豁免做卫生。
- **通用赋值模式降 FP**：`key|secret|token|password = "非空"` 只匹配引号包裹的非空值（空值/引用变量不匹配），避免 `token = someVar` 这类误报。

## 双层认知 / 设计哲学

- **命中=门红让 agent 自修，非升级人类**：硬编码密钥的正确处置=移除/参数化，是 agent 能做且该做的（像 lint）。人签门（红线7/军规7）留给 **M6-b 敏感面改动**（鉴权/CI/基础设施触及）。两类区分清晰：M6-a 是"别把凭证提进来"的硬门，M6-b 是"敏感改动需人裁决"的升级。
- **失败驱动（红线3）**：本门是被 RESUME §6 记录的**真实 PAT 泄露事件**拉出来的，不是凭空的安全洁癖。
- **offline-first**：纯 TS 检测器，不引外部 secret-scanner/CodeQL（后者需 CI/云，与本地非云常驻 D9 张力大，排 M6 末位）。

## 续:M6-b 敏感改动加严审批（change `pipeline-sensitive-change-gate`）

把"质量门"从内容正确性扩到"谁有权批准":触及敏感面的合法改动 held 路由人签,不自动合。

- **M6-a 与 M6-b 是两种本质不同的门**:M6-a(密钥)=**must-fix**(agent 自己拿掉,硬编码密钥不该存在);M6-b(敏感面)=**escalate-hold**(改动合法、必需,但触及鉴权/CI/基础设施 → 不能自动合,必须人签)。前者改"内容错了",后者改"谁批准"。正好对应红线7(人类门禁不可绕过)。
- **复用 held/handoff,不新造路径**:batchIntegrate 已有 `held(reason:conflict|gate)` 通路;M6-b 只加 `reason:'sensitive'`+`categories`。敏感改动 squash 出分支(工作保留),held 不自动合,handoff 给人签提示——**绝不用 escalated**(那丢工作)。
- **纯路径分类器**:`classifySensitive(paths)` 三类(auth/ci/infra),优先序 ci→infra→auth;依赖清单**不列**(用户裁定:机器可判无需人裁决)。穷尽单测。
- **向后兼容注入**(同 M6-a/全仓一贯):batchIntegrate 可选 4 参 `sensitiveCheck`、BatchDrainDeps 可选 `sensitiveCheck`——不注入则行为照旧,既有 232 测试零改动通过。真实装配 drainBatchIsolated 注入(`git diff --name-only base...branch` → classifySensitive 去重类别)。
- **真 git e2e**:一批 `.github/workflows/deploy.yml`(敏感 ci)+ `src/feature.ts`(普通)→ 前者 held(sensitive,[ci])、后者 merged、main 不动、handoff 渲染类别+"需人类签字后手动合"。driver gate 240 全绿。
- **不影响已实现功能**:普通 src 交付照常合(fincards 风格不受影响),只有触及敏感面才 held。

## 续:NFR 上游补齐（`NFR-baseline-v1.md`）

M6-c 的上游。harness 引擎层 8 维 NFR 基线:**方向占全 + 阈值不臆造**——可观测/安全/并发/可移植已达标(既有门满足)、可维护保守基线(变异门 break90)、**可靠/性能/成本待长程标定**(当前未做长程任务测试,SLO 留长程数据后回填,红线1,同 M4+「待埋点」哲学)。usability/合规/可伸缩刻意排除(YAGNI)。回填 V4 §8/§266 指针。

## 续:M6-d 安全评审 agent 首切片（change `pipeline-security-review-agent`）

确定性规则(M6-a/b)覆盖不到语义级威胁(注入/越权/失败副作用…)→ STRIDE/OWASP 方法论 LLM 评审补上。

- **核心洞察:非确定 findings + 确定动作映射**。LLM agent 非确定,本项目纪律是确定性优先——所以 agent **不单独当硬合并门**(漏报风险:不能信非确定 agent 没漏掉漏洞就放行)。架构:agent 产**结构化 findings**(像 review 产 verdict),纯 `mapFindingsToAction` 按严重度**确定性**决定动作(有 high→escalate 人签/复用 M6-b held、低危→advisory)。**动作确定即便 findings 来自 LLM**——这是把不可靠 agent 纳入可靠 harness 的通用模式(同 review→verdict→mustFix)。
- **与 M6-a/b 互补不替代**:确定性门(密钥/敏感路径)是可靠骨架;LLM 安全评审补语义级、靠人在环兜底高危。漏报靠"高危人签 + 不单独硬门 + 确定门互补"缓解。
- **可 TDD 的是 parser+mapper**(像 verdict.ts),LLM 部分靠真跑烟测——非确定逻辑包在纯函数边界外。
- **真 claude e2e(DoD)**:含 SQL 注入 + 命令注入的样本 diff → 真安全 agent 产 **5 条 STRIDE findings**(tampering/elevation high + info-disclosure/path-traversal medium + repudiation low)→ `parseSecurityFindings` 接受 → `mapFindingsToAction` escalate=true(2 high)。契约端到端用真 LLM 验证,非模拟。
- **角色 .md 自包含**:STRIDE 6 + OWASP 检查清单内嵌,不依赖 gstack 必须加载(/cso 作可选);严重度克制(high 仅给确有可利用路径,勿滥用升级)。
- **首切片可调用,不接 inner-loop 每轮**(贵/非确定,留后续按长程验证是否常态化)。既有 240 测试零影响(249)。

## M6 后续候选

- **M6-c NFR 派生测试门**(NFR 上游已补;已达标/保守维度可做如补 metrics 包级变异门,待标定维度等长程数据)→ M6-e CodeQL/Dependabot(需 CI)→ M6-d 接进 run(按长程验证)。
- 零头：metrics 包级 stryker 变异门；secret-scan 漏报格式 / 敏感面类别 / 安全 findings category 按真实失败追加（红线3 从窄到宽）；敏感面 override/allowlist。
