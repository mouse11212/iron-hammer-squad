## ADDED Requirements

### Requirement: 变异测试审计纯逻辑的测试有效性
系统 SHALL 用 StrykerJS 对纯逻辑模块（`src/parse.ts`、`src/filterToday.ts`、`src/render.ts`）执行变异测试，运行现有 vitest 套件，产出变异分数（被杀死变异 / 总变异）。变异范围 MUST 排除 `fetch.ts`、`main.ts`、`types.ts`。

#### Scenario: 运行变异测试产出分数
- **WHEN** 执行 `npm run mutation`
- **THEN** Stryker 对三个纯逻辑模块生成变异体、运行 vitest、输出变异分数与存活变异清单

#### Scenario: 存活变异必须被处理
- **WHEN** 报告存在存活变异（survived mutant）
- **THEN** 该变异要么由新增/加强的测试杀死，要么在配置中以显式理由标注豁免，不得无视

### Requirement: 变异分数硬门阻止不达标合并
系统 SHALL 配置 Stryker 的 break threshold；当变异分数低于阈值时，`npm run mutation` MUST 以非零退出码失败，作为合并前的确定性门（V4 §4.6）。

#### Scenario: 达标通过
- **WHEN** 变异分数 ≥ 设定阈值
- **THEN** `npm run mutation` 退出码为 0（门通过）

#### Scenario: 不达标阻断
- **WHEN** 变异分数 < 设定阈值
- **THEN** `npm run mutation` 退出码非 0（门失败），阻止合并
