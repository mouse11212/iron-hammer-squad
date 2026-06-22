import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildPhasePrompt, type PromptContext } from './prompts.js';
import { makePhaseInvoke, isTransientApiError, type PhaseInvokeInput, type PhaseInvokeResult } from './invoke.js';
import { makeGates, type CmdResult } from './gates.js';
import { parseVerdict } from './verdict.js';
import { makeWorktreeManager, type WorktreeManager, type BatchIntegrateResult } from './worktree.js';
import { renderHandoffReport } from './handoff.js';
import type { Queue } from './queue-sqlite.js';
import {
  runInnerLoop,
  type PhaseInput,
  type PhaseOutput,
  type PhaseRole,
  type InnerLoopResult,
  type GateResult,
} from './inner-loop.js';

// 集成胶水:把 prompts + phaseInvoke + gates + verdict 装配成 runInnerLoop 的 deps。
// makeRunPhase 含 resume 失败回退(纯逻辑可测);runInnerLoopJob 是真实 IO 装配(端到端覆盖)。

// ───────── runPhase 工厂(注入 phaseInvoke,可确定性测回退)─────────

export interface RunPhaseDeps {
  phaseInvoke: (i: PhaseInvokeInput) => Promise<PhaseInvokeResult>;
  loadRoleDoc: (role: PhaseRole) => string;
  conventionsDoc: string;
  context: PromptContext;
  genId: () => string;
  onTrace?: (role: PhaseRole, line: string) => void;
  /** 瞬时 API 错误重试上限(默认 2)。 */
  maxRetries?: number;
  /** 注入的退避等待(默认真 setTimeout)。 */
  sleep?: (ms: number) => Promise<void>;
  /** 瞬时错误判别(默认 isTransientApiError)。 */
  isTransient?: (text: string) => boolean;
}

/**
 * 装配单个角色 phase:合成 prompt → phaseInvoke → resume 失败回退 fresh → 瞬时 API 错误有限重试。
 * 重试只针对瞬时基础设施抖动(非模型/代码失败),每次换 fresh session-id(避免同 id 残留冲突)。
 */
export function makeRunPhase(deps: RunPhaseDeps): (input: PhaseInput) => Promise<PhaseOutput> {
  const maxRetries = deps.maxRetries ?? 2;
  const sleep = deps.sleep ?? ((ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms)));
  const isTransient = deps.isTransient ?? isTransientApiError;

  return async (input: PhaseInput): Promise<PhaseOutput> => {
    const prompt = buildPhasePrompt({
      role: input.role,
      roleDoc: deps.loadRoleDoc(input.role),
      conventionsDoc: deps.conventionsDoc,
      context: deps.context,
      mustFix: input.mustFix,
    });
    const onTraceLine = deps.onTrace ? (line: string): void => deps.onTrace!(input.role, line) : undefined;

    let lastSessionId = '';
    // 新会话(可对瞬时错误重试,每次 fresh id)
    const runFresh = async (): Promise<PhaseInvokeResult> => {
      lastSessionId = deps.genId();
      let r = await deps.phaseInvoke({ prompt, sessionId: lastSessionId, resume: false, onTraceLine });
      let n = 0;
      while (r.isError && isTransient(r.result) && n < maxRetries) {
        n++;
        await sleep(500 * n); // 线性退避
        lastSessionId = deps.genId();
        r = await deps.phaseInvoke({ prompt, sessionId: lastSessionId, resume: false, onTraceLine });
      }
      return r;
    };

    let res: PhaseInvokeResult;
    let resumed = false;
    if (input.resumeSessionId !== undefined) {
      lastSessionId = input.resumeSessionId;
      res = await deps.phaseInvoke({ prompt, sessionId: lastSessionId, resume: true, onTraceLine });
      resumed = true;
      if (res.isError) {
        // resume 失败(含瞬时)→ 回退 fresh(其瞬时错误也纳入重试)
        res = await runFresh();
        resumed = false;
      }
    } else {
      res = await runFresh();
    }
    return { exitCode: res.exitCode, sessionId: res.sessionId ?? lastSessionId, resumed, costUsd: res.costUsd };
  };
}

// ───────── 真实 IO 装配:供 driver dispatch 调用 ─────────

/** inner-loop 作业上下文(由 job.prompt 携带的 JSON 解析得到)。 */
export interface InnerLoopJobSpec {
  specSlice: string;
  targetPaths?: string[];
  /** 被测工程目录(gate 在此跑,如 fincards)。 */
  projectDir: string;
  maxFixRounds?: number;
}

/** 薄命令执行器:spawn 一个命令,收集退出码/输出。 */
function makeCmdRunner(): (cmd: string, args: string[], cwd: string) => Promise<CmdResult> {
  return (cmd, args, cwd) =>
    new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
      child.on('error', (err) => resolve({ exitCode: 1, stdout, stderr: String(err) }));
    });
}

const ROLE_DOC: Record<PhaseRole, string> = {
  test: 'test-agent.md',
  dev: 'dev-agent.md',
  review: 'review-agent.md',
};

const pipelineDir = (): string => fileURLToPath(new URL('../../', import.meta.url)); // driver/src/.. -> driver/.. -> pipeline/

/** 端到端跑一个 inner-loop 作业:装配真实 deps → runInnerLoop → 落 per-job state。 */
export async function runInnerLoopJob(jobId: string, spec: InnerLoopJobSpec): Promise<InnerLoopResult> {
  const pipeline = pipelineDir();
  const runsDir = join(pipeline, '.runtime', 'runs', jobId);
  mkdirSync(runsDir, { recursive: true });
  const verdictPath = join(runsDir, 'verdict.json');

  const conventionsDoc = readFileSync(join(pipeline, 'guides', 'agent-conventions.md'), 'utf8');
  const context: PromptContext = {
    specSlice: spec.specSlice,
    targetPaths: spec.targetPaths,
    projectDir: spec.projectDir,
    verdictPath,
  };

  const traceCounters = new Map<string, number>();
  const runPhase = makeRunPhase({
    phaseInvoke: makePhaseInvoke({ cwd: spec.projectDir, timeoutMs: 300_000 }),
    loadRoleDoc: (role) => readFileSync(join(pipeline, 'roles', ROLE_DOC[role]), 'utf8'),
    conventionsDoc,
    context,
    genId: () => randomUUID(),
    onTrace: (role, line) => {
      const attempt = traceCounters.get(role) ?? 0;
      appendFileSync(join(runsDir, `${role}-${attempt}.jsonl`), line + '\n');
    },
  });

  // gate 命令日志(可观测:阶段间确定性 gate 也落 trace,补 phase trace 之外的盲点)
  const baseCmd = makeCmdRunner();
  const cmd: typeof baseCmd = (c, a, cwd) => {
    appendFileSync(join(runsDir, 'gates.jsonl'), JSON.stringify({ cmd: c, args: a }) + '\n');
    return baseCmd(c, a, cwd);
  };
  const gates = makeGates(cmd, { cwd: spec.projectDir });

  let costUsd = 0; // 跨所有 phase(含回修)累加的 claude 调用成本(可度量,供 metrics 聚合)
  const result = await runInnerLoop(
    { id: jobId, maxFixRounds: spec.maxFixRounds },
    {
      runPhase: async (input) => {
        // 每次进入某 role 递增 trace attempt(回修轮分文件)
        traceCounters.set(input.role, (traceCounters.get(input.role) ?? -1) + 1);
        const out = await runPhase(input);
        costUsd += out.costUsd ?? 0;
        return out;
      },
      gates,
      readVerdict: async () => parseVerdict(readFileSync(verdictPath, 'utf8')),
    },
  );

  // per-job state.json:状态机结果 + 可度量字段(jobId/costUsd),供 metrics 聚合
  const record = { jobId, ...result, costUsd };
  writeFileSync(join(runsDir, 'state.json'), JSON.stringify(record, null, 2), 'utf8');
  return result;
}

// ───────── M5-B:worktree 隔离编排(V4 §9 军规 3/8)─────────

export interface IsolatedDeps {
  wt: WorktreeManager;
  runJob: (jobId: string, spec: InnerLoopJobSpec) => Promise<InnerLoopResult>;
  repoRoot: string;
  baseRef?: string;
}

export interface IsolatedResult {
  result: InnerLoopResult;
  /** done 且 squash 成功时的 feature 分支(供批后集成);否则 undefined。 */
  branch?: string;
  committed: boolean;
}

/**
 * worktree 隔离编排:建 worktree → 软链依赖 → inner-loop 在 worktree 内跑 →
 * done 则 squash 出 feature 分支(**不在此集成**,集成统一交批后 batchIntegrate)→ finally 回收。
 * 绝不写 main(军规 1/2)。纯编排,deps 全注入。
 */
export async function runIsolated(
  jobId: string,
  spec: InnerLoopJobSpec,
  deps: IsolatedDeps,
): Promise<IsolatedResult> {
  const relProjectDir = relative(deps.repoRoot, spec.projectDir);
  const baseRef = deps.baseRef ?? 'HEAD';
  const wtInfo = await deps.wt.create(jobId, baseRef);
  try {
    await deps.wt.linkDeps(wtInfo.path, relProjectDir);
    const result = await deps.runJob(jobId, { ...spec, projectDir: join(wtInfo.path, relProjectDir) });
    let committed = false;
    if (result.status === 'done') {
      committed = await deps.wt.squashCommit(
        join(wtInfo.path, relProjectDir),
        spec.targetPaths ?? [],
        `feat(${jobId}): inner-loop 交付`,
      );
    }
    return { result, branch: committed ? wtInfo.branch : undefined, committed };
  } finally {
    await deps.wt.remove(wtInfo.path); // 军规 3:完成即回收
  }
}

// ───────── 批后集成:并行隔离 drain + batchIntegrate(②)─────────

export interface BatchDrainDeps {
  runOne: (jobId: string, spec: InnerLoopJobSpec) => Promise<IsolatedResult>;
  batchIntegrate: WorktreeManager['batchIntegrate'];
  integrationGate: (projectDir: string) => Promise<GateResult>;
  linkDeps: WorktreeManager['linkDeps'];
  repoRoot: string;
  runtimeDir: string;
  baseRef?: string;
  concurrency?: number;
  /** 批后集成完成后的 HITL 交接钩子(产出报告/通知);仅在本批有 job 时触发。 */
  onHandoff?: (integration: BatchIntegrateResult | null) => void;
}

export interface BatchDrainResult {
  handled: number;
  integration: BatchIntegrateResult | null;
}

/**
 * 并行隔离 drain:N 个 worker 认领 inner-loop job → runOne(隔离,产分支)→ ack/fail;
 * 抽干后把 committed 的 feature 分支统一交 batchIntegrate(无则跳过)。集成停 HITL,不写 main。
 */
export async function drainBatchIsolated(q: Queue, deps: BatchDrainDeps): Promise<BatchDrainResult> {
  const results: IsolatedResult[] = [];
  // 记录每个 committed 分支所属项目目录(相对仓库根),供批后集成按项目路由 gate(多项目混批)。
  const branchRel = new Map<string, string>();
  const worker = async (name: string): Promise<void> => {
    for (;;) {
      const job = q.claim(name);
      if (job === null) break;
      try {
        const spec = JSON.parse(job.prompt) as InnerLoopJobSpec;
        const res = await deps.runOne(job.id, spec);
        results.push(res);
        if (res.committed && res.branch) branchRel.set(res.branch, relative(deps.repoRoot, spec.projectDir));
        if (res.result.status === 'done') q.ack(job.id, name, 0);
        else q.fail(job.id, name, res.result.status, 1);
      } catch (err) {
        q.fail(job.id, name, err instanceof Error ? err.message : String(err), 1);
      }
    }
  };
  await Promise.all(Array.from({ length: deps.concurrency ?? 2 }, (_, k) => worker(`w${k}`)));

  const branches = results.filter((r) => r.committed && r.branch).map((r) => r.branch!);
  let integration: BatchIntegrateResult | null = null;
  if (branches.length > 0) {
    const intWorktree = join(deps.runtimeDir, '_integration');
    integration = await deps.batchIntegrate(
      branches,
      { integrationBranch: 'integration', baseRef: deps.baseRef ?? 'HEAD', intWorktree },
      async (branch) => {
        // 按该 feature 所属项目目录跑集成 gate(多项目混批:各 feature 在各自项目验证)
        const rel = branchRel.get(branch) ?? '';
        await deps.linkDeps(intWorktree, rel);
        return deps.integrationGate(join(intWorktree, rel));
      },
    );
  }
  if (results.length > 0) deps.onHandoff?.(integration); // 本批有 job → HITL 交接(含全 held/无产出场景)
  return { handled: results.length, integration };
}

/** 默认 HITL 交接:渲染报告写 <runtimeRoot>/integration-report.md + 控制台摘要。 */
export function makeDefaultHandoff(runtimeRoot: string): (integration: BatchIntegrateResult | null) => void {
  return (integration) => {
    const report = renderHandoffReport(integration, {
      integrationBranch: 'integration',
      generatedAt: new Date().toISOString(),
    });
    const out = join(runtimeRoot, 'integration-report.md');
    writeFileSync(out, report, 'utf8');
    const merged = integration?.merged.length ?? 0;
    const held = integration?.held.length ?? 0;
    console.log(`[handoff] 集成交接 → ${out}(已集成 ${merged} / 挂起 ${held})${held ? ' ⚠️需人处理' : ''}`);
  };
}

/** 真实装配:单个隔离 job(供 driver dispatch)。集成交批后步骤,这里只产分支。 */
export async function runInnerLoopJobIsolated(jobId: string, spec: InnerLoopJobSpec): Promise<IsolatedResult> {
  const pipeline = pipelineDir();
  const repoRoot = join(pipeline, '..');
  const runtimeDir = join(pipeline, '.runtime', 'worktrees');
  const cmd = makeCmdRunner();
  const wt = makeWorktreeManager(cmd, { repoRoot, runtimeDir });
  return runIsolated(jobId, spec, { wt, runJob: runInnerLoopJob, repoRoot });
}
