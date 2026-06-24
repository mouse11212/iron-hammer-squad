## Why

追溯链(`changeId→spec→tests→commit`)当前是手维护的 `metrics/data/traces.json`,只有 5 条且停在 M3,而 OpenSpec archive 已积累 18 个归档 change——追溯链与真相严重脱节,正是"手维护必然漂移"的活样本。M4+ 可观测闭环要求追溯链可信、可重算;本切片把它从手维护改为从 OpenSpec archive + git **自动派生**,根治漂移。

## What Changes

- 新增 `metrics/src/weave-traces.ts`:**纯函数** `weaveTraces(changes)` 从结构化输入组装 `TraceLink[]` + **薄 IO** `readArchivedChanges(repoRoot)` 扫 `docs/openspec/changes/archive/*` 并经薄 git 调用补 commit/tests。
- **锚点 = 归档某 change 的 git commit**(工作节奏 §5「archive → commit」使该 commit 同时含 archive 移动 + 实现 + 测试):四字段全派生——`changeId`=archive 目录名去日期前缀、`spec`=该 change `specs/` 下 capability 目录名(斜杠拼接)、`commit`=归档 commit 短 hash、`tests`=该 commit diff 里的 `*.test.ts`/`*.spec.ts`(方案 A;找不到测试文件则 `[]`,诚实退化不臆造)。
- `collect.ts`:把 `readJson(traces.json)` 替换为 `weaveTraces(readArchivedChanges(repoRoot))`——snapshot 的 `traces` 改为实时派生,不再读手维护文件。
- 新增 `bin-weave.ts`(`npm run weave`):把派生结果写出到 `data/traces.json` 作**可检视产物**(每次重生成,供人眼审计;collect 用内存派生值,不依赖该落盘文件)。

## Capabilities

### New Capabilities
<!-- 无:不引入新 capability。 -->

### Modified Capabilities
- `harness-metrics`: 新增 Requirement「自动织追溯链」——追溯链从"手维护静态 traces.json"演进为"从 OpenSpec archive + git 确定性派生 TraceLink[],每字段可溯源到真实归档 commit"。既有「计算四指标(纯函数)」「渲染看板」Requirement 不变(snapshot.traces 字段形状/消费方不动,仅数据来源由读文件改为派生)。

## Impact

- **新增**:`pipeline/metrics/src/weave-traces.ts` + 测试;`pipeline/metrics/src/bin-weave.ts`(CLI 薄 glue,不单测);`package.json` 加 `weave` script。
- **修改**:`metrics/src/collect.ts`(把 traces 来源由 readJson 改为 weave 派生)。
- **数据源契约**:metrics 扫 `docs/openspec/changes/archive/` 目录结构 + `git log`/`git show`(沿用 collect.ts 已有的 git/OpenSpec 扫描能力,不跨包 import driver)。
- **范围(YAGNI)**:只织**已归档** change(有确定归档 commit);未归档活跃 change 无 commit → 不织。不碰 US 级(inner-loop/events.jsonl)追溯——那已由 replay 覆盖。
- **诚实退化**:归档 commit 找不到 → 跳过该 change(不臆造 hash);commit 内无测试文件 → `tests: []`。
- **data/traces.json**:由手维护真相源降级为派生产物(可被 `npm run weave` 覆盖重生成);不再是手编辑入口。
