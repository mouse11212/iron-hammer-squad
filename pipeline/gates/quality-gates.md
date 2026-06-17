# 质量门模板（Sensors）

> 验证来源: M0(确定性 gate)、M1(变异门 + 分层) · 状态: active
> 当前以 Node+TS 为例;新栈在此扩展等价门。

## 分层（V4 §4.1 / Böckeler 时序）

| 门 | 何时跑 | 内容 | 性质 |
|---|---|---|---|
| **快 gate** | 每次改动 | lint + 类型检查 + 单测 | computational，毫秒~秒级，可实时跑 |
| **变异门** | **合并前 / 集成阶段** | 变异测试(测试有效性) | computational，较慢，合并前必过 |
| **Plan-Alignment gate** | 运行时(Hook) | 越界/复用/Never 规则 | 待 M1+/Hook 落地(占位) |

## 快 gate（模板）

- 配置:lint 规则设 `error`(非 warn)、禁滥用 inline-disable;类型 strict + noUncheckedIndexedAccess。
- 命令(fincards 实例):`npm run gate` = `lint && tsc --noEmit && vitest`。
- 通过判据:全绿。

## 变异门（模板，StrykerJS 实例）

- 工具:`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`。
- 配置要点(见 fincards `stryker.conf.json`):
  - `mutate`:**只变异纯逻辑模块**(排除网络 IO/组合层——变异 IO 意义低且慢)。
  - `thresholds.break`:设有意义的高位(实例 90;先测基线再定档,避免凭空设)。
- 流程:**先测基线 → 分析存活变异(真缺口 vs 等价) → 真缺口补测/重构杀死 → 等价变异带理由显式豁免(`// Stryker disable next-line <Mutator>: 理由`)**。
- 关键教训(M2-A):靠运行时偶然通过的存活变异(如比较器 NaN),**优先重构实现为确定性结构**,而非堆示例测试。
- 通过判据:变异分数 ≥ break;门有效性需自检(纳入未测文件→分数跌破→非零退出)。

## 反作弊（贯穿）

- 写测试 agent ≠ 写实现 agent;测试只读不可随意弱化;变更测试需独立记录与门禁(V4 §4.6)。

> 修正记录:Plan-Alignment gate(Hook)在 M1+ 落地后补全本表对应行。
