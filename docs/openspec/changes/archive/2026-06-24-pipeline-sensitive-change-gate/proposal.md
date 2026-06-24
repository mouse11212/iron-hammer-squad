## Why

M6 安全门第二切片。M6-a 密钥扫描门解决"别把凭证提进来"(agent 自修);M6-b 解决**触及敏感面的合法改动需人签**——鉴权/CI/基础设施改动即便 clean+green 也**不该自动合**,必须人类签字(红线7 人类门禁不可绕过、军规7 触及鉴权/基础设施加倍审查+额外审批、D1 安全敏感改动 BOSS 签字)。复用现有 held/handoff 路由(批量集成已有 conflict/gate 两种 held)。

## What Changes

- 新增 `pipeline/driver/src/sensitive-change.ts`:**纯分类器** `classifySensitive(changedPaths): SensitiveHit[]`——按路径模式判定触及敏感面,返回 `{path, category}[]`。类别(高精度):**鉴权/凭证**(`*auth*`/`*login*`/`*oauth*`/`*credential*`/`*session*`)、**CI/CD 配置**(`.github/`/`*.ci.yml`/`Jenkinsfile`/workflow)、**基础设施/部署**(`Dockerfile`/`docker-compose*`/`*.tf`/`k8s/`/`deploy/`)。
- **集成时 held**:`batchIntegrate` 合每个 feature 前对其改动路径跑分类(**可选注入**,不注入零变化);命中 → `held` 加 `reason:'sensitive'`(+ 命中类别),**不自动合**,走 handoff 路由人签;工作保留为 feature 分支。
- handoff 报告:held(sensitive) 列出命中类别 + 提示"需人类签字后手动合"(红线7/D1)。

## Capabilities

### New Capabilities
<!-- 无:扩展现有 security-gate。 -->

### Modified Capabilities
- `security-gate`: 新增 Requirement「敏感改动分类」——纯分类器按路径判定鉴权/CI/基础设施敏感面。
- `worktree-integration`: 修改「批量集成」——合 feature 前可选注入敏感分类;命中则 held(reason:sensitive)路由人签,不自动合(红线7);不注入则行为照旧。

## Impact

- **新增**:`pipeline/driver/src/sensitive-change.ts`(纯分类器)+ 测试。
- **修改**:`pipeline/driver/src/worktree.ts`(batchIntegrate 加可选敏感分类注入 + held reason 扩 `'sensitive'`);真实装配(`inner-loop-runner` 的 batchIntegrate 调用 / drainBatchIsolated)注入;`handoff.ts`(渲染 sensitive held 类别 + 人签提示)。
- **不影响已实现功能**:① 可选注入默认 off → 既有 batchIntegrate/worktree 测试零变化;② 只看本 feature 改动路径;③ 验证 fincards 正常 src/*.ts 交付**不命中**(仍自动合)——只有触及鉴权/CI/基础设施才 held。
- **范围(YAGNI/红线3)**:只**路径分类 + held 路由人签**。**不**做内容级语义分析;**不**做签字状态机(人签后沿用 handoff 命令手动合);类别硬编码默认集(override/allowlist 留后续);**依赖清单不列入**(机器可判、无需人裁决,用户裁定)。
- 与 M6-a 区别:M6-a=must-fix(agent 移除密钥);M6-b=escalate-hold(改动合法但需人签,工作保留)。
