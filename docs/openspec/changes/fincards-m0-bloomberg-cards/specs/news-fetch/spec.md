## ADDED Requirements

### Requirement: 拉取 Bloomberg 官方 RSS 原始内容
系统 SHALL 通过 HTTPS GET 从 Bloomberg 官方 RSS 端点（`https://feeds.bloomberg.com/markets/news.rss`）获取原始 feed 文本，并作为薄 IO 边界隔离网络的非确定性——该模块只负责取回字节，不做解析。

#### Scenario: 成功取回 feed
- **WHEN** 调用 fetch 且端点返回 HTTP 200 与 RSS 文本
- **THEN** 系统返回该原始 XML 字符串，且不对其做解析或改写

#### Scenario: 端点返回非 200
- **WHEN** 端点返回非 200 状态（如 403/404/5xx）
- **THEN** 系统抛出带状态码与端点信息的错误，不返回空字符串冒充成功

#### Scenario: 网络超时或不可达
- **WHEN** 请求在设定超时内未完成或网络不可达
- **THEN** 系统抛出可识别的网络错误，由上层 main 记入 run log 的失败状态
