import { watch } from 'node:fs';
import { basename } from 'node:path';
import type { InvokeFn } from './types.js';
import { makeStore, listQueued, readState, writeState, readAllStates, archiveRequest, type Store } from './store.js';
import { recover } from './state.js';
import { runOnce } from './run-once.js';
import { makeClaudeInvoke } from './invoke.js';

/** 启动恢复：把残留 running 回收为 queued 并落盘。 */
export function recoverStates(store: Store): void {
  for (const s of recover(readAllStates(store))) writeState(store, s);
}

/** 处理当前队列里的所有请求一遍(事件到达时调用)。 */
export async function drainOnce(store: Store, invoke: InvokeFn): Promise<void> {
  for (const { req, path } of listQueued(store)) {
    const prior = readState(store, req.id);
    const final = await runOnce(req, prior, invoke, (s) => writeState(store, s));
    archiveRequest(store, path, basename(path), final.status === 'done' ? 'done' : 'failed');
    console.log(`[driver] ${req.id} → ${final.status}`);
  }
}

/** 事件驱动循环:启动恢复 + 先 drain 一遍 + fs.watch 监听新投递。 */
export async function drive(root: string, invoke: InvokeFn = makeClaudeInvoke()): Promise<Store> {
  const store = makeStore(root);
  recoverStates(store);
  await drainOnce(store, invoke);
  let draining = false;
  watch(store.queue, () => {
    if (draining) return;
    draining = true;
    void drainOnce(store, invoke).finally(() => {
      draining = false;
    });
  });
  console.log(`[driver] watching ${store.queue}`);
  return store;
}

// 直接运行时启动驱动(root 默认 pipeline/.runtime)。
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? new URL('../../.runtime', import.meta.url).pathname;
  void drive(root);
}
