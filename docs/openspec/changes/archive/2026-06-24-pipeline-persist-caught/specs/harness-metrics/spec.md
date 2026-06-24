## MODIFIED Requirements

### Requirement: 从 inner-loop 运行与 git trailer 自动喂缺陷记录
系统 SHALL 提供纯函数,从 git trailer 组装 `DefectRecord[]`,取代手维护 defects.json:**caught** = 每条 `Defect-Caught:` trailer 一条(`where:'caught'`);**escaped** = 每条 `Defect-Escaped:` trailer 一条(`where:'escaped'`,note=trailer 值)。caught 与 escaped 同源于 git(持久、同口径),两侧每行一记录对称处理。每条记录 id 稳定可溯源(含 commit)。

#### Scenario: caught trailer 派生
- **WHEN** 传入一条 `{commit:'abc1234', desc:'inner-loop 回修轮 1'}` 的 caught trailer
- **THEN** 产出 1 条 `{where:'caught', note:'inner-loop 回修轮 1'}`,id 含 commit

#### Scenario: escaped trailer 派生
- **WHEN** 传入一条 `{commit:'def5678', desc:'卡片渲染漏 today 过滤'}` 的 escape trailer
- **THEN** 产出 1 条 `{where:'escaped', note:'卡片渲染漏 today 过滤'}`,id 含 commit

#### Scenario: 两侧皆空
- **WHEN** 无 caught 且无 escaped trailer
- **THEN** 产出空数组(不臆造)

### Requirement: 采集时以自动派生缺陷替代手维护文件
系统 SHALL 在采集快照时从 `git log` 挖采 `Defect-Caught:` 与 `Defect-Escaped:` trailer 自动派生 `DefectRecord[]` 填充 `MetricsSnapshot`,替代读取手维护 `data/defects.json` 与切片③ 的 inner-loop runtime run 派生(已被持久 trailer 取代)。

#### Scenario: 快照 defects 来自 git trailer
- **WHEN** 采集快照
- **THEN** `MetricsSnapshot.defects` 的 caught/escaped 计数均来自 git trailer 挖采(同口径持久),不读 `data/defects.json`、不依赖 `.runtime/runs`

## ADDED Requirements

### Requirement: 通用 git trailer 挖采
系统 SHALL 提供薄 IO 通用函数,从 `git log` 挖采指定 key 的 trailer(逐行匹配 `<key>: <value>`),返回 `{commit, desc}[]`;git 失败返回空数组(不抛、不臆造)。caught 与 escaped 挖采复用此函数。

#### Scenario: 挖采指定 key
- **WHEN** 仓库有一个含 `Defect-Caught: 回修轮 1` 的提交,挖采 key `Defect-Caught`
- **THEN** 返回含该 `{commit, desc:'回修轮 1'}` 的数组

#### Scenario: git 失败 → 空
- **WHEN** git 命令失败(非仓库等)
- **THEN** 返回 `[]`(不抛)
