## ADDED Requirements

### Requirement: 将新闻条目渲染为卡片 HTML 页面
系统 SHALL 提供一个纯函数，把 `NewsItem[]` 渲染为一个完整、自包含的 HTML 字符串（含 `<!DOCTYPE html>`），每条新闻一张卡片。该函数 MUST 无副作用、不读时钟、不写文件。

#### Scenario: 每条新闻渲染为一张卡片
- **WHEN** 传入 N 条 `NewsItem`
- **THEN** 输出 HTML 含 N 张卡片，每张展示 title、summary、pubDate（可读格式）、来源 "Bloomberg"

#### Scenario: 卡片标题链接跳回原文
- **WHEN** 渲染某条新闻
- **THEN** 卡片标题为指向该条 `link`（bloomberg.com 原文）的超链接，且**不内联展示正文全文**（仅标题+摘要，合规导流）

#### Scenario: 防注入转义
- **WHEN** 某条 title 或 summary 含 HTML 特殊字符（如 `<`、`&`、`"`）
- **THEN** 输出中这些字符被正确转义，不破坏页面结构、不产生注入

#### Scenario: 空列表
- **WHEN** 传入空数组
- **THEN** 输出合法 HTML 页面并显示"今日暂无新闻"之类占位提示，不报错
