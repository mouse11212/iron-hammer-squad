// spec-coverage 纯核：能力源码无对应 OpenSpec change 即违规。
// 规则：无 IO，无 LLM，纯判路径 + 内容。
// 能力源 = pipeline/<pkg>/src/**/*.ts，排除 .test.ts / bin-*.ts / mcp-server.ts。
// in-progress change = docs/openspec/changes/<非 archive 段>/...

/** 门禁结果。ok=false 时 offenders 列出所有违规能力源路径。 */
export interface SpecCoverageResult {
  ok: boolean;
  offenders: string[];
}

/** 门禁输入。changedPaths = 变更/暂存文件列表；contents = 能力源文件内容（用于扫描豁免注释）。 */
export interface SpecCoverageInput {
  /** 仓库相对路径的变更/暂存文件列表。 */
  changedPaths: string[];
  /** path → 文件内容；仅能力源需要（用于扫描 @spec-exempt）；可缺失/不完整。 */
  contents?: Record<string, string>;
}

/** 判断路径是否为能力源：pipeline/<pkg>/src/.../*.ts，非 .test.ts / bin-*.ts / mcp-server.ts。 */
function isCapabilitySource(p: string): boolean {
  // 必须符合 pipeline/<pkg>/src/... 结构，且以 .ts 结尾
  if (!p.endsWith('.ts')) return false;
  // 排除 .test.ts
  if (p.endsWith('.test.ts')) return false;
  // 路径须形如 pipeline/<pkg>/src/... (至少 4 段)
  const parts = p.split('/');
  if (parts.length < 4) return false;
  if (parts[0] !== 'pipeline') return false;
  if (parts[2] !== 'src') return false;
  // 取 basename（最后一段）
  const basename = parts[parts.length - 1] ?? '';
  // 排除 bin shim：basename 以 bin- 开头
  if (basename.startsWith('bin-')) return false;
  // 排除 mcp-server.ts
  if (basename === 'mcp-server.ts') return false;
  return true;
}

/** 判断路径是否为有效的 in-progress OpenSpec change（排除 archive 下的路径）。 */
function isInProgressOpenSpecChange(p: string): boolean {
  // 须以 docs/openspec/changes/ 开头
  const prefix = 'docs/openspec/changes/';
  if (!p.startsWith(prefix)) return false;
  // 取 prefix 之后的第一段（change id）
  const rest = p.slice(prefix.length);
  const nextSlash = rest.indexOf('/');
  const segment = nextSlash === -1 ? rest : rest.slice(0, nextSlash);
  // 排除 archive
  return segment !== 'archive' && segment !== '';
}

/** 判断文件内容是否包含有效豁免注释（// @spec-exempt: <非空 reason>）。 */
function hasValidExemption(content: string): boolean {
  for (const line of content.split('\n')) {
    const match = line.match(/\/\/ @spec-exempt:(.*)/);
    if (match !== undefined && match !== null) {
      const reason = match[1] ?? '';
      if (reason.trim() !== '') return true;
    }
  }
  return false;
}

/**
 * 能力源无 OpenSpec change 门禁（纯函数，无 IO）。
 *
 * 规则：
 * - 若 changedPaths 中无能力源 → 门禁不触发，ok=true。
 * - 若有能力源：
 *   - 若 changedPaths 中有 in-progress OpenSpec change → ok=true（一个 change 覆盖所有能力源）。
 *   - 否则：能力源若有有效豁免注释则放行，无则列入 offenders。
 */
export function gateSpecCoverage(input: SpecCoverageInput): SpecCoverageResult {
  const { changedPaths, contents = {} } = input;

  const capSources = changedPaths.filter(isCapabilitySource);

  // 规则3：无能力源 → 门禁不触发
  if (capSources.length === 0) {
    return { ok: true, offenders: [] };
  }

  // 规则4a：有 in-progress OpenSpec change → 全部放行
  const hasOpenSpecChange = changedPaths.some(isInProgressOpenSpecChange);
  if (hasOpenSpecChange) {
    return { ok: true, offenders: [] };
  }

  // 规则4b：逐源检查豁免
  const offenders = capSources.filter((p) => {
    const content = contents[p];
    if (content === undefined) return true; // 无内容 = 无豁免
    return !hasValidExemption(content);
  });

  return { ok: offenders.length === 0, offenders };
}
