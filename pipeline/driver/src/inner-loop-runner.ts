import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildPhasePrompt, type PromptContext } from './prompts.js';
import { makePhaseInvoke, isTransientApiError, type PhaseInvokeInput, type PhaseInvokeResult } from './invoke.js';
import { makeGates, type CmdResult, type CmdRunner } from './gates.js';
import { parseVerdict } from './verdict.js';
import { makeWorktreeManager, type WorktreeManager, type BatchIntegrateResult } from './worktree.js';
import { renderHandoffReport } from './handoff.js';
import { makeOrchestratorFix } from './orchestrator-fix.js';
import { makeEventSink, type EventSink } from './events.js';
import { instrumentRunPhase, instrumentGateCmd, instrumentOrchestratorFix, emitSquash, emitIntegrate } from './instrument.js';
import { squashMessage } from './squash-message.js';
import { aggregatePhaseMs } from './aggregate-phase-ms.js';
import { readEvents } from './replay.js';
import { runLedgerRecord, appendRunLedger } from './run-ledger.js';
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

  // 统一事件日志(M4+):全链操作落中心 events.jsonl,traceId=jobId,可凭 jobId 回放(bin-replay)。
  const ictx = { traceId: jobId, emit: makeEventSink(join(pipeline, '.runtime', 'events.jsonl')), clock: (): number => Date.now() };

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
  // 统一事件:每个 phase 起止发结构化 phase 事件(原始 claude 流仍留 ${role}-*.jsonl 作深度调试)。
  const instrumentedRunPhase = instrumentRunPhase(runPhase, ictx);

  // gate 命令路由进统一事件(补 exitCode/durationMs,取代旧 gates.jsonl 仅记 {cmd,args})。
  const cmd = instrumentGateCmd(makeCmdRunner(), ictx);
  const gates = makeGates(cmd, { cwd: spec.projectDir });

  let costUsd = 0; // 跨所有 phase(含回修)累加的 claude 调用成本(可度量,供 metrics 聚合)
  const result = await runInnerLoop(
    { id: jobId, maxFixRounds: spec.maxFixRounds },
    {
      runPhase: async (input) => {
        // 每次进入某 role 递增 trace attempt(回修轮分文件)
        traceCounters.set(input.role, (traceCounters.get(input.role) ?? -1) + 1);
        const out = await instrumentedRunPhase(input); // 发 phase 事件 + 透传
        costUsd += out.costUsd ?? 0;
        return out;
      },
      gates,
      readVerdict: async () => parseVerdict(readFileSync(verdictPath, 'utf8')),
      // orchestrator 代修(白名单):review 标 orchestrator 域的 must-fix(如登记 stryker.conf)由编排层确定性处理
      orchestratorFix: instrumentOrchestratorFix(
        makeOrchestratorFix({
          projectDir: spec.projectDir,
          readFile: (p) => readFileSync(p, 'utf8'),
          writeFile: (p, c) => writeFileSync(p, c, 'utf8'),
        }),
        ictx,
      ),
    },
  );

  // per-job state.json:状态机结果 + 可度量字段(jobId/costUsd),供 metrics 聚合
  const record = { jobId, ...result, costUsd };
  writeFileSync(join(runsDir, 'state.json'), JSON.stringify(record, null, 2), 'utf8');
  // 持久化 inner-loop 统计到 committed ledger(M4+⑥,收尾):每个终态 run 都 append,覆盖 escalated/failed(trailer 做不到)。
  appendRunLedger(
    join(pipeline, '..', 'docs', 'metrics', 'runs-ledger.jsonl'),
    runLedgerRecord(jobId, result, costUsd, new Date().toISOString()),
  );
  return result;
}

// ───────── M5-B:worktree 隔离编排(V4 §9 军规 3/8)─────────

export interface IsolatedDeps {
  wt: WorktreeManager;
  runJob: (jobId: string, spec: InnerLoopJobSpec) => Promise<InnerLoopResult>;
  repoRoot: string;
  baseRef?: string;
  /** 统一事件 sink(可选):提供则发 squash 事件(traceId=jobId)。 */
  emit?: EventSink;
  /** 注入时钟(epoch ms);缺省真实 Date.now。 */
  clock?: () => number;
  /** 读本 run 各阶段耗时(原始 op 分类);提供则 squash 时打 Metrics-Phase-Ms: trailer 持久化 VTax(M4+⑤)。缺省=不打(向后兼容)。 */
  readPhaseMs?: (jobId: string) => Record<string, number>;
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
      // squash 动态据 git status 捕获实际改动(不再传 targetPaths——agent 写在哪/什么名都正确捕获)
      // emit Defect-Caught:(据 fixRounds,M4+④)+ Metrics-Phase-Ms:(据本 run 阶段耗时,M4+⑤)trailer 持久化 caught/VTax
      const phaseMs = deps.readPhaseMs?.(jobId);
      committed = await deps.wt.squashCommit(join(wtInfo.path, relProjectDir), squashMessage(jobId, result.fixRounds, phaseMs));
    }
    if (deps.emit) {
      emitSquash({ traceId: jobId, emit: deps.emit, clock: deps.clock ?? ((): number => Date.now()) }, { committed, branch: committed ? wtInfo.branch : undefined });
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
  /** 统一事件 sink(可选):提供则每个 merged/held 分支发 integrate 事件(traceId 由分支名反推 jobId)。 */
  emit?: EventSink;
  /** 注入时钟(epoch ms);缺省真实 Date.now。 */
  clock?: () => number;
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
  if (integration && deps.emit) {
    // 集成结局落统一事件:traceId 由分支名 agent/<jobId> 反推回各 US,可凭 jobId 回放出集成结局。
    const clock = deps.clock ?? ((): number => Date.now());
    for (const b of integration.merged) emitIntegrate(deps.emit, clock, { branch: b, status: 'merged' });
    for (const h of integration.held) emitIntegrate(deps.emit, clock, { branch: h.branch, status: 'held', reason: h.reason });
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
  const eventsPath = join(pipeline, '.runtime', 'events.jsonl');
  const emit = makeEventSink(eventsPath);
  // 默认 readPhaseMs:读中心 events.jsonl 聚合本 run 阶段耗时(持久化 VTax 的原始事实,M4+⑤)。
  const readPhaseMs = (id: string): Record<string, number> => aggregatePhaseMs(readEvents(eventsPath), id);
  return runIsolated(jobId, spec, { wt, runJob: runInnerLoopJob, repoRoot, emit, readPhaseMs });
}

export interface RealBatchOpts {
  concurrency?: number;
  baseRef?: string;
  /** 命令执行器(默认真 spawn);注入便于测 gate/集成装配,不触真 IO。 */
  cmd?: CmdRunner;
}

/**
 * 真实 BatchDrainDeps 装配(daemon「接全」核心):把已验证单元组合成全链一份依赖——
 * runOne=隔离 worktree 跑内循环、batchIntegrate=跨批累积集成、integrationGate=各项目 green、
 * linkDeps=软链依赖、onHandoff=HITL 交接报告。构造期不做 IO(manager/gates 惰性),可单测接线。
 */
export function makeRealBatchDeps(opts: RealBatchOpts = {}): BatchDrainDeps {
  const pipeline = pipelineDir();
  const repoRoot = join(pipeline, '..');
  const runtimeRoot = join(pipeline, '.runtime');
  const runtimeDir = join(runtimeRoot, 'worktrees');
  const cmd = opts.cmd ?? makeCmdRunner();
  const wt = makeWorktreeManager(cmd, { repoRoot, runtimeDir });
  return {
    runOne: runInnerLoopJobIsolated,
    batchIntegrate: wt.batchIntegrate,
    integrationGate: (projectDir) => makeGates(cmd, { cwd: projectDir }).green(),
    linkDeps: wt.linkDeps,
    repoRoot,
    runtimeDir,
    onHandoff: makeDefaultHandoff(runtimeRoot),
    emit: makeEventSink(join(runtimeRoot, 'events.jsonl')), // 批后集成事件落统一日志
    concurrency: opts.concurrency,
    baseRef: opts.baseRef,
  };
}
