## Why

到 E0 为止 `pipeline/` 全是"给 orchestrator 手动消费的组件"，没有可自己跑的引擎(① Loop 层)。M3/E3 造第一块**可运行的事件触发 + `claude -p` 循环驱动**——让流水线从"手动调度"迈向"事件来了自动跑"，是 `pipeline/` 成为可安装插件的关键前置。

## What Changes

- 新增 `pipeline/driver/`(Node+TS，与项目同栈)：**事件队列驱动**。
- **事件模型(D4 事件触发)**：向 `queue/` 投递请求文件 = 事件(由 fs.watch 触发，非定时轮询)；将来 git hook(commit/merge/门禁失败)可投递同类事件。
- **`claude -p` 薄边界**：`invoke.ts` 包裹 `claude --print` 无头调用，可注入替身以便确定性测试。
- **状态外置 + 幂等 + 可恢复**：每个请求一份外置 run-state(queued→running→done/failed)；已 done 不重跑(幂等)；启动时回收残留 running(崩溃恢复)。
- 确定性核心(队列选取/状态机/恢复)用 stub 测进 gate；真实 `claude -p` 做一次冒烟(不进确定性 gate)。

## Capabilities

### New Capabilities
- `event-driver`: 以文件队列为事件源，驱动 `claude -p` 执行流水线步骤，状态外置、幂等、崩溃可恢复。

## Impact

- 新增 `pipeline/driver/`(自带 package.json/tsconfig/eslint/vitest，复用项目约定与质量门)。
- 依赖 `claude` CLI(无头 `-p`)；无新运行时 npm 依赖(用 node 内置 child_process/fs)。
- E3 抽取：本驱动即 ① Loop 层第一块根目录可运行引擎，纳入 `pipeline/`。
