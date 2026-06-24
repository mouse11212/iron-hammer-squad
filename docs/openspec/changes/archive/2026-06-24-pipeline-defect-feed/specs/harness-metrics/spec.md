## ADDED Requirements

### Requirement: 从 inner-loop 运行与 git trailer 自动喂缺陷记录
系统 SHALL 提供纯函数,从已读好的 inner-loop 运行记录与 git `Defect-Escaped:` trailer 组装 `DefectRecord[]`,取代手维护 defects.json:**caught** = 每个 run 的 `fixRounds` 次回修各一条 + escalated 的 `residual` must-fix 各一条(`where:'caught'`);**escaped** = 每条 `Defect-Escaped:` trailer 一条(`where:'escaped'`,note=trailer 值)。每条记录 id 稳定可溯源(含 jobId/commit)。

#### Scenario: fixRounds 派生 caught
- **WHEN** 传入一个 `status:'done'`、`fixRounds:2` 的 run
- **THEN** 产出 2 条 `where:'caught'` 记录(回修轮各一),id 含该 jobId

#### Scenario: 干净 run 不产缺陷
- **WHEN** 传入一个 `fixRounds:0`、无 residual 的 done run
- **THEN** 不产出任何 caught 记录(harness 一次过=未抓到缺陷,不臆造)

#### Scenario: escalated 的 residual 计入 caught
- **WHEN** 传入一个 `status:'blocked-escalated'`、`fixRounds:1`、`residualCount:2` 的 run
- **THEN** 产出 1(回修)+ 2(residual)= 3 条 `where:'caught'` 记录(抓到即 caught,含升级未解的)

#### Scenario: trailer 派生 escaped
- **WHEN** 传入一条 `{commit:'abc123', desc:'卡片渲染漏 today 过滤'}` 的 escape trailer
- **THEN** 产出 1 条 `{where:'escaped', note:'卡片渲染漏 today 过滤'}`,id 含 commit

#### Scenario: 两侧皆空
- **WHEN** 无 run 且无 escape trailer
- **THEN** 产出空数组(不臆造历史记录)

### Requirement: Defect Escape Rate 总数为零时回落 null
系统 SHALL 在缺陷总数(caught+escaped)为 0 时令 `defectEscapeRate` 返回 `null`(沿用"待埋点"语义,不伪造 0%);总数>0 时返回 `escaped/总数`。看板 SHALL 分别显示 caught 数与 escaped 数并标注各自时间口径(caught=当前 runtime/ephemeral,escaped=git 全历史/持久);率为 null 时显示"待埋点"。

#### Scenario: 有缺陷 → 出真实率
- **WHEN** caught=3、escaped=1
- **THEN** `defectEscapeRate` = 1/4 = 0.25

#### Scenario: 无缺陷 → null
- **WHEN** caught=0、escaped=0
- **THEN** `defectEscapeRate` = null,看板该指标显示"待埋点"而非 0%

### Requirement: 采集时以自动派生缺陷替代手维护文件
系统 SHALL 在采集快照时从 `.runtime/runs/*/state.json` 与 `git log` 的 `Defect-Escaped:` trailer 自动派生 `DefectRecord[]` 填充 `MetricsSnapshot`,替代读取手维护 `data/defects.json`;复用既有 run 读取(不重复扫描)。

#### Scenario: 快照 defects 来自派生
- **WHEN** 采集快照
- **THEN** `MetricsSnapshot.defects` 的 caught/escaped 计数来自 run 派生 + trailer 挖采,不读 `data/defects.json`
