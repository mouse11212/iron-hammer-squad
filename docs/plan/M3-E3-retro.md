# M3 + E3 复盘（pipeline-m3-event-driver）

> 日期 2026-06-17。M3=事件触发+`claude -p` 循环驱动;E3=抽取为 `pipeline/driver/`(① Loop 层第一块可运行引擎)。对应 V4 §3(D4)、§3.1。

## 交付

- `pipeline/driver/`(Node+TS):事件队列(文件投递=事件,fs.watch)→ 驱动 → 薄边界调 `claude --print` → 外置 run-state → 幂等 + 崩溃恢复。
- 确定性核心(state/run-once)8 测试全绿(注入 invoke 替身);快 gate 全绿。
- **真实 `claude -p` 实跑验证**:事件→驱动→done(~4s);幂等(已 done 复投→0 次 claude 调用)。

## 里程碑意义

`pipeline/` 第一次有了**会自己跑的引擎**——此前全是"给 orchestrator 手动消费的组件"。这是 ① Loop 层从 0 到 1,也是"可安装插件"目标的关键前置。

## 真实失误 → 固化（Steering Loop）

- **`claude --print` 等待 stdin 挂死**:首次冒烟,子进程未关 stdin,claude 等 stdin 3s 后拿空输入、跑 120s 被杀(failed)。根因:无头调用必须显式不喂 stdin。**修复:`spawn(..., {stdio:['ignore','pipe','pipe']})`**,prompt 走位置参数。→ 这是 `claude -p` 集成的通用坑,应在将来"driver 集成指南"里固化(候选:写进 `pipeline/guides/`)。
- **验证方式**:把不确定性(claude 调用)隔离在 `invoke.ts` 薄边界,核心用替身确定性测试——延续 M0 "薄 IO + 纯核心" 模式,使引擎自身也可测。

## 待完善（→ 后续抽取）

1. driver 现在执行"按请求 prompt 调一次 claude";**下一步**把单步接到 `workflows/` 全流程(事件自动拉起 测试→开发→评审 多角色编排),实现端到端自动。
2. 事件源现为文件投递;可加 **git hook**(commit/merge/门禁失败 → 投递请求)作为真实 SDLC 事件(D4)。
3. 并发/锁(多请求并行)、超时/重试策略 → 与 M5(消息组件)合流。

## 追溯链

spec `pipeline-m3-event-driver` → test(state/run-once)→ 实现(driver/*)→ 真实冒烟 → commit(待提交)。
