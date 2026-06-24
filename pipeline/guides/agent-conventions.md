# 共享约定 Guide（注入所有角色 agent）

> 验证来源: M2-A（复盘发现:测试 Agent 因不知项目约定漏写 `!`，被 tsc 顶出）
> 状态: active · 前馈 Guide（V4 §4.1）——随每个角色 spawn 一并注入，使首次产出即合规

## 为什么存在

子 agent 在隔离上下文里工作，**默认不知道项目约定**。把约定做成前馈 Guide 注入，比事后让 sensor/评审反复纠正更省（提高首次产出质量）。

## 通用约定

- **求真**：不臆造无来源的数字/事实/决策；不确定就升级，不硬编。
- **文件边界**：严格只动被授权的文件（见各角色 `roles/*.md` 的边界声明）；越界即违规。
- **不绕过门**：不滥用 inline-disable / `eslint-disable` / `@ts-ignore` 抑制问题；要么修，要么带理由显式豁免（如 Stryker 等价变异）。

## 技术栈约定（当前 fincards / Node+TS；新栈需在此扩展）

- TypeScript **strict + `noUncheckedIndexedAccess`**：索引访问后用 `!` 断言或显式判空（项目惯例 `items[0]!`）。
- ESM + `.js` 导入后缀；测试用 vitest；纯逻辑与 IO 分层（薄 IO 边界 + 纯函数）。
- 确定性优先：需要被测试/变异覆盖的逻辑写成纯函数，把网络/时钟/随机隔离到边界（参考 fincards `fetch.ts` vs `parse.ts`）。

## 测试约定

- 写测试的 agent ≠ 写实现的 agent（结构性反作弊，V4 §4.6）。
- 断言具体、可判定；不写永真/空测试。
- 遇"靠运行时偶然通过"的弱点（如比较器 NaN），**优先重构实现为确定性结构**，而非堆示例测试（M2-A 教训）。

## 缺陷标记约定（Defect Escape Rate 自动喂）

- **逃逸缺陷打 trailer**：发现某缺陷是**合并/交付后**才暴露（溜过了所有质量门）时，在修复它的 commit 末尾加 git trailer：
  ```
  Defect-Escaped: <一句话描述该逃逸缺陷>
  ```
  metrics 看板会 `git log` 自动挖采这些 trailer 计入 Defect Escape Rate 的逃逸数（`metrics/defects-feed.ts`）。
- **判定归人、采集归机**：是否算"逃逸"是人类质量判断（红线6）——只在确实溜过门、合并后才发现时才打；**不**给开发期 RED→GREEN、评审 must-fix 这类**合并前**就被拦截的缺陷打（那些是 `caught`，由 inner-loop 运行信号自动派生，无需手标）。
- **不臆造**：拿不准是否逃逸 → 不打 trailer（宁可漏记不可伪造，红线1）。

> 修正记录：随技术栈扩展（如引入新语言/框架）在此追加对应约定。
