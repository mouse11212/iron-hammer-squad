import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Request, RunState } from './types.js';

/** 外置状态根目录下的子目录。 */
export interface Store {
  queue: string;
  state: string;
  done: string;
  failed: string;
}

export function makeStore(root: string): Store {
  const s: Store = {
    queue: join(root, 'queue'),
    state: join(root, 'state'),
    done: join(root, 'done'),
    failed: join(root, 'failed'),
  };
  for (const d of Object.values(s)) mkdirSync(d, { recursive: true });
  return s;
}

/** 列出队列中的请求(文件投递 = 事件)。 */
export function listQueued(s: Store): { req: Request; path: string }[] {
  return readdirSync(s.queue)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const path = join(s.queue, f);
      return { req: JSON.parse(readFileSync(path, 'utf8')) as Request, path };
    });
}

export function readState(s: Store, id: string): RunState | undefined {
  const p = join(s.state, `${id}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as RunState) : undefined;
}

export function writeState(s: Store, st: RunState): void {
  writeFileSync(join(s.state, `${st.id}.json`), JSON.stringify(st, null, 2), 'utf8');
}

export function readAllStates(s: Store): RunState[] {
  return readdirSync(s.state)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(s.state, f), 'utf8')) as RunState);
}

/** 处理完把请求文件归档到 done/ 或 failed/。 */
export function archiveRequest(s: Store, path: string, fileName: string, status: 'done' | 'failed'): void {
  renameSync(path, join(status === 'done' ? s.done : s.failed, fileName));
}
