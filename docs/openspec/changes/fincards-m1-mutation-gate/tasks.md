## 1. 接入 StrykerJS

- [x] 1.1 在 fincards 安装开发依赖：`@stryker-mutator/core`、`@stryker-mutator/vitest-runner`（9.6.1）
- [x] 1.2 创建 `stryker.conf.json`：testRunner=vitest，mutate 仅含 `src/parse.ts`、`src/filterToday.ts`、`src/render.ts`
- [x] 1.3 加 `npm run mutation` 脚本

## 2. 基线测量

- [x] 2.1 运行 `npm run mutation`，记录基线：总分 67.21%（parse 66.67% / render 56.52% / filterToday 100%），16 存活
- [x] 2.2 在复盘文档记录基线分数（`docs/plan/M1-retro.md`）

## 3. 杀死存活变异（强化测试）

- [x] 3.1 逐个分析存活变异：区分真弱测试 vs 等价变异
- [x] 3.2 补强 parse/render 单测（13→24 测试），杀死字段映射/可选链/转义/日期格式/NaN守卫等弱点
- [x] 3.3 对 2 个等价变异（ignoreAttributes、pubDate 回退串）在源码以理由显式豁免

## 4. 设硬门

- [x] 4.1 设 `thresholds.break=90`；清理后有效变异分数 100%（59/59 非等价变异被杀）
- [x] 4.2 门有效性自检：纳入未测文件→分数跌破阈值→退出码 1（门正确拦截）

## 5. 收尾

- [x] 5.1 fincards README 说明 gate 分层（快 gate 每次 / 变异门合并前）
- [x] 5.2 复盘 `docs/plan/M1-retro.md`：3 条 M2 候选；追溯链已记
