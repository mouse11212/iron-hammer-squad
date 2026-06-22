## Why

M5-B 的 `integrate` 是**单 feature**(每次自 base 重置)。军规 8 完整态要求 **N 个并发 feature 分支汇入集成分支并处理彼此冲突**(`feat-a/b/c → integration → 跑测试 → 解冲突 → main`)。本切片补这一块,但遵守军规 1(代码归人、合并是 HITL)与红线 6(阻塞升级):**冲突不自动解决,回滚并升级人类**;clean+green 的 feature 照常合入(部分推进),冲突/gate 红的挂起。

## What Changes

- 新增 `batchIntegrate(featureBranches, opts, gate)`:在 integration worktree(重置到 base)依次 squash-merge 每个 feature;clean+green 保留,冲突或 gate 红回滚(`reset --hard`)并标 held。
- 返回 `{ready, merged[], held[{branch, reason: conflict|gate}]}`:held 空且 merged 非空才 ready;held 升级人类。
- **绝不写 main**(军规 1/2)。

## Capabilities

### Modified Capabilities
- `worktree-integration`: 增加"批量多分支集成 + 冲突回滚升级"需求(单 feature integrate 升级为 N feature 的 batchIntegrate)。

## Impact

- **代码**:`pipeline/driver/worktree.ts` 新增 `batchIntegrate`(注入 CmdRunner + gate,可测;含冲突回滚)。
- **不在本切片**:把 batchIntegrate 接进 driver 的"批量 drain 后集成"流程(②/后续);本切片交付 batchIntegrate 能力 + 真冲突验证。
- **真相源**:V4 §9 军规 8(集成分支兜底)、军规 1/2(HITL/不动 main)、红线 6。
- **验证**:注入 runner 测命令序列(含冲突路径);**真 git 真冲突**廉价真集成(无 claude)。
