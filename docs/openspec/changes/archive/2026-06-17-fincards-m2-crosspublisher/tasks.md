## 1. 编排准备

- [x] 1.1 用 `pipeline/roles/*.md` + 注入 `pipeline/guides/agent-conventions.md` 编排(dogfood E0);角色边界明确

## 2. 测试 Agent（先于实现）

- [x] 2.1 测试子 agent 据 `pipeline/roles/test-agent.md`：13 处改 `parse(xml,'Bloomberg')` + 新增 CNBC 归源用例；未碰 src；RED

## 3. 开发 Agent

- [x] 3.1 开发子 agent 据 `pipeline/roles/dev-agent.md`：`parse(xml,source)` 改签名；main 加 CNBC 源；未改测试；GREEN

## 4. 评审与门禁（orchestrator 集成）

- [x] 4.1 评审(orchestrator)：news-parse MODIFIED 对齐；归源/跨发布方去重正确；无越界
- [x] 4.2 快 gate 全绿(34 测试)
- [x] 4.3 变异门：All files / parse / aggregate **全 100%，0 存活**
- [x] 4.4 真实运行：Bloomberg×3 + CNBC 四源全 ok，120→去重 115→今日 57，卡片含各自来源

## 5. 收尾

- [x] 5.1 复盘(`docs/plan/M2-crosspublisher-retro.md`)：dogfood pipeline/ 反馈
- [x] 5.2 追溯链 + 归档 + 提交推送
