## Why

"接全"后两次真 e2e 揪出 `worktree-integration` / `inner-loop-orchestration` 的两个缺口:

1. **squash 静默丢弃成果**:squashCommit 用外部硬编码 targetPaths,当预测错 agent 实际产出路径(如测试写在 `test/` 而非声明的 `src/`)时 `git add` fatal → `done` 的成果被静默丢弃。比普通 bug 危险——丢的是**正确**(job 真成功、真花了钱、过了所有 gate,却进不了集成)。
2. **新文件结构性 escalated**:新建纯逻辑文件需登记进产品 stryker.conf 才有**交付后**持续变异覆盖(inner-loop 动态变异门只在建造期保护),但改 stryker.conf 属门禁配置、不在 test/dev 授权边界(红线4 角色不混同),inner-loop 又无 orchestrator 环节 → 结构性 escalated(formatCompactNumber 真 e2e 实测卡死)。

## What Changes

- **动态 squash**:squashCommit 去掉外部 targetPaths 参数,改据 `git status --porcelain` 动态捕获实际改动(不限扩展名/目录、含删除);agent 写在哪、什么命名都正确捕获。捕获排除依赖软链 node_modules(linkDeps 的 symlink 因 root `.gitignore` `**/node_modules/` 带尾斜杠只匹配目录而漏网,squash 它会污染交付物为不可移植 symlink)。
- **orchestrator 域代修**:`FixDomain` 加 `orchestrator`;`MustFix.action` 白名单(首类 `register-mutation-target`);inner-loop 遇 orchestrator 域调注入的确定性代修器(非 agent),成功继续回修循环(重跑 gate+review),失败/不识别/无能力 → escalated(红线6 阻塞升级,不静默吞);代修器把新纯逻辑文件登记进产品 stryker.conf。白名单+确定性+可审计,对冲 KB 痛点三(自演进 harness 回归不可预见)。
- review prompt 告知 orchestrator 域 + action 用法。

## Capabilities

### Modified Capabilities
- `worktree-integration`: squash 改为据 git status 动态捕获实际改动(不依赖外部 targetPaths)+ 排除依赖软链。
- `inner-loop-orchestration`: 新增 orchestrator 域确定性代修(白名单 register-mutation-target)。

## 实证(真 claude e2e,fincards)

- **动态 squash**:clampPercent(已登记文件)→ done → 动态 squash 捕获 src/+test/ → batchIntegrate merged → main 不变。
- **orchestrator 代修翻盘**:formatCompactNumber(新文件)首轮 review 标 orchestrator 域 + register-mutation-target → 代修器在 worktree 内登记 stryker.conf → 次轮 review 确认登记(变异 100%)→ done(之前同一 US escalated,翻盘成功);integration 含 src+test+stryker.conf 登记三者。
- **node_modules 缺口**:翻盘 e2e 揪出 linkDeps symlink 被动态 squash 误捕获 → 修复(changedPathsFromStatus 排除)+ 单测固化。
