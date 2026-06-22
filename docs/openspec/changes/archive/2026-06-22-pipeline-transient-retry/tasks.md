## 1. 瞬时判别(纯,TDD)
- [x] 1.1 `invoke.ts` `isTransientApiError(text)`:匹配 socket/connection/timeout/overloaded/rate limit/5xx/closed unexpectedly 等;普通失败→false
- [x] 1.2 测试:典型瞬时串→true;普通失败/空串→false

## 2. makeRunPhase 重试(TDD)
- [x] 2.1 新会话 phase 瞬时错误有限重试(默认 2,退避,每次 fresh session-id);非瞬时不重试;resume 失败回退 fresh 也纳入重试
- [x] 2.2 maxRetries/sleep/isTransient 注入;测:瞬时后重试成功(用不同 id)/非瞬时不重试/耗尽仍失败/既有 resume 行为不破

## 3. 验证归档
- [x] 3.1 lint+tsc+vitest 全绿;变异门(若涉 mutate 文件)≥阈值
- [x] 3.2 README/RESUME + validate --strict → archive → commit + push
