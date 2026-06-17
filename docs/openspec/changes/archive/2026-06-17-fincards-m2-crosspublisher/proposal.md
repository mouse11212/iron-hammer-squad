## Why

M2-A 只聚合了 Bloomberg **自家多个 topic**，不是真·多源。需求澄清(M2-B)里"多源聚合"是用户第一优先级。本切片完成 M2:接入**跨发布方**源(CNBC)，让聚合真正跨发布方。同时**用 E0 抽取的 `pipeline/` 角色编排**(dogfood)。

## What Changes

- `news-parse` 的 `source` 字段从写死 `"Bloomberg"` 改为**按源标注**(parse 接收 source 名参数)。**BREAKING**(parse 签名变化，影响既有调用与测试)。
- main 的 FEEDS 增加 **CNBC**(`https://www.cnbc.com/id/100003114/device/rss/rss.html`，实测 200/30 条)并为每源带 source 名;各源 parse 时传入对应 source。
- 聚合(news-aggregate)已支持多源/去重/排序，无需改;跨发布方同story不同link → 各自保留(预期)。
- render 已展示 source，跨发布方卡片自动显示各自来源。

## Capabilities

### Modified Capabilities
- `news-parse`: `source` 由硬编码改为调用方传入(按发布方标注)，使多发布方聚合可正确归源。

## Impact

- `src/parse.ts` 签名变 `parse(xml, source)`；`src/main.ts` FEEDS 带 source + CNBC；`test/parse.test.ts` 既有用例需传 source。
- 复用 M1 变异门、M2 aggregate;过快 gate + 变异门。
- 编排:用 `pipeline/roles/{test-agent,dev-agent}.md` 模板 spawn 子 agent(测试≠实现)，orchestrator 集成评审(dogfood E0)。
