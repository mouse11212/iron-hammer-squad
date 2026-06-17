# M2 收尾复盘（fincards-m2-crosspublisher）

> 日期 2026-06-17。完成 M2 真·多源(跨发布方),首次 **dogfood E0 抽取的 `pipeline/` 角色**。

## 交付

- `parse(xml, source)` 按发布方归源(MODIFIED news-parse);main 接入 **CNBC** 跨发布方源。
- 真实四源(Bloomberg markets/economics/technology + CNBC)全 ok:120 → 去重 115 → 今日 57。
- 快 gate 34 测试全绿;变异门 **All files / parse / aggregate 全 100%、0 存活**。

## dogfood `pipeline/` 反馈(关键)

**E0 抽取的角色模板 + 共享 Guide 真的起作用了:**
- 测试 Agent / 开发 Agent 各自读 `pipeline/roles/*.md` + `pipeline/guides/agent-conventions.md`,**边界零违反**(测试只动 test、开发只动 src)。
- **Steering Loop 闭环验证**:M2-A 的教训是"测试 Agent 漏写 `!` 被 tsc 顶出";该教训已抽取进 `agent-conventions.md`(noUncheckedIndexedAccess→`!` 约定)。本次测试 Agent **遵守了该约定、未再漏 `!`**,开发 Agent 报告 tsc 一次干净、无需升级——**同类错误结构性地没有重犯**。这正是 §2 反馈固化要的效果:把修复编码进 Guide,使错误不再重现。

## 对 `pipeline/` 的修正(抽取≠冻结)

- 本次未发现角色模板缺陷,无需修正;`product-clarify-agent` 本切片未用(无新需求澄清)。
- 一个增量经验:跨发布方接入只需"parse 归源参数 + main 加源",aggregate/render 零改 —— 印证 M0 分层(薄 IO + 纯函数)的扩展性。可在 `pipeline/workflows/inner-loop.md` 补一句"加新数据源=源参数+配置,核心逻辑不动"。(留作下次修正)

## 追溯链

spec `fincards-m2-crosspublisher`(MODIFIED news-parse)→ test(parse.test.ts 归源)→ 实现(parse/main)→ commit(待提交)。

## M2 整体收口

M2 = B(需求澄清)+ A(Bloomberg 多 topic 聚合 + Planner-Workers-Judge)+ 跨发布方(CNBC)。多角色编排已验证且已抽取为可复用 `pipeline/`,并在本次 dogfood 中证明有效。
