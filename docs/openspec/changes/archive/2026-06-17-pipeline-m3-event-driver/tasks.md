## 1. 脚手架

- [x] 1.1 `pipeline/driver/` 初始化 Node+TS(复用 fincards tsconfig/eslint 约定)
- [x] 1.2 `src/types.ts`：Request、RunState、InvokeResult、InvokeFn

## 2. 确定性核心（test-first）

- [x] 2.1 状态机测试 `state.test.ts`：成功/失败/幂等/恢复，RED
- [x] 2.2 实现 `state.ts`(纯转移:startRun/completeRun/isTerminal/recover)使绿
- [x] 2.3 `run-once.test.ts`(注入 invoke 替身)：成功→done/失败→failed/已 done 跳过 → 实现 `run-once.ts` 使绿（8 测试全绿）

## 3. claude -p 薄边界 + 循环

- [x] 3.1 `invoke.ts`：封装 `claude --print`(child_process，stdin=ignore 避免等待)，可注入替身
- [x] 3.2 `store.ts`(队列/状态文件 IO) + `loop.ts`(启动恢复 + drainOnce + fs.watch)
- [x] 3.3 入口 `bin-enqueue.ts`(投递请求) + `drive`/`enqueue` npm 脚本

## 4. 门禁 + 冒烟

- [x] 4.1 快 gate 全绿(lint+tsc+vitest，8 测试，确定性核心用替身)
- [x] 4.2 真实冒烟：投递→驱动→**真实 `claude -p` 执行成功→run-state done(~4s)**；修复 stdin 等待问题；**幂等验证(已 done 复投→0 次 claude 调用)**

## 5. E3 抽取 + 收尾

- [x] 5.1 driver 落 `pipeline/driver/`；README + orchestration-pwj 更新(手动→已有自动驱动)；`.runtime/` 入 gitignore
- [x] 5.2 复盘 + 追溯链 + 归档 + 提交推送
