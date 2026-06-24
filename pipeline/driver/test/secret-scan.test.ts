import { describe, it, expect } from 'vitest';
import { scanSecrets } from '../src/secret-scan.js';

const f = (path: string, content: string) => ({ path, content });
const PAT = 'ghp_' + 'x'.repeat(36); // ghp_ + 恰好 36

describe('scanSecrets（纯:高精度模式检测硬编码密钥）', () => {
  it('命中 GitHub PAT(ghp_)', () => {
    const out = scanSecrets([f('a.ts', `const t = "${PAT}"`)]);
    expect(out).toEqual([{ path: 'a.ts', line: 1, rule: 'github-pat' }]);
  });

  it('命中 github_pat_ / AWS AKIA / PEM 私钥块', () => {
    const out = scanSecrets([
      f('b.ts', `x = "github_pat_11ABCDE0000aaaaaaaaaaaa_bbbbbbbbbb"`),
      f('c.ts', `key = "AKIAIOSFODNN7EXAMPLE"`),
      f('d.pem', '-----BEGIN RSA PRIVATE KEY-----'),
    ]);
    expect(out.map((x) => x.rule).sort()).toEqual(['aws-access-key', 'github-pat', 'pem-private-key']);
  });

  it('通用赋值 api_key/secret/token/password = "非空" 命中;空值/无引号不命中', () => {
    const hit = scanSecrets([f('e.ts', `const api_key = "abc123def456"`)]);
    expect(hit).toEqual([{ path: 'e.ts', line: 1, rule: 'generic-secret-assignment' }]);
    const miss = scanSecrets([f('g.ts', `const password = ""\nlet token = someVar\napiKey: config.key`)]);
    expect(miss).toEqual([]);
  });

  it('普通源码无命中 → []', () => {
    expect(scanSecrets([f('h.ts', 'export const sum = (a, b) => a + b;\n// just a comment')])).toEqual([]);
  });

  it('多文件多命中带正确定位(行号 1-based)', () => {
    const out = scanSecrets([f('i.ts', `line1\nconst t = "${PAT}"\nline3`), f('j.ts', `key = "AKIAIOSFODNN7EXAMPLE"`)]);
    expect(out).toEqual([
      { path: 'i.ts', line: 2, rule: 'github-pat' },
      { path: 'j.ts', line: 1, rule: 'aws-access-key' },
    ]);
  });

  it('内联豁免:同行 / 上一行 // allowlist-secret: 理由 → 跳过', () => {
    const sameLine = scanSecrets([f('k.ts', `const t = "${PAT}" // allowlist-secret: 测试夹具`)]);
    expect(sameLine).toEqual([]);
    const prevLine = scanSecrets([f('l.ts', `// allowlist-secret: 文档示例\nconst t = "${PAT}"`)]);
    expect(prevLine).toEqual([]);
  });

  it('无理由的豁免标记不生效(防滥用)', () => {
    const out = scanSecrets([f('m.ts', `const t = "${PAT}" // allowlist-secret:`)]);
    expect(out).toEqual([{ path: 'm.ts', line: 1, rule: 'github-pat' }]);
  });
});
