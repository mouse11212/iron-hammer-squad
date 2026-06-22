## Why

③ 全链真 e2e 首跑撞**瞬时 API 错误**("socket connection closed unexpectedly")→ 测试 phase isError → job failed。瞬时网络/API 抖动是**可重试**的基础设施问题,不是模型/代码失败;当前当硬失败会让长跑流水线被随机网络抖动打断。本切片对 phase 瞬时错误做**有限重试**(区分基础设施抖动 vs 真失败)。

## What Changes

- 新增纯判别 `isTransientApiError(text)`:仅匹配明确瞬时信号(socket/connection/timeout/overloaded/rate limit/5xx/closed unexpectedly 等),不误判普通失败。
- `makeRunPhase` 对新会话 phase 的瞬时错误做有限重试(默认 2 次,退避;**每次换 fresh session-id**,避免同 id 残留冲突);非瞬时错误不重试。resume 失败仍回退 fresh(其瞬时错误也纳入重试)。
- maxRetries/sleep/isTransient 注入,确定性可测。

## Capabilities

### Modified Capabilities
- `inner-loop-orchestration`: phase 瞬时 API 错误有限重试(基础设施抖动不再当硬失败)。

## Impact

- **代码**:`invoke.ts` 加 `isTransientApiError`;`inner-loop-runner.ts` makeRunPhase 加重试。
- **真相源**:M5B-daemon-batch retro(③ 发现)、红线 6(区分可恢复 vs 需升级)。
- **不在本切片**:gate/集成层的重试;区分 429 退避策略细化。
