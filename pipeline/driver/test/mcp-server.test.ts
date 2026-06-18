import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildQueueMcpServer } from '../src/mcp-server.js';
import { openQueue, type Queue } from '../src/queue-sqlite.js';

/** 连一对 in-memory client/server,共享同一个 queue,返回 client。 */
async function connect(queue: Queue): Promise<Client> {
  const server = buildQueueMcpServer(queue);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

/** 调用工具并解析其 JSON 文本结果。 */
async function call(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
  };
  return JSON.parse(res.content[0]!.text);
}

describe('queue MCP server(in-memory client/server,薄封装一致性)', () => {
  it('暴露 5 个工具', async () => {
    const q = openQueue();
    const client = await connect(q);
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(['ack', 'claim', 'enqueue', 'fail', 'status']);
    q.close();
  });

  it('经 MCP enqueue → status 返回 queued,且与核心函数结果一致', async () => {
    const q = openQueue();
    const client = await connect(q);

    expect(await call(client, 'enqueue', { id: 'a', kind: 'inner-loop', prompt: 'p' })).toEqual({
      enqueued: true,
    });
    // 幂等:MCP 二次入队与核心一致(false)
    expect(await call(client, 'enqueue', { id: 'a', kind: 'inner-loop', prompt: 'p' })).toEqual({
      enqueued: false,
    });
    // MCP status 与直接调 queue.status 一致
    expect(await call(client, 'status', { id: 'a' })).toEqual({ status: 'queued' });
    expect(q.status('a')).toBe('queued');
    q.close();
  });

  it('经 MCP 完成一条完整生命周期 enqueue→claim→ack', async () => {
    const q = openQueue();
    const client = await connect(q);
    await call(client, 'enqueue', { id: 'a', kind: 'x', prompt: 'p' });

    const claimed = (await call(client, 'claim', { worker: 'w1' })) as {
      claimed: { id: string; worker: string } | null;
    };
    expect(claimed.claimed?.id).toBe('a');
    expect(claimed.claimed?.worker).toBe('w1');

    expect(await call(client, 'ack', { id: 'a', worker: 'w1' })).toEqual({ acked: true });
    expect(await call(client, 'status', {})).toMatchObject({ counts: { done: 1 } });
    q.close();
  });
});
