## ADDED Requirements

### Requirement: 敏感改动分类（纯）
系统 SHALL 提供纯函数 `classifySensitive(changedPaths)`,按路径模式判定改动是否触及敏感面,返回命中 `{path, category}[]`。类别(高精度):**auth**(路径含 `auth`/`login`/`oauth`/`credential`/`session`)、**ci**(`.github/`/`*.ci.yml`/`*.ci.yaml`/`Jenkinsfile`/workflow 文件)、**infra**(`Dockerfile`/`docker-compose*`/`*.tf`/`k8s/`/`deploy/`)。普通源码(如 `src/*.ts`)不命中。**依赖清单不列入敏感类别**(机器可判、无需人裁决)。

#### Scenario: 鉴权路径命中 auth
- **WHEN** 改动含 `src/auth/login.ts`
- **THEN** 返回 `{path:'src/auth/login.ts', category:'auth'}`

#### Scenario: CI 配置命中 ci
- **WHEN** 改动含 `.github/workflows/deploy.yml`
- **THEN** 返回一条 `category:'ci'`

#### Scenario: 基础设施命中 infra
- **WHEN** 改动含 `Dockerfile` 或 `infra/main.tf`
- **THEN** 返回 `category:'infra'`

#### Scenario: 普通源码不命中
- **WHEN** 改动仅 `src/parse.ts`、`test/parse.test.ts`、`package.json`
- **THEN** 返回 `[]`(依赖清单 package.json 不算敏感)

#### Scenario: 多路径多命中
- **WHEN** 改动含 `src/session.ts` 与 `Dockerfile`
- **THEN** 返回两条,类别分别为 auth 与 infra
