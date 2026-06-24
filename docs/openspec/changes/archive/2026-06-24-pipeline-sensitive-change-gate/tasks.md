## 1. 敏感分类器（纯，TDD）

- [x] 1.1 RED：写 `sensitive-change.test.ts`——auth(`auth`/`login`/`oauth`/`credential`/`session`)路径 → category:'auth'
- [x] 1.2 RED：ci(`.github/`/`*.ci.yml`/`Jenkinsfile`/`.gitlab-ci`)→ 'ci';infra(`Dockerfile`/`docker-compose*`/`*.tf`/`k8s/`/`deploy/`)→ 'infra'
- [x] 1.3 RED：普通 `src/*.ts`/`test/*`/`package.json` 不命中 → [];多路径多命中带类别
- [x] 1.4 GREEN：实现纯 `classifySensitive(paths): {path,category}[]`(`pipeline/driver/src/sensitive-change.ts`)

## 2. batchIntegrate held(sensitive)（向后兼容注入）

- [x] 2.1 `worktree.ts`：`BatchHeld.reason` 加 `'sensitive'`、加可选 `categories?: string[]`;`batchIntegrate` 加可选 4 参 `sensitiveCheck?`
- [x] 2.2 RED/GREEN：合每 feature 前 sensitiveCheck;命中 → held(sensitive,categories)跳过 merge;**未注入则行为照旧**
- [x] 2.3 既有 worktree/batchIntegrate 测试**全部不改仍绿**;加"注入敏感→held:sensitive"/"注入普通→merged"/"敏感与 conflict/gate 并存"测

## 3. 真实装配 + handoff

- [x] 3.1 真实装配处(batchIntegrate 调用 / drainBatchIsolated)注入 `sensitiveCheck = (branch) => classifySensitive(git diff --name-only <base>...<branch> 路径) 去重类别`
- [x] 3.2 `handoff.ts`：渲染 held(sensitive) 列命中类别 + "需人类签字后手动合(红线7/D1)";既有 handoff 测试不破

## 4. 验证（零破坏为纲）

- [x] 4.1 driver gate 全绿(lint+tsc+vitest;**既有 232 测试零改动通过** + 新增分类/集成测)
- [x] 4.2 真实验证(非破坏,真 git)：一批含①触 `.github/workflows/x.yml` 的 feature ②仅改 `src/*.ts` 的 feature → ① held(sensitive)、② merged、main 不动;handoff 报告列①类别+人签提示。确认 fincards 普通 src 交付不被 held

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 backlog M6 段标 M6-b ✅
- [x] 5.2 `openspec validate pipeline-sensitive-change-gate --strict` 通过
- [x] 5.3 更新 `pipeline/README.md`(安全门:敏感改动审批)与 `docs/context/RESUME.md`(M6-b 完成)+ guide 补敏感面约定
- [x] 5.4 复盘并入 `docs/plan/M6-secret-scan-retro.md`(续记 M6-b,或新增简短段)
- [x] 5.5 `openspec archive pipeline-sensitive-change-gate` → `git commit` + `push`
