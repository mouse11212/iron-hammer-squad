import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { openQueue, type Queue } from './queue-sqlite.js';

// D9 消息组件的对外形态:把 SQLite 队列封装为 stdio MCP server,暴露
// enqueue/claim/ack/fail/status 工具,让外部进程/agent 投递与认领任务,无需常驻服务。
// 本文件是【薄封装】:每个工具直接转调 queue-sqlite 的同名函数,核心逻辑可脱 MCP 测试。

const asText = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

/** 构建配置好 5 个队列工具的 MCP server(不绑定 transport,便于注入测试)。 */
export function buildQueueMcpServer(queue: Queue): McpServer {
  const server = new McpServer({ name: 'iron-hammer-queue', version: '0.1.0' });

  server.registerTool(
    'enqueue',
    {
      description: '幂等入队一个请求(同 id 已存在则忽略)',
      inputSchema: { id: z.string(), kind: z.string(), prompt: z.string() },
    },
    async ({ id, kind, prompt }) => asText({ enqueued: queue.enqueue({ id, kind, prompt }) }),
  );

  server.registerTool(
    'claim',
    {
      description: '原子认领一条 queued 请求(无则返回 null)',
      inputSchema: { worker: z.string() },
    },
    async ({ worker }) => asText({ claimed: queue.claim(worker) }),
  );

  server.registerTool(
    'ack',
    {
      description: '确认完成(仅对本 worker 持有的 running 生效)',
      inputSchema: { id: z.string(), worker: z.string(), exitCode: z.number().optional() },
    },
    async ({ id, worker, exitCode }) => asText({ acked: queue.ack(id, worker, exitCode) }),
  );

  server.registerTool(
    'fail',
    {
      description: '标记失败(仅对本 worker 持有的 running 生效)',
      inputSchema: {
        id: z.string(),
        worker: z.string(),
        error: z.string(),
        exitCode: z.number().optional(),
      },
    },
    async ({ id, worker, error, exitCode }) => asText({ failed: queue.fail(id, worker, error, exitCode) }),
  );

  server.registerTool(
    'status',
    {
      description: '查询单请求状态(给 id)或各状态计数(不给 id)',
      inputSchema: { id: z.string().optional() },
    },
    async ({ id }) => asText(id ? { status: queue.status(id) } : { counts: queue.counts() }),
  );

  return server;
}

// stdio 入口:node mcp-server.js <dbPath>
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] ?? new URL('../../.runtime/queue.db', import.meta.url).pathname;
  const server = buildQueueMcpServer(openQueue(dbPath));
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[mcp] iron-hammer-queue 已连接 stdio,db=${dbPath}\n`);
}
