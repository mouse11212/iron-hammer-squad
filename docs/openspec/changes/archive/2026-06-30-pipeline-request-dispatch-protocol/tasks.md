## 1. OpenSpec change 脚手架

- [x] 1.1 建 change `2026-06-30-pipeline-request-dispatch-protocol`（proposal/specs/tasks/.openspec.yaml）
- [x] 1.2 `openspec validate 2026-06-30-pipeline-request-dispatch-protocol --strict` 通过 ✅（valid）

## 2. 产物1：分诊协议文档（prose，前馈 guide）

- [x] 2.1 `pipeline/guides/request-dispatch-protocol.md` §1 一级轨道分诊 + 13 角色对账表
- [x] 2.2 §2 二级工件状态判定 + 完整 SDLC 链（防跳步）
- [x] 2.3 §3 横切护栏（Ask-First/Never/反作弊/追溯链/阻塞升级）
- [x] 2.4 §4 精简注入版（≤40 行速查卡，供后续 hook）

## 3. 产物2：role 文件 skill 声明下沉（修根因1）

- [x] 3.1 dev-agent.md / test-agent.md / review-agent.md 加 `## 技能路由（V4 §4.2 对账）`段（补 superpowers + gstack）
- [x] 3.2 ui-agent.md 补 gstack(designer) + 标系统级/US 级两触发点
- [x] 3.3 design-soundness-agent.md / acceptance-agent.md 标「§4.2 表外补充角色」
- [x] 3.4 product-clarify-agent.md / security-review-agent.md 对账确认

## 4. V4 §4.2/§4.4 宪法回填（🔴 红线7，BOSS 已批 5 条）

- [x] 4.1 §4.2 回填 design-soundness / 验收 Agent（补 skill 列）
- [x] 4.2 §4.2 标注轨⑤ harness 自身工程轨（元层面）
- [x] 4.3 §4.2 新增 规划/拆分 Agent（Planner）
- [x] 4.4 §4.2 UX/UI 拆系统级 / US 级两触发点
- [x] 4.5 §4.4 新增 一致性 check 门（需求→设计→US/task 前后一致）

## 5. 判例验证（prose 穷尽兜底）

- [x] 5.1 设计 §9 的 8 判例逐条过协议，全命中（轨道/角色 == 应走；与 spec.md Requirement 1 的 8 个 Scenario 三方一致）
- [x] 5.2 driver vitest 322 / metrics vitest 100 全绿，零回归（无测试引用本次 prose 改动）

## 6. 收尾

- [ ] 6.1 commit 设计文档（现 untracked）+ change + 产物（军规2 分支、短命快合）
- [ ] 6.2 `openspec archive` 归档 change
