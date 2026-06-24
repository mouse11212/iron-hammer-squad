## 1. 缺陷派生纯函数（纯，TDD）

- [x] 1.1 RED：写 `defects-feed.test.ts`——`deriveDefects`:done run `fixRounds:2` → 2 条 caught(id 含 jobId)
- [x] 1.2 RED：`fixRounds:0` 无 residual → 0 条(干净 run 不臆造缺陷)
- [x] 1.3 RED：blocked-escalated `fixRounds:1`+`residualCount:2` → 3 条 caught
- [x] 1.4 RED：escape trailer `{commit,desc}` → 1 条 escaped(where/note/id 正确)
- [x] 1.5 RED：两侧皆空 → []
- [x] 1.6 GREEN：实现 `pipeline/metrics/src/defects-feed.ts` 纯 `deriveDefects(runs, escapes): DefectRecord[]`

## 2. compute 口径回落（纯，TDD）

- [x] 2.1 RED：`defectEscapeRate(0,0)` → `null`(改原返回 0);`defectEscapeRate(1,4)` → 0.25
- [x] 2.2 GREEN：`compute.ts` `defectEscapeRate` 总数 0 返回 null;`types.ts` 签名改 `number|null`;同步 `MetricsSnapshot.defectEscapeRate: number|null`

## 3. 薄 IO + collect 接线

- [x] 3.1 实现薄 IO `readEscapeTrailers(repoRoot): EscapeTrailer[]`——`git log --format=%H%x1f%B%x1e` 扫 `Defect-Escaped:` 行;git 失败返回 []
- [x] 3.2 `types.ts`：`InnerLoopRunRecord` 加 `residualCount?: number`;新增 `EscapeTrailer`;`collect.ts` 既有 `readInnerLoopRuns` 补读 `residual?.length`
- [x] 3.3 `collect.ts`：把 `readJson<DefectRecord[]>(defects.json)` 替换为 `deriveDefects(runs, readEscapeTrailers(repoRoot))`(复用已读 runs,不重复扫描);移除 defects.json 读

## 4. 看板渲染

- [x] 4.1 `board.ts`：Defect 行分别显示 caught 数(标"当前 runtime")+ escaped 数(标"git 全历史")+ 率(null→"待埋点");单测精确断言两路径(有缺陷/无缺陷)

## 5. 约定 + 验证

- [x] 5.1 `pipeline/guides/agent-conventions.md`：补 `Defect-Escaped: <desc>` trailer 约定(格式、何时打、归人判定)
- [x] 5.2 lint + tsc + vitest 全绿
- [x] 5.3 变异级单测：`defects-feed.ts` + `defectEscapeRate` null 边界穷尽精确断言(metrics 包暂无 stryker——E4 未配,包级变异门另立基建)
- [x] 5.4 真实验证：构造一个含 `Defect-Escaped:` 的临时提交 + 一个含 fixRounds 的 run state.json → `npm run report` → 看板 caught/escaped 数 + 率正确;清空后回落"待埋点";验证毕清理临时提交/run

## 6. 收尾（规约同步 + 归档 + 提交）

- [x] 6.1 `openspec validate pipeline-defect-feed --strict` 通过
- [x] 6.2 更新 `pipeline/README.md`(metrics:Defect 已自动喂) 与 `docs/context/RESUME.md`(M4+ 续切片③ 完成)
- [x] 6.3 复盘要点并入 `docs/plan/M4plus-event-log-retro.md`
- [x] 6.4 `openspec archive pipeline-defect-feed` → `git commit` + `push`
