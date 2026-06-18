import { describe, it, expect } from 'vitest';
import { openQueue } from '../src/queue-sqlite.js';

const req = (id: string) => ({ id, kind: 'inner-loop', prompt: `do ${id}` });

describe('queue-sqlite 核心操作（内存 db，确定性）', () => {
  it('enqueue 幂等:同 id 第二次入队被忽略', () => {
    const q = openQueue();
    expect(q.enqueue(req('a'))).toBe(true);
    expect(q.enqueue(req('a'))).toBe(false); // 去重
    expect(q.counts().queued).toBe(1);
    q.close();
  });

  it('已终态 id 再入队不复活', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    const c = q.claim('w1');
    q.ack(c!.id, 'w1');
    expect(q.status('a')).toBe('done');
    expect(q.enqueue(req('a'))).toBe(false); // 忽略
    expect(q.status('a')).toBe('done'); // 仍 done,不回 queued
    q.close();
  });

  it('claim 按 FIFO 取且每条只认领一次;空队列返回 null', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    q.enqueue(req('b'));
    const first = q.claim('w1');
    const second = q.claim('w1');
    expect([first?.id, second?.id]).toEqual(['a', 'b']);
    expect(first?.worker).toBe('w1');
    expect(q.claim('w1')).toBeNull(); // 抽干
    q.close();
  });

  it('claim 后请求转 running,counts 反映', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    q.claim('w1');
    expect(q.status('a')).toBe('running');
    expect(q.counts()).toMatchObject({ queued: 0, running: 1 });
    q.close();
  });

  it('ack 仅对本 worker 持有的 running 生效', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    q.claim('w1');
    expect(q.ack('a', 'w2')).toBe(false); // 非持有者
    expect(q.status('a')).toBe('running');
    expect(q.ack('a', 'w1')).toBe(true);
    expect(q.status('a')).toBe('done');
    q.close();
  });

  it('fail 落 failed + 错误信息', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    q.claim('w1');
    expect(q.fail('a', 'w1', 'boom')).toBe(true);
    expect(q.status('a')).toBe('failed');
    q.close();
  });

  it('ack/fail 对未认领(queued)请求无效', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    expect(q.ack('a', 'w1')).toBe(false);
    expect(q.fail('a', 'w1', 'x')).toBe(false);
    expect(q.status('a')).toBe('queued');
    q.close();
  });

  it('recover 把残留 running 回收为 queued 可重新认领', () => {
    const q = openQueue();
    q.enqueue(req('a'));
    q.enqueue(req('b'));
    q.claim('w1');
    q.claim('w1'); // a,b 都 running
    expect(q.counts().running).toBe(2);
    expect(q.recover()).toBe(2);
    expect(q.counts()).toMatchObject({ queued: 2, running: 0 });
    expect(q.claim('w2')?.id).toBe('a'); // 可重新认领
    q.close();
  });

  it('status 未知 id 返回 undefined', () => {
    const q = openQueue();
    expect(q.status('nope')).toBeUndefined();
    q.close();
  });
});
