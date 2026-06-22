## 1. batchIntegrate 跨批次累积(TDD)
- [x] 1.1 加分支存在判别(git rev-parse --verify --quiet refs/heads/<branch>)
- [x] 1.2 不存在→从 base 建(worktree add -b);存在→复用(worktree add,不 -B 重置);均先移除残留 intWt
- [x] 1.3 注入 runner 测:首批走创建-from-base;后批(branch 存在)走复用、不出现 -B/base 重置;累积态冲突仍 held

## 2. 验证归档
- [x] 2.1 lint+tsc+vitest 全绿;worktree.ts 变异门 ≥ 阈值
- [x] 2.2 (视需要)真 git 两批累积验证(无 claude):批1 建+合 a;批2 复用+合 b → integration 含 a+b
- [x] 2.3 README/RESUME + validate --strict → archive → commit + push
