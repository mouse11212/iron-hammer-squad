## 1. 动态 squash(worktree-integration)

- [x] `changedPathsFromStatus(porcelain, prefix)` 纯函数:据 porcelain 动态捕获本切片全部改动(不限扩展名/目录、含删除、剥 prefix、排除工程外)
- [x] 排除依赖软链 node_modules(symlink 因 .gitignore 带斜杠漏网)
- [x] `squashCommit(projectDir, message)` 去 targetPaths 参数,改 show-prefix + status + 动态 add
- [x] 更新 worktree.test / isolated.test 契约
- [x] 真 e2e 验证(clampPercent done → 动态 squash 捕获 src+test → merged)

## 2. orchestrator 域确定性代修(inner-loop-orchestration)

- [x] `FixDomain` 加 `orchestrator`;`OrchestratorAction` / `MustFix.action` 白名单 register-mutation-target
- [x] verdict 解析 orchestrator 域 + 白名单 action(非白名单/无 action → 省略,不静默吞)
- [x] inner-loop 回修循环处理 orchestrator 域(成功继续 / 失败·不识别·无能力 → escalated)
- [x] `orchestrator-fix.ts`:`registerMutationTarget`(纯,幂等)+ `makeOrchestratorFix`(白名单 IO)
- [x] inner-loop-runner 装配注入;review prompt 告知;stryker.conf 纳入变异门
- [x] 真 e2e 翻盘验证(formatCompactNumber escalated → done)

## 3. gate

- [x] lint / typecheck / 185 测试 / 变异门 91.16%
