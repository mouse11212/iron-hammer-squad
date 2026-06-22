# 复盘:phase 瞬时 API 错误有限重试(harness 硬化)

> 日期 2026-06-22 · change `2026-06-22-pipeline-transient-retry` · 来源:③ e2e 暴露 · 红线 6(区分可恢复 vs 升级)

## 交付

- `isTransientApiError(text)`(纯):仅匹配明确瞬时信号(socket/connection/timeout/overloaded/rate limit/5xx/closed unexpectedly),不误判普通失败。12 测试。
- `makeRunPhase` 重试:新会话 phase 瞬时错误有限重试(默认 2,线性退避,**每次 fresh session-id** 避免同 id 残留冲突);非瞬时不重试;resume 失败回退 fresh 的瞬时错误也纳入重试。maxRetries/sleep/isTransient 注入,3 测试。
- driver gate 139 + 变异门 93.07%。

## 关键决策

- **只重瞬时,不重真失败**:误重普通失败会浪费、掩盖 bug。判别只认明确基础设施信号。
- **重试换 fresh session-id**:瞬时错误可能已残留半个 session,同 `--session-id` 重试会冲突;复用 resume-fallback 的"换 fresh"机制。
- **区分层次**:瞬时=基础设施抖动(自动重试);gate 红/must-fix=模型/代码问题(回修/升级)。各归其位(红线 6)。

## 闭环

③ e2e 首跑因瞬时 socket 错误 job failed → 本切片把这类抖动变为自动重试 → 长跑流水线不再被随机网络抖动打断。Steering Loop:真实失败→诊断→固化进 harness。
