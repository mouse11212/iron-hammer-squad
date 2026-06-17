/** 投递进队列的请求(文件投递 = 事件)。 */
export interface Request {
  id: string;
  /** 步骤类型，如 'inner-loop' / 'freeform'。 */
  kind: string;
  /** 喂给 claude -p 的提示(最小切片直接携带；后续可由 pipeline 模板生成)。 */
  prompt: string;
  createdAt: string;
}

export type RunStatus = 'queued' | 'running' | 'done' | 'failed';

/** 外置 run-state：每个请求一份，可恢复。 */
export interface RunState {
  id: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
}

/** claude -p 调用结果。 */
export interface InvokeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** claude -p 薄边界类型：可注入替身以便确定性测试。 */
export type InvokeFn = (prompt: string) => Promise<InvokeResult>;
