// M6-b 敏感改动加严审批:纯路径分类器,判定改动是否触及敏感面(鉴权/CI/基础设施)。
// 命中 → batchIntegrate held(reason:sensitive)路由人签,不自动合(红线7/军规7/D1)。
// 与 M6-a(密钥=must-fix)不同:敏感改动是合法交付,只需人签——故 held 保留工作,非 gate 失败。纯函数无 IO。

/** 一处敏感命中。 */
export interface SensitiveHit {
  path: string;
  category: 'auth' | 'ci' | 'infra';
}

/** 单路径判类别(优先序 ci → infra → auth;无命中 null)。依赖清单不列敏感(机器可判)。 */
function categoryOf(path: string): SensitiveHit['category'] | null {
  const p = path.toLowerCase();
  const base = p.split('/').pop() ?? '';
  // CI/CD 配置
  if (p.includes('.github/') || /\.ci\.ya?ml$/.test(p) || base === 'jenkinsfile' || p.includes('.gitlab-ci')) return 'ci';
  // 基础设施/部署
  if (
    base === 'dockerfile' ||
    base.startsWith('dockerfile.') ||
    base.startsWith('docker-compose') ||
    p.endsWith('.tf') ||
    p.includes('k8s/') ||
    p.includes('deploy/')
  ) {
    return 'infra';
  }
  // 鉴权/凭证(放最后:具体的 ci/infra 优先)
  if (/auth|login|oauth|credential|session/.test(p)) return 'auth';
  return null;
}

/** 纯函数:对改动路径列表判定敏感面,返回命中 {path, category}[](无命中返回 [])。 */
export function classifySensitive(changedPaths: string[]): SensitiveHit[] {
  const out: SensitiveHit[] = [];
  for (const path of changedPaths) {
    const category = categoryOf(path);
    if (category) out.push({ path, category });
  }
  return out;
}
