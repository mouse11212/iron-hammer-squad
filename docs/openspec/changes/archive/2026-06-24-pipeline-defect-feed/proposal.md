## Why

Defect Escape Rate 是 harness 四指标里**最贴近本项目命题**的一个——直接度量"质量门是否把缺陷拦在放大之前"(对抗 agent drift)。但当前 `metrics/data/defects.json` 是手维护(3 条,全 `caught`,停在 M3),和刚根治的 traces.json 同病:必然漂移、靠人记得记。本切片把缺陷记录从手维护改为**自动喂**:`caught` 从 inner-loop 运行信号确定性派生,`escaped` 从 git commit trailer 显式标记挖采——逃逸判定归人(红线6)、采集归机器、零臆造(红线1)。

## What Changes

- 新增 `metrics/src/defects-feed.ts`:**纯函数** `deriveDefects(runs, escapes): DefectRecord[]` + **薄 IO** `readEscapeTrailers(repoRoot)`(跑 `git log` 挖 `Defect-Escaped:` trailer)。
- **caught 派生**:每个 inner-loop run(`.runtime/runs/<jobId>/state.json`)的 `fixRounds` 次回修(评审/门抓到并热修)+ escalated 的 `residual` must-fix(抓到但升级未解),各算一条 `where:'caught'` DefectRecord(确定性;ephemeral——反映当前 runtime,同 Verification Tax)。
- **escaped 派生**:`git log` 挖 commit trailer `Defect-Escaped: <desc>`(持久),每条算一条 `where:'escaped'` DefectRecord。
- `collect.ts`:把 `readJson<DefectRecord[]>(defects.json)` 替换为 `deriveDefects(runs, readEscapeTrailers(repoRoot))`;复用既有 `readInnerLoopRuns`(扩 `residualCount`),不重复读 runs。
- **口径对齐/诚实退化**:看板分别显示 caught 数(标"当前 runtime")+ escaped 数(标"git 全历史");`defectEscapeRate` 仅当 defect 总数>0 才算率,否则回落 `null`("待埋点",不伪造 0%/100%)。caught(ephemeral)/escaped(persistent) 的时间口径不对称作为已知限制标注,指向未来"持久化指标存储"切片。
- `pipeline/guides/agent-conventions.md`:补 `Defect-Escaped:` trailer 约定(格式 + 何时打)。

## Capabilities

### New Capabilities
<!-- 无:不引入新 capability。 -->

### Modified Capabilities
- `harness-metrics`: 新增 Requirement「自动喂缺陷记录」——缺陷从"手维护静态 defects.json"演进为"caught 从 inner-loop run 确定性派生 + escaped 从 git trailer 挖采";`defectEscapeRate` 纯函数签名不变,但新增"总数为 0 回落 null"的诚实语义。既有「计算四指标」「渲染看板」Requirement 的 defectEscapeRate 算法不动。

## Impact

- **新增**:`pipeline/metrics/src/defects-feed.ts` + 测试。
- **修改**:`metrics/src/collect.ts`(defects 来源由读文件改派生)、`types.ts`(InnerLoopRunRecord 加 `residualCount?`;新增 `EscapeTrailer`;`defectEscapeRate` 改返回 `number|null`)、`compute.ts`(defectEscapeRate 总数 0→null)、`board.ts`(分别渲染 caught/escaped 数 + scope 标注 + 率 null 时"待埋点")、`pipeline/guides/agent-conventions.md`。
- **数据源契约**:caught 读 `.runtime/runs/*/state.json`(ephemeral);escaped 读 `git log` trailer(持久)。metrics 不 import driver。
- **范围(YAGNI/红线3 从窄到宽)**:本切片只做 metrics 包内的**采集+度量**(sensor)。**不**改 driver 自动 emit `Defect-Caught:` trailer(把 caught 也持久化=后续"持久化存储"切片);**不**做 escaped 启发式推断(只认显式 trailer)。
- **固有限制**:caught ephemeral(清空 .runtime 后归 0),escaped persistent——率仅在两侧同窗时完全可比;历史 3 条手维护 caught 无机器源,不重建(留 git 历史)。
