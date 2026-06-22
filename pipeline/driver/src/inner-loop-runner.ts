import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildPhasePrompt, type PromptContext } from './prompts.js';
import { makePhaseInvoke, type PhaseInvokeInput, type PhaseInvokeResult } from './invoke.js';
import { makeGates, type CmdResult } from './gates.js';
import { parseVerdict } from './verdict.js';
import { runInnerLoop, type PhaseInput, type PhaseOutput, type PhaseRole, type InnerLoopResult } from './inner-loop.js';

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
}

/** 装配单个角色 phase 的执行:合成 prompt → phaseInvoke → resume 失败回退 fresh spawn。 */
export function makeRunPhase(deps: RunPhaseDeps): (input: PhaseInput) => Promise<PhaseOutput> {
  return async (input: PhaseInput): Promise<PhaseOutput> => {
    const prompt = buildPhasePrompt({
      role: input.role,
      roleDoc: deps.loadRoleDoc(input.role),
      conventionsDoc: deps.conventionsDoc,
      context: deps.context,
      mustFix: input.mustFix,
    });
    const onTraceLine = deps.onTrace ? (line: string): void => deps.onTrace!(input.role, line) : undefined;
    const resume = input.resumeSessionId !== undefined;
    const sessionId = input.resumeSessionId ?? deps.genId();

    let res = await deps.phaseInvoke({ prompt, sessionId, resume, onTraceLine });
    let resumed = resume;
    if (resume && res.isError) {
      // resume 失败 → 回退 fresh spawn(新 session;prompt 已含 must-fix + 读盘上下文)
      res = await deps.phaseInvoke({ prompt, sessionId: deps.genId(), resume: false, onTraceLine });
      resumed = false;
    }
    return { exitCode: res.exitCode, sessionId: res.sessionId ?? sessionId, resumed, costUsd: res.costUsd };
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
