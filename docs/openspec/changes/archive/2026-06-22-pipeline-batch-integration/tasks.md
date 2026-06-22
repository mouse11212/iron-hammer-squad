## 1. batchIntegrate(注入 CmdRunner + gate,TDD)

- [x] 1.1 `worktree.ts` 新增 `batchIntegrate(featureBranches, opts, gatePerFeature)`:重置 integration worktree 到 base
- [x] 1.2 依次 squash-merge 每个 feature:记录合前 HEAD → merge --squash → 冲突(非0)则 reset --hard 回滚 + held(conflict)
- [x] 1.3 clean-merge → commit → gate;gate 红则 reset --hard 回滚 + held(gate);全绿则保留(merged)
- [x] 1.4 返回 `{ready, merged[], held[{branch,reason}]}`;ready=held 空且 merged 非空;绝不写 main
- [x] 1.5 注入 runner + gate 替身测试:全合入 / 冲突回滚不阻塞其它 / gate 红回滚 / 部分推进 / 不碰 main

## 2. 验证

- [x] 2.1 lint + tsc + vitest 全绿;batchIntegrate 纯/注入逻辑纳入变异门 ≥ 阈值
- [x] 2.2 **真 git 真冲突**廉价真集成(无 claude):造两个真冲突 feature + 一个干净 feature → batchIntegrate → 断言干净的合入、冲突的 held、main HEAD 不变、无冲突标记残留、worktree 回收

## 3. 归档

- [x] 3.1 更新 `pipeline/README.md` / retro(`docs/plan/M5B-batch-integration-retro.md`)
- [x] 3.2 `openspec validate --strict` → `openspec archive` → git commit + push
