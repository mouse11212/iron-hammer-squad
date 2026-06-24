## Context

M6 安全门第二切片。M6-a(密钥)=must-fix(agent 移除);M6-b(敏感面)=escalate-hold(改动合法但需人签)。`batchIntegrate` 已有 held 机制(`reason:'conflict'|'gate'`,走 handoff 路由人类),M6-b 复用——加 `'sensitive'` 原因。

## Goals / Non-Goals

**Goals:**
- 触及敏感面(鉴权/CI/基础设施)的 feature 即便 clean+green 也 held 路由人签,不自动合(红线7/军规7/D1)。
- 纯路径分类器 + 集成时 held;向后兼容(不注入零变化)。
- 零破坏:既有功能/测试不受影响。

**Non-Goals:**
- 不做内容级语义分析(只路径);不做签字状态机(人签后沿用 handoff 命令手动合);类别硬编码默认集(override 留后续)。
- **依赖清单不列敏感**(用户裁定:机器可判无需人裁决)。
- 不改 M6-a / 其它门。

## Decisions

**D1:动作 = 集成时 held(reason:sensitive)路由人签(用户确认)。** 敏感改动是有效交付(squash 出分支),只是需签字 → 不能用 escalated(丢工作),用 held(保留分支,人签后手动合)。复用 conflict/gate 的 held/handoff 通路。

**D2:三类高精度路径模式(用户确认,去依赖清单)。**
- `auth`:路径含 `auth`/`login`/`oauth`/`credential`/`session`(大小写不敏感)。
- `ci`:`.github/`、`*.ci.yml`/`*.ci.yaml`、`Jenkinsfile`、`.gitlab-ci*`。
- `infra`:`Dockerfile`(任意目录)、`docker-compose*`、`*.tf`、`k8s/`、`deploy/`。
- 普通 `src/*.ts`/`test/*`/`package.json` 不命中。

**D3:向后兼容注入(同 M6-a)。** `batchIntegrate` 加可选 4 参 `sensitiveCheck?: (branch) => Promise<string[]>`(返回命中类别,空=非敏感)。**未注入 → 行为照旧**(既有测试零变化)。真实装配注入:`sensitiveCheck = (branch) => classifySensitive(git diff --name-only base...branch 的路径) 的去重类别`。

**D4:held 顺序与数据。** 每 feature:先 sensitiveCheck → 命中即 held(sensitive,带 categories,跳过 merge)→ 否则原 merge/gate 流。`BatchHeld` 加可选 `categories?: string[]`(sensitive 用)。handoff 渲染 sensitive held 列类别 + "需人类签字后手动合(红线7/D1)"。

**D5:分层。** 纯 `classifySensitive(paths): {path,category}[]`(穷尽单测)+ batchIntegrate 薄接线 + 真实装配的 git-diff 取路径闭包。

## Risks / Trade-offs

- [误判普通改动为敏感] → 高精度路径模式;验证 fincards src/test/package.json 不命中;命中是 held(可人工放行)非硬失败,误判代价可控。
- [漏判(敏感面未覆盖)] → 首切片三类覆盖鉴权/CI/基础设施;新面按真实需要追加(红线3)。
- [注入改 batchIntegrate 破坏既有] → 可选 4 参默认 undefined,既有调用零变化;worktree.ts 全量测试须绿(回归门)。
- [feature 改动路径获取] → 真实装配用 `git diff --name-only <base>...<branch>`(集成 worktree 内);分类器纯、与取路径解耦。

## Open Questions

- 无(动作、类别、向后兼容均经 brainstorm 与用户确认)。
