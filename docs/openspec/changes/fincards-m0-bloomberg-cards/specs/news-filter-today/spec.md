## ADDED Requirements

### Requirement: 筛选"今天"的新闻条目
系统 SHALL 提供一个纯函数，给定 `NewsItem[]` 与一个"参考今天"日期参数，返回 `pubDate` 落在该日（按指定时区的自然日）内的条目。今天日期作为**显式入参**传入（不在函数内部读系统时钟），以保证确定性可测。

#### Scenario: 保留当天条目、过滤其它日期
- **WHEN** 传入混合多天 pubDate 的条目与参考日期 D
- **THEN** 仅返回 pubDate 属于 D 自然日的条目，顺序保持输入顺序

#### Scenario: 当天无条目
- **WHEN** 没有任何条目的 pubDate 属于 D
- **THEN** 返回空数组 `[]`

#### Scenario: 边界时刻
- **WHEN** 条目 pubDate 恰为 D 当日 00:00:00 或 23:59:59（指定时区）
- **THEN** 该条目被视为属于当天并保留
