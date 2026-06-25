## 1. op 序列 + Levenshtein 一致性（纯，TDD）

- [x] 1.1 RED：写 `drift-sensor.test.ts`——`opSequence` 按 ts 排序取 token(`phase:<role>`/op),无匹配 traceId → []
- [x] 1.2 RED：`levenshtein` token 数组编辑距离(相同=0、增删改各 +1)
- [x] 1.3 RED：`seqConsistency` = 1 - dist/max(len)([0,1];完全一致=1;1/4 差异=0.75;双空=1;一空一非空=0)
- [x] 1.4 GREEN：实现 `opSequence`/`levenshtein`/`seqConsistency`(`pipeline/metrics/src/drift-sensor.ts`)

## 2. 滚动窗口告警（纯，TDD）

- [x] 2.1 RED：`driftAlert(series, tau, k)`——连续 k 个 < tau → alert+首触发位;无连续 k → 不告警;长度 < k → 不告警(数据不足)
- [x] 2.2 GREEN：实现 `driftAlert`(默认 tau=0.75,k=3 取自 KB)

## 3. 薄 IO + 组装

- [x] 3.1 薄 reader 读 events.jsonl(保 ts/op/phase/traceId,逐行 parse 跳畸形,缺文件 [])
- [x] 3.2 薄组装 `computeDrift(events)`：按 traceId 分组(按各 US 首 ts 排序)→ op 序列 → 相对基线(首 US 序列)算一致性序列 → driftAlert;事件不足 → "数据不足/待长程"态(不臆造)

## 4. 验证

- [x] 4.1 metrics gate 全绿(lint+tsc+vitest;纯函数穷尽精确断言;**既有测试零影响**)
- [x] 4.2 真实验证(非破坏)：构造合成 op 序列(基线 + 渐变漂移序列)→ computeDrift → 连续三窗 < τ 正确告警;稳定序列 → 不告警;空 events → 数据不足。**诚实标注**:真 drift 信号待长程任务测试,本验证证机制正确

## 5. 收尾（规约同步 + 立项 + 归档 + 提交）

- [x] 5.1 backlog 立项 M7 段(拆解 M7-a..g + 首切片 M7-a)
- [x] 5.2 `openspec validate pipeline-drift-toolseq-sensor --strict` 通过
- [x] 5.3 更新 `pipeline/README.md`(drift 监控 sensor)与 `docs/context/RESUME.md`(M7 启动、M7-a 完成)
- [x] 5.4 复盘 `docs/plan/M7-drift-retro.md`(新建,KB 接地引用)
- [x] 5.5 `openspec archive pipeline-drift-toolseq-sensor` → `git commit` + `push`
