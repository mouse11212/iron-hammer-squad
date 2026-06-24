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
- **判定归人、采集归机**：是否算"逃逸"是人类质量判断（红线6）——只在确实溜过门、合并后才发现时才打；**不**给开发期 RED→GREEN、评审 must-fix 这类**合并前**就被拦截的缺陷打（那些是 `caught`，见下）。
- **不臆造**：拿不准是否逃逸 → 不打 trailer（宁可漏记不可伪造，红线1）。

### 拦截缺陷由系统自动打 trailer（人勿手动打）

- `caught`（合并前被评审/门拦截的缺陷）的 trailer 由 **driver 自动 emit**：done run squash 时据 `fixRounds` 写入 N 行 `Defect-Caught: inner-loop 回修轮 <k>`（`squash-message.ts`），随提交持久进 git。
- **人不要手动打 `Defect-Caught:`**——它是机器信号；caught 与 escaped 同从 `git log` 挖采（`defects-feed.ts` `mineTrailers`），两侧同口径持久，Defect Escape Rate 完全可比。
- **已知边界**：escalated run 无提交可挂 → 其 caught 不持久（升级人类处理）。

### Verification Tax 阶段耗时也由系统打 trailer（人勿手打）

- done run squash 时，driver 据本 run 各阶段耗时追加一行 `Metrics-Phase-Ms: <cat>=<ms> ...`（原始 op 分类耗时：dev/test/review/gate/orchestrator-fix，仅非零项），持久化 Verification Tax 的输入（`squash-message.ts`/`aggregate-phase-ms.ts`）。
- **只报原始事实，不预算 impl/verif**：哪类算"验证"是度量口径（D1），只活在 metrics（`events-tax.ts categorizeDuration`）。改口径时历史 trailer 自动按新口径重算——故 trailer 存未定性的原始分类耗时。
- **人勿手打 `Metrics-Phase-Ms:`**——机器信号；metrics 从 `git log` 挖采 → 还原最小事件 → 复用 D1 口径，VTax 持久且 fresh checkout 可复现。

### inner-loop 统计走持久 ledger（人只读勿手编）

- `docs/metrics/runs-ledger.jsonl` 是 **driver 机器 append** 的 run 账本（`run-ledger.ts`）：每个终态 run（done/failed/**blocked-escalated**）完成时追加一行 `{jobId,status,fixRounds,costUsd,ts}`。
- **为什么是 ledger 而非 trailer**：升级率/失败率需要 escalated/failed run，而它们**不产生提交**，git 无痕——trailer 持久不了"没提交的事"。ledger 是唯一出路。
- **固有性质**：ledger **持久但不可从 git 复现**（累积记录，非可推导）——这是非提交型信号的本性，不是缺陷。metrics 读时**按 jobId 去重**（后写覆盖，幂等）。
- **人只读勿手编**：它是机器账本；要清理只整行删除，勿改既有行的数字（会失真）。

## 安全约定（密钥扫描门 · M6-a）

- **绝不硬编码密钥/凭证**：API key、token、密码、私钥不得写进源码（用环境变量/密钥管理）。green 门含**密钥扫描**（`driver/secret-scan.ts`），扫本次改动 diff，命中 `ghp_`/`github_pat_`/AWS `AKIA`/PEM 私钥块/`api_key|secret|token|password = "…"` 即 **green 红**，须移除/参数化后才能交付。
- **合法例外用内联豁免（须带理由）**：确为非真密钥（测试夹具、文档示例）时，在命中行同行或紧邻上一行加 `// allowlist-secret: <理由>`（**空理由不豁免**，防滥用）。豁免是显式可审计的例外，**绝不为消除误报无理由弱化门**（同 Stryker `// Stryker disable` 纪律）。

> 修正记录：随技术栈扩展（如引入新语言/框架）在此追加对应约定。
