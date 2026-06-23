import { join } from 'node:path';
import type { GateResult } from './inner-loop.js';
import type { MustFix } from './types.js';

// orchestrator 代修(编排层确定性修复,非 agent):处理 review 标 orchestrator 域、test/dev 无权处理的 must-fix。
// 白名单驱动(防逃逸阀 + 对冲 KB 痛点三"自演进 harness 回归不可预见"):只做明确安全、纯增、不碰产品逻辑的修复。
// 首类 register-mutation-target:把新交付的纯逻辑文件登记进产品 stryker.conf——把"建造期动态变异门"覆盖的
// 文件沉淀进"交付后静态护栏",否则它的测试强度交付后失去持续反作弊保护(real e2e 揪出的缺口)。

const STRYKER_CONF = 'stryker.conf.json';

/** 纯:把 file 登记进 stryker.conf 的 mutate 列表(幂等、保留其它字段、2 空格缩进 + 末尾换行)。 */
export function registerMutationTarget(confJson: string, file: string): string {
  const conf = JSON.parse(confJson) as Record<string, unknown>;
  const mutate = Array.isArray(conf.mutate) ? (conf.mutate as string[]) : [];
  if (!mutate.includes(file)) mutate.push(file);
  conf.mutate = mutate;
  return JSON.stringify(conf, null, 2) + '\n';
}

export interface OrchestratorFixDeps {
  /** 被测产品目录(stryker.conf 所在)。 */
  projectDir: string;
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
}

/**
 * 真实 orchestrator 代修(白名单):逐条处理 must-fix.action。
 * 仅 register-mutation-target 被识别;任何不在白名单的指令(或无 action)→ ok:false →
 * inner-loop 据此 escalated(不静默吞,CLAUDE.md 红线 6 阻塞升级)。修后由 inner-loop 重跑 gate+review 验证。
 */
export function makeOrchestratorFix(deps: OrchestratorFixDeps): (fixes: MustFix[]) => Promise<GateResult> {
  return async (fixes) => {
    const registered: string[] = [];
    for (const fix of fixes) {
      const a = fix.action;
      if (a?.type !== 'register-mutation-target') {
        return { ok: false, summary: `不识别的 orchestrator 代修指令: ${a?.type ?? '(无 action)'}` };
      }
      const confPath = join(deps.projectDir, STRYKER_CONF);
      const updated = registerMutationTarget(deps.readFile(confPath), a.file); // 每条读最新,支持累积多文件
      deps.writeFile(confPath, updated);
      registered.push(a.file);
    }
    return { ok: true, summary: `已登记进 stryker.conf: ${registered.join(', ')}` };
  };
}
