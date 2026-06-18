import type { MustFix } from './types.js';
import type { PhaseRole } from './inner-loop.js';

// 合成角色 spawn prompt(纯组合)。KB orchestrator-patterns:teammates 不继承对话,
// 只靠 spawn prompt + 外部状态——所以角色定义/约定/规约/目标路径必须一次性塞进 prompt。
// 文件读取(roles/*.md、guides)是 IO,留在调用方边界;本函数只做纯组合。

export interface PromptContext {
  /** 该单元规约切片(WHEN/THEN)。 */
  specSlice: string;
  /** 目标路径(待写/待改文件)。 */
  targetPaths?: string[];
  /** 被测工程目录。 */
  projectDir?: string;
  /** 评审角色产出 verdict 的文件路径。 */
  verdictPath?: string;
}

export interface BuildPromptInput {
  role: PhaseRole;
  /** 角色模板内容(roles/*.md)。 */
  roleDoc: string;
  /** 工程约定内容(guides/agent-conventions.md)。 */
  conventionsDoc: string;
  context: PromptContext;
  /** 回修时注入的 must-fix。 */
  mustFix?: MustFix[];
}

/** 组合出一个无头角色 phase 的完整 prompt。 */
export function buildPhasePrompt(input: BuildPromptInput): string {
  const { role, roleDoc, conventionsDoc, context, mustFix } = input;
  const parts: string[] = [];

  parts.push('# 你的角色', roleDoc);
  parts.push('# 工程约定(必须遵守)', conventionsDoc);
  parts.push('# 本单元规约切片', context.specSlice);

  if (context.targetPaths?.length) {
    parts.push('# 目标路径', context.targetPaths.map((p) => `- ${p}`).join('\n'));
  }
  if (context.projectDir) {
    parts.push(`# 工程目录\n${context.projectDir}`);
  }
  if (role === 'review' && context.verdictPath) {
    parts.push(
      '# 产出要求',
      `完成评审后,把结构化裁决写入 verdict JSON 文件: ${context.verdictPath}\n` +
        'schema: {decision: pass|conditional|block, mustFix: [{domain: impl|test, desc, file?}], niceToHave?}',
    );
  }
  if (mustFix?.length) {
    parts.push(
      '# 回修:must-fix 清单(只修这些,守住你的角色硬边界)',
      mustFix
        .map((m, i) => `${i + 1}. [${m.domain}] ${m.desc}${m.file ? ` (${m.file})` : ''}`)
        .join('\n'),
    );
  }

  return parts.join('\n\n');
}
