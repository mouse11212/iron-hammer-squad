## MODIFIED Requirements

### Requirement: 成功后 squash 提交
inner-loop 结果为 `done` 时,系统 SHALL 把该切片改动在 feature 分支提交为**单个** commit;改动范围 SHALL 据 `git status --porcelain` **动态捕获**实际改动(不限扩展名/目录、含删除),**不依赖外部预先声明的 targetPaths**——预测错路径/命名会静默丢弃 done 的成果——也不盲加 `-A`。捕获 SHALL 排除依赖软链(linkDeps 创建的 node_modules symlink 等非切片产物,避免污染交付物为指向本机绝对路径的不可移植 symlink)。结果非 `done`(failed/blocked-escalated)时 SHALL NOT 提交;无改动时不空提交。

#### Scenario: done 后单提交(动态捕获实际改动)
- **WHEN** 隔离 inner-loop 结果为 done,agent 在 worktree 内创建/修改了文件(无论写在 src/ 或 test/、何种命名)
- **THEN** feature 分支多出且仅多出一个 commit,包含据 git status 捕获的全部切片改动(不要求调用方预先声明路径)

#### Scenario: 排除依赖软链
- **WHEN** worktree 工程内含 linkDeps 创建的 node_modules symlink(因 .gitignore 带尾斜杠只匹配目录而被 porcelain 列出)
- **THEN** squash 不捕获 node_modules,交付物只含切片产物

#### Scenario: 非 done 不提交
- **WHEN** 隔离 inner-loop 结果为 failed 或 blocked-escalated
- **THEN** feature 分支无新提交,改动不进入集成
