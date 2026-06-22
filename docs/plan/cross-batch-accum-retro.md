# 复盘:集成分支跨批次累积

> 日期 2026-06-22 · change `2026-06-22-pipeline-cross-batch-accum` · 权威 V4 §9 军规 8(集成=暂存区)

## 问题

batchIntegrate 原以 `git worktree add -f -B integration <wt> <base>` **每批重置 integration 到 base**。在②daemon 多轮下,后批丢弃前批已验证 feature——integration 暂存区只剩最后一批,违背"暂存区累积全部已验证工作待人类合 main"。

## 交付

batchIntegrate 改为**跨批次累积**:`git rev-parse --verify` 判 integration 分支是否存在——不存在→从 base 建(`-b`);存在→复用(checkout,不 `-B` 重置)→在已累积分支上加本批。新批与已累积内容的冲突沿用 per-feature 回滚 held。

- 测试:首批从 base 建(`-b`)/ 后批复用(无 -b/-B/base)/ 累积态冲突仍 held;batch 7 测试。worktree.ts 变异门 91.03%(≥90)。driver gate 140。
- **真 git 两批累积验证**(无 claude):批1 建+合 a → 批2 复用+合 b → integration 同时含 a+b、2 个 integrate commit、main 不变。

## 关键决策

- **累积为默认**(非 flag):暂存区语义本就该累积;"清空重来"是 HITL(人类合 main 后删 integration 分支 → 下批又从 base 起)。
- **复用前先 remove intWt**:避免"分支已被另一 worktree 检出"冲突;branch 历史保留,累积不丢。
- **测试变更(红线 5)**:batch 用例"-B 重置"改为"首建 -b / 后复用",记录。
