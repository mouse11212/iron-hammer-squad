# news-aggregate Specification

## Purpose
TBD - created by archiving change fincards-m2a-multisource-aggregate. Update Purpose after archive.
## Requirements
### Requirement: 合并多源新闻并按 link 去重
系统 SHALL 提供一个纯函数，把多个来源的 `NewsItem[]`（如多个 topic feed 各自解析的结果）合并为单一 `NewsItem[]`，并按 `link` 去重——同一 link 只保留一条。该函数 MUST 无副作用、不发起网络请求。

#### Scenario: 跨源重复按 link 去重
- **WHEN** 传入两个来源，且存在 link 相同的条目
- **THEN** 结果中该 link 只出现一次

#### Scenario: 不同 link 全部保留
- **WHEN** 传入的条目 link 互不相同
- **THEN** 结果包含全部条目（数量 = 各源条目之和）

### Requirement: 聚合结果按发布时间倒序
系统 SHALL 把聚合后的条目按 `pubDate` 从新到旧排序。Invalid Date 视为最旧，排在末尾，且不抛错。

#### Scenario: 按时间倒序
- **WHEN** 传入多条不同 pubDate 的条目
- **THEN** 结果按 pubDate 降序排列（最新在前）

#### Scenario: 含 Invalid Date 不报错
- **WHEN** 某条目 pubDate 为 Invalid Date
- **THEN** 该条目排在末尾，排序不抛错

### Requirement: 单源失败不拖垮聚合
系统 SHALL 在编排多源抓取时，对单个 feed 的失败保持韧性：跳过失败源，用成功源的结果继续，不因一个源失败而整体失败。

#### Scenario: 一个源失败其余成功
- **WHEN** 多个源中有一个抓取/解析失败
- **THEN** 聚合返回其余成功源的合并结果，并记录该失败（不抛出导致整体中断）

