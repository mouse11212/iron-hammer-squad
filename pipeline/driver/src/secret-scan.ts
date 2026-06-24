import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GateResult } from './inner-loop.js';
import { changedPathsFromStatus } from './gates.js';

// M6-a 密钥扫描门(安全门首切片):确定性扫本次改动 diff 找硬编码密钥/凭证,命中阻断交付。
// 失败驱动(真实 PAT 泄露)。纯检测器 + 薄 IO;高精度模式低 FP + 内联豁免(不弱化门)。

/** 一处密钥命中。 */
export interface Finding {
  path: string;
  /** 1-based 行号。 */
  line: number;
  rule: string;
}

/** 高精度规则:provider 前缀(低 FP)+ 通用赋值字面量。 */
const RULES: { rule: string; re: RegExp }[] = [
  { rule: 'github-pat', re: /\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { rule: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: 'pem-private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // 通用赋值:key/secret/token/password = "非空"(仅引号包裹非空值,降 FP)
  { rule: 'generic-secret-assignment', re: /\b(?:api_?key|secret|token|password)\b\s*[:=]\s*["'][^"']+["']/i }, // allowlist-secret: 检测器规则定义本身(非真密钥)
];

/** 该行是否带有效内联豁免(`// allowlist-secret: <非空理由>`)。 */
function hasAllowlist(line: string | undefined): boolean {
  return line !== undefined && /\/\/\s*allowlist-secret:\s*\S/.test(line);
}

/**
 * 纯函数:扫文件内容找硬编码密钥。命中带 path/1-based line/rule;
 * 命中行同行或紧邻上一行有 `// allowlist-secret: 理由`(须带理由)则跳过。无命中返回 []。
 */
export function scanSecrets(files: { path: string; content: string }[]): Finding[] {
  const out: Finding[] = [];
  for (const { path, content } of files) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (hasAllowlist(line) || hasAllowlist(lines[i - 1])) continue; // 豁免(同行/上一行)
      for (const { rule, re } of RULES) {
        if (re.test(line)) out.push({ path, line: i + 1, rule });
      }
    }
  }
  return out;
}

// ── 薄 IO 边界:扫本次改动文件(不回溯全树)──────────────

/** 渲染命中摘要(供 GateResult)。 */
function summarize(findings: Finding[]): string {
  return '密钥扫描命中(移除/改环境变量,或 // allowlist-secret: 理由 显式豁免):\n' +
    findings.map((f) => `  ${f.path}:${f.line}  [${f.rule}]`).join('\n');
}

/**
 * 薄 IO 门函数:据 git status 取本次改动文件,读内容跑 scanSecrets。
 * 命中 → ok:false(摘要列命中);无命中/无改动 → ok:true。读不到文件跳过(不抛、不臆造)。
 * porcelain 由注入提供(便于测);缺省真实读 git。
 */
export function secretScanGate(
  projectDir: string,
  porcelain: string,
  relPrefix = '',
): GateResult {
  const changed = changedPathsFromStatus(porcelain, relPrefix);
  const files: { path: string; content: string }[] = [];
  for (const rel of changed) {
    const abs = join(projectDir, rel);
    if (!existsSync(abs)) continue; // 删除/读不到 → 跳过
    try {
      files.push({ path: rel, content: readFileSync(abs, 'utf8') });
    } catch {
      continue;
    }
  }
  const findings = scanSecrets(files);
  return findings.length > 0 ? { ok: false, summary: summarize(findings) } : { ok: true };
}
