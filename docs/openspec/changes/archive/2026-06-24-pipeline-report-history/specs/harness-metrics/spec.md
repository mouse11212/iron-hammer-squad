## ADDED Requirements

### Requirement: 归档指标快照到历史
系统 SHALL 提供纯函数从 `MetricsSnapshot` 投影 slim 趋势记录(`{generatedAt, taskResolutionRate, verificationTax, defectEscapeRate, codeChurnTotal, resolved, attempted}`,不含 traces/taxByTrace 大字段),并提供薄 IO 把它 append 到持久 `docs/metrics/history.jsonl`(一行一 JSON)。归档为 opt-in(专用命令触发),普通看板生成不追加。

#### Scenario: 投影 slim 趋势记录
- **WHEN** 传入含 verificationTax=null、defectEscapeRate=0.25 的快照
- **THEN** 投影出 `{generatedAt, taskResolutionRate, verificationTax:null, defectEscapeRate:0.25, codeChurnTotal, resolved, attempted}`(保留 null,不臆造;不含大字段)

#### Scenario: 追加到历史
- **WHEN** opt-in 归档命令运行
- **THEN** history.jsonl 追加一行该快照的 slim 记录(append-only,不覆盖既有行)

### Requirement: 读取历史（薄 IO）
系统 SHALL 提供薄 IO 逐行 parse `history.jsonl`(跳畸形行),返回 `HistoryRecord[]`;缺文件返回 `[]`(不抛、不臆造)。

#### Scenario: 跳畸形行
- **WHEN** history.jsonl 含一行畸形 JSON 与两行合法记录
- **THEN** 返回 2 条合法记录

#### Scenario: 缺文件 → 空
- **WHEN** history.jsonl 不存在
- **THEN** 返回 `[]`

### Requirement: 看板渲染指标趋势
系统 SHALL 在 `renderBoard` 接受可选 history 参数:非空时渲染「指标趋势(最近 N=10 次归档)」表(generatedAt + 四 KPI,取最后 N 条);为空或不传时省略趋势区(既有无 history 调用零行为变化)。

#### Scenario: 有历史 → 渲染趋势表
- **WHEN** renderBoard 传入 12 条 history
- **THEN** 看板含趋势区,只渲染最近 10 条(取末 10)

#### Scenario: 无历史 → 省略
- **WHEN** renderBoard 不传 history 或传空数组
- **THEN** 看板不含趋势区(不臆造)
