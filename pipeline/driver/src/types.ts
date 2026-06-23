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

// ───────── inner-loop 编排(M5/PEV)类型 ─────────

/** must-fix 归属域：实现 bug → 开发角色；测试缺口 → 测试角色；编排层职责 → orchestrator 确定性代修。 */
export type FixDomain = 'impl' | 'test' | 'orchestrator';

/** orchestrator 代修指令(确定性、白名单驱动,防逃逸阀)。首类:登记新纯逻辑文件进产品 stryker.conf。 */
export type OrchestratorAction = { type: 'register-mutation-target'; file: string };

/** 评审产出的单条 must-fix(结构化，driver 据此确定性路由)。 */
export interface MustFix {
  domain: FixDomain;
  desc: string;
  /** 可选定位文件。 */
  file?: string;
  /** orchestrator 域专用:结构化代修指令(白名单);test/dev agent 无权处理的编排层修复。 */
  action?: OrchestratorAction;
}

/** 评审裁决类型。 */
export type VerdictDecision = 'pass' | 'conditional' | 'block';

/** 评审 phase 产出的结构化 verdict(固定 schema，driver 不解析自由文本)。 */
export interface Verdict {
  decision: VerdictDecision;
  mustFix: MustFix[];
  niceToHave?: string[];
}
