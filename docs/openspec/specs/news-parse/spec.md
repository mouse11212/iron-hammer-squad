# news-parse Specification

## Purpose
TBD - created by archiving change fincards-m0-bloomberg-cards. Update Purpose after archive.
## Requirements
### Requirement: 将 RSS XML 解析为结构化新闻条目
系统 SHALL 提供一个纯函数，把 RSS XML 字符串解析为 `NewsItem[]`，每个 `NewsItem` 含 `title`、`link`、`pubDate`（解析为 Date 或 ISO 字符串）、`summary`（来自 description）、`source`（固定为 "Bloomberg"）。该函数 MUST 无副作用、不发起网络请求，便于对录制样本做确定性测试。

#### Scenario: 解析含多条 item 的正常 feed
- **WHEN** 传入含 N 条 `<item>` 的合法 RSS（如录制样本 `fixtures/bloomberg-markets.rss`）
- **THEN** 返回长度为 N 的 `NewsItem[]`，每条的 title/link/pubDate/summary 与对应 `<item>` 字段一致，source 为 "Bloomberg"

#### Scenario: 空 feed（合法结构但无 item）
- **WHEN** 传入合法 RSS 但不含任何 `<item>`
- **THEN** 返回空数组 `[]`，不抛错

#### Scenario: 缺失可选字段的 item
- **WHEN** 某 `<item>` 缺少 description
- **THEN** 该条 `summary` 取空字符串，其余字段正常解析，不丢弃该条

#### Scenario: 畸形 XML
- **WHEN** 传入无法解析的畸形 XML
- **THEN** 抛出可识别的解析错误，不返回部分污染的结果

