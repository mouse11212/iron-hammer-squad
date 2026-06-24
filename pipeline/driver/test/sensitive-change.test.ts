import { describe, it, expect } from 'vitest';
import { classifySensitive } from '../src/sensitive-change.js';

describe('classifySensitive（纯:按路径判定敏感面）', () => {
  it('鉴权/凭证 → auth', () => {
    expect(classifySensitive(['src/auth/login.ts'])).toEqual([{ path: 'src/auth/login.ts', category: 'auth' }]);
    expect(classifySensitive(['lib/oauthClient.ts']).map((h) => h.category)).toEqual(['auth']);
    expect(classifySensitive(['src/session.ts', 'src/credentialStore.ts']).map((h) => h.category)).toEqual(['auth', 'auth']);
  });

  it('CI/CD 配置 → ci', () => {
    expect(classifySensitive(['.github/workflows/deploy.yml']).map((h) => h.category)).toEqual(['ci']);
    expect(classifySensitive(['release.ci.yaml', 'Jenkinsfile', '.gitlab-ci.yml']).map((h) => h.category)).toEqual(['ci', 'ci', 'ci']);
  });

  it('基础设施/部署 → infra', () => {
    expect(classifySensitive(['Dockerfile', 'ops/Dockerfile.prod', 'docker-compose.yml', 'infra/main.tf', 'k8s/dep.yaml', 'deploy/run.sh']).map((h) => h.category))
      .toEqual(['infra', 'infra', 'infra', 'infra', 'infra', 'infra']);
  });

  it('普通源码/测试/依赖清单不命中 → []', () => {
    expect(classifySensitive(['src/parse.ts', 'test/parse.test.ts', 'package.json', 'package-lock.json', 'README.md'])).toEqual([]);
  });

  it('多路径多命中带类别;ci 优先于 auth(.github 下含 auth 仍归 ci)', () => {
    expect(classifySensitive(['src/session.ts', 'Dockerfile'])).toEqual([
      { path: 'src/session.ts', category: 'auth' },
      { path: 'Dockerfile', category: 'infra' },
    ]);
    expect(classifySensitive(['.github/workflows/auth-check.yml']).map((h) => h.category)).toEqual(['ci']);
  });
});
