# security-gate Specification

## Purpose
TBD - created by archiving change pipeline-secret-scan-gate. Update Purpose after archive.
## Requirements
### Requirement: 密钥扫描检测器（纯）
系统 SHALL 提供纯函数 `scanSecrets(files)`,对传入文件内容用高精度模式检测硬编码密钥/凭证,返回命中 `{path, line, rule}[]`:GitHub PAT(`ghp_`+36 位 / `github_pat_`)、AWS Access Key(`AKIA`+16 位)、PEM 私钥块(`-----BEGIN [A-Z ]*PRIVATE KEY-----`)、通用赋值字面量(`api_key`/`apikey`/`secret`/`token`/`password` = 引号包裹的非空值)。命中带 1-based 行号与规则名;无命中返回空数组(不臆造)。

#### Scenario: 命中 GitHub PAT
- **WHEN** 文件含 `const t = "ghp_0123456789012345678901234567890123ab"`
- **THEN** 返回一条 `{path, line, rule:'github-pat'}`

#### Scenario: 命中 PEM 私钥
- **WHEN** 文件含 `-----BEGIN RSA PRIVATE KEY-----`
- **THEN** 返回一条 `{rule:'pem-private-key'}`,行号指向该行

#### Scenario: 无密钥 → 空
- **WHEN** 文件为普通源码(无凭证模式)
- **THEN** 返回 `[]`

#### Scenario: 多文件多命中带定位
- **WHEN** 两个文件各含一处密钥
- **THEN** 返回两条,各带正确 path 与 line

### Requirement: 内联豁免（不弱化门）
系统 SHALL 支持内联豁免标记 `// allowlist-secret: <理由>`(命中行同行或紧邻上一行)跳过该处命中;豁免须带理由(空理由不豁免)。豁免是显式可审计的例外(如测试夹具),绝不为消除误报无理由弱化检测。

#### Scenario: 同行豁免
- **WHEN** 命中行尾含 `// allowlist-secret: 测试夹具`
- **THEN** 该命中被跳过(不计入结果)

#### Scenario: 上一行豁免
- **WHEN** 命中行的上一行为 `// allowlist-secret: 文档示例`
- **THEN** 该命中被跳过

#### Scenario: 无理由不豁免
- **WHEN** 豁免标记无理由(`// allowlist-secret:` 后为空)
- **THEN** 命中仍计入(不豁免,防滥用)

### Requirement: 密钥扫描门（阻断交付）
系统 SHALL 提供门函数,扫描**本次改动文件**(据 git status 取改动路径,不回溯全树)读其内容跑 `scanSecrets`,有命中则返回失败 GateResult(摘要含命中文件:行:规则),无命中返回通过;读不到文件/无改动视为通过(不抛)。

#### Scenario: 改动含密钥 → 门失败
- **WHEN** 本次改动某文件含硬编码密钥
- **THEN** 门返回 ok=false,摘要列出命中 path:line:rule

#### Scenario: 改动干净 → 门通过
- **WHEN** 本次改动文件均无密钥
- **THEN** 门返回 ok=true

