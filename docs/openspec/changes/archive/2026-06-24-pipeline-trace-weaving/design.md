## Context

追溯链 `changeId→spec→tests→commit` 当前是手维护的 `metrics/data/traces.json`(5 条,停在 M3),而 OpenSpec archive 已有 18 个归档 change——已严重脱节。M4+ 续切片①(Verification Tax 真值化)已确立"从真实事件派生、不臆造、缺数据诚实回落"的范式;本切片把追溯链纳入同一范式。

关键事实(已实证):工作节奏 §5「`openspec archive` → `git commit`」使**归档某 change 的那次 commit 同时包含 archive 移动 + 实现 + 测试**(commit `93b57cc` 实证:同含 `changes/archive/.../proposal.md`、`events-tax.ts`、`events-tax.test.ts`)。这给了织链一个**单一确定性锚点**。

## Goals / Non-Goals

**Goals:**
- 追溯链从手维护改为从 OpenSpec archive + git 确定性派生,每字段可溯源(对齐红线1 禁止臆造)。
- 沿用 metrics 包「纯函数 + 薄 IO」分层(仿 `events-tax.ts`),纯核心可穷尽单测。
- 保留 `data/traces.json` 文件形态作可检视产物,便于人眼审计;但去掉"手维护真相源"语义。

**Non-Goals:**
- 不织 US 级(inner-loop/events.jsonl)追溯——已由 `replay` 覆盖。
- 不织未归档活跃 change(无确定归档 commit)。
- 不持久化历史追溯链快照(events/产物均 ephemeral 重生成)。
- 不改 `MetricsSnapshot.traces` 字段形状与下游消费方(trace.ts 的 forward/reverse、board 渲染不动)。

## Decisions

**D1:锚点 = 归档 commit,四字段同源派生。**
- `changeId`:archive 目录名 `YYYY-MM-DD-<changeId>` 去日期前缀(正则剥 `^\d{4}-\d{2}-\d{2}-`)。
- `spec`:`changes/archive/<dir>/specs/` 下子目录名(capability),按字典序斜杠拼接;无 specs 目录则空串。
- `commit`:归档该 change 的 commit 短 hash。取法:`git log --diff-filter=A --format=%h -- <archive-dir>/proposal.md | tail -1`(最早一条 = 把 proposal.md 加到 archive 路径的 commit)。实证对 verification-tax 返回 `93b57cc`。若 `--diff-filter=A` 因 rename 取空 → 回退 `git log --format=%h -- <archive-dir>/proposal.md | tail -1`。两者皆空 → 跳过该 change。
- `tests`:`git show --name-only --format= <commit>` 取改动文件,filter `\.(test|spec)\.[tj]s$`,取 basename,去重排序。
- *备选*:从 `tasks.md`/`spec.md` 文本解析 tests(脆弱,弃);省略 tests 字段(丢失"测试"环,弃)。git diff 信号与锚点同源,最干净。

**D2:分层 = 纯函数 + 薄 IO(仿 events-tax.ts)。**
- 纯 `weaveTraces(changes: ArchivedChange[]): TraceLink[]`:输入已读好的 `{ changeId, specs: string[], commit: string, testFiles: string[] }`,纯组装/排序/拼接,无 IO——可穷尽单测全部边界(多 capability、空 tests、去前缀、排序)。
- 薄 IO `readArchivedChanges(repoRoot): ArchivedChange[]`:扫 archive 目录 + 跑上述 git 命令,缺归档 commit 的 change 在此被滤掉(返回前剔除)。薄 glue,经真实仓库烟测。

**D3:collect.ts 接线。** `readJson<TraceLink[]>(traces.json)` → `weaveTraces(readArchivedChanges(repoRoot))`。snapshot.traces 字段不变,仅来源变。

**D4:可检视产物用独立 CLI,不混入采集路径。** `bin-weave.ts`(`npm run weave`)调同一 `readArchivedChanges`+`weaveTraces` 后 `writeFileSync(data/traces.json, JSON.stringify(...,2))`。采集(collect)用内存派生值,**不读**该落盘文件——产物纯为人眼审计,避免"采集依赖一个可能过期的落盘文件"。

## Risks / Trade-offs

- [归档与实现分属不同 commit(早期 change 可能如此)→ tests 取到 `[]`] → 诚实退化为 `[]`(真"该归档 commit 无测试"),非臆造;在复盘记录此固有限制。
- [git rename 检测导致 `--diff-filter=A` 取不到归档 commit] → D1 的回退命令兜底;仍取不到则跳过该 change(宁可少织不可臆造)。
- [git 短 hash 碰撞(理论)] → 沿用 collect.ts 已有 `%h` 约定,与现状一致,不额外处理。
- [data/traces.json 仍在 git 里,可能被误当真相源手改] → 由 proposal/design 明确其降级为产物;后续可考虑 gitignore 或注释头标注"自动生成,勿手改"(本切片在文件头加生成标记即可)。

## Open Questions

- 无(方案 A 与范围已在 brainstorm 收敛并经用户确认)。
