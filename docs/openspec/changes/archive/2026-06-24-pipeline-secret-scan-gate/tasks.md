## 1. 密钥检测器（纯，TDD）

- [x] 1.1 RED：写 `secret-scan.test.ts`——`scanSecrets` 命中 GitHub PAT(`ghp_`+36)、`github_pat_`、AWS `AKIA`+16、PEM 私钥块,各带 path/line/rule
- [x] 1.2 RED：通用赋值 `api_key/secret/token/password = "<非空>"` 命中;空值/无引号不命中
- [x] 1.3 RED：普通源码无命中 → [];多文件多命中带正确定位
- [x] 1.4 RED：内联豁免——同行/上一行 `// allowlist-secret: 理由` 跳过;**无理由不豁免**
- [x] 1.5 GREEN：实现纯 `scanSecrets(files): Finding[]`(`pipeline/driver/src/secret-scan.ts`)

## 2. 门函数（薄 IO）

- [x] 2.1 实现 `secretScanGate(projectDir, run?): Promise<GateResult>`——复用 `changedPathsFromStatus` 取改动文件 → 读内容 → scanSecrets → 命中失败(摘要 path:line:rule)/无命中通过/无改动通过;读失败不抛
- [x] 2.2 真实零 FP 验证:对当前 fincards 全量源码跑 scanSecrets 确认**零命中**(既有干净代码不被拦)

## 3. green 门可选注入（向后兼容）

- [x] 3.1 `gates.ts` `makeGates` green 加可选 secret-scan step(`GateOptions` 加可选注入);**不注入 → green 行为完全照旧**
- [x] 3.2 RED/GREEN：gates.test 加"未注入零变化"+"注入命中→green 失败"+"注入干净→green 过"三测;**既有 gates 测试全部不改仍绿**
- [x] 3.3 真实装配 `inner-loop-runner.ts` 的 makeGates 调用注入真实 `secretScanGate`

## 4. 验证（零破坏为纲）

- [x] 4.1 driver gate 全绿(lint+tsc+vitest;**既有 222 测试零改动通过** + 新增 secret-scan/gates 测试)
- [x] 4.2 真实验证(非破坏)：fincards 改动注入假 `ghp_…` → green 红(摘要列命中);移除 → 绿;`// allowlist-secret: 理由` 豁免 → 绿。确认 clean 路径行为不变

## 5. 收尾（规约同步 + 立项 + 归档 + 提交）

- [x] 5.1 backlog 加 M6 立项段(拆解 M6-a..e + 首切片 M6-a 密钥扫描门)
- [x] 5.2 `openspec validate pipeline-secret-scan-gate --strict` 通过
- [x] 5.3 更新 `pipeline/README.md`(安全门:密钥扫描)与 `docs/context/RESUME.md`(M6 启动、M6-a 完成)+ guide 补 `allowlist-secret` 约定
- [x] 5.4 复盘 `docs/plan/M6-secret-scan-retro.md`(新建,M6 首切片)
- [x] 5.5 `openspec archive pipeline-secret-scan-gate` → `git commit` + `push`
