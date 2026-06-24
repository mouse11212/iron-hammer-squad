## 1. 织链纯函数（纯，TDD）

- [x] 1.1 RED：写 `weave-traces.test.ts`——`weaveTraces` 单 change 织出 `{changeId, spec, tests, commit}`(changeId 去日期前缀)
- [x] 1.2 RED：多 capability → `spec` 按字典序斜杠拼接;无 specs → 空串
- [x] 1.3 RED：归档 commit 内无测试文件 → `tests: []`(诚实退化)
- [x] 1.4 RED：`tests` 去重 + 按字典序排序;只认 `*.test.ts`/`*.spec.ts`(`.ts`/`.js`)
- [x] 1.5 GREEN：实现 `pipeline/metrics/src/weave-traces.ts` 纯函数 `weaveTraces(changes: ArchivedChange[]): TraceLink[]`(纯组装/排序/拼接,无 IO);**TDD 精化**:测试文件过滤从 IO 上移进纯函数(吃 changedFiles 原始路径),边界全可穷尽单测

## 2. 归档扫描 + git 派生（薄 IO，TDD/烟测）

- [x] 2.1 实现薄 IO `readArchivedChanges(repoRoot): ArchivedChange[]`——扫 `docs/openspec/changes/archive/*`,每目录取 dir、specs(子目录名)、commit(`git log --diff-filter=A --format=%h -- <dir>/proposal.md` 末行,空则回退去掉 `--diff-filter=A`)、changedFiles(`git show --name-only --format= <commit>`);git 失败不抛(返回空串)
- [x] 2.2 缺归档 commit 的 change 在 `readArchivedChanges` 内被剔除(不进结果)
- [x] 2.3 真实仓库烟测：`readArchivedChanges(repoRoot)` 对当前 18 个归档 change 全部跑通(18→18 织链);抽查 verification-tax(commit `93b57cc`,tests=board/events-tax) 正确;**实证诚实退化**:早期 M0 归档 commit `eac24ab` 为纯归档提交(无测试)→ tests:[](`git show` 证实非 bug)

## 3. 接入 collect + 可检视产物 CLI

- [x] 3.1 `collect.ts`：把 `readJson<TraceLink[]>(traces.json)` 替换为 `weaveTraces(readArchivedChanges(repoRoot))`(snapshot.traces 来源由读文件改为派生);移除 collect 中已无用的 `TraceLink` import
- [x] 3.2 真实验证 collect 接线：`npm run report` 输出 `traces:18`(旧手维护停在 5 条 → 现 18 条全派生);看板「追溯链」表渲染全部已归档 change(board.ts 零改动,纯消费 snapshot.traces)。**约定**:collect/IO 由真实运行验证(本仓无 collect.test.ts),纯逻辑已在 weaveTraces 穷尽单测
- [x] 3.3 新增 `bin-weave.ts` + `package.json` `weave` script：写出 `data/traces.json`(JSON 2 空格缩进)。**修正**:`.json` 不能带注释且 spec 要求内容=TraceLink[] → 写干净 JSON 数组,"自动生成勿手改"溯源放 console + README(不污染文件合法性)

## 4. 验证（工作节奏 §4–5）

- [x] 4.1 lint + tsc + vitest 全绿(38 测试,32→38 +6 weave)
- [x] 4.2 变异级单测：`weave-traces.ts` 纯函数 6 测试穷尽精确断言覆盖去前缀正则/多 capability 排序拼接分隔符/空 specs→''/空 tests→[]/Set 去重/basename 折叠/`(test|spec)\.[tj]s` 过滤(.md 与 src .ts 排除)。"跳无 commit"属 IO(readArchivedChanges),由烟测覆盖(metrics 包暂无 stryker——E4 未配,包级变异门另立基建)
- [x] 4.3 真实验证：`npm run weave` 写出 18 条 `data/traces.json`(node 验证合法 JSON);人眼审计覆盖全部已归档 change、commit 真实可 `git show`;**实证诚实退化**:早期 M0/M1 归档 commit 为纯归档提交 → tests 空

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 `openspec validate pipeline-trace-weaving --strict` 通过
- [x] 5.2 更新 `pipeline/README.md`(metrics:追溯链已自动织链 + bin-weave 用法) 与 `docs/context/RESUME.md`(M4+ 续切片② 完成、traces 不再手维护)
- [x] 5.3 复盘要点并入 `docs/plan/M4plus-event-log-retro.md`(续记追溯链自动织链)
- [x] 5.4 `openspec archive pipeline-trace-weaving` → `git commit` + `push`
