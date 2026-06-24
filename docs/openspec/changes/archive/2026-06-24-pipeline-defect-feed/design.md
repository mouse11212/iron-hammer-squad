## Context

Defect Escape Rate 是四指标里最贴近本项目命题(把缺陷拦在放大之前)的一个,但 `defects.json` 手维护(3 条,全 caught,停在 M3)→ 必然漂移。续切片②(追溯链)刚证明"从真实信号确定性派生 + 缺数据诚实回落"的范式有效;本切片把缺陷纳入同一范式。

已确认信号(实证):inner-loop 的 caught 信号确定且丰富——`runs/<jobId>/state.json` 有 `status`/`fixRounds`/`residual: MustFix[]`;`fixRounds>0` = 评审/门抓到缺陷并热回修(如 canonicalizeUrl fixRounds=1 抓到 valueless 参数缺口),`blocked-escalated` 的 residual = 抓到但升级未解。escaped 按定义是合并后人类判断,无干净确定性信号 → 用显式 git trailer。

## Goals / Non-Goals

**Goals:**
- 缺陷记录从手维护改为自动喂:caught 确定性派生、escaped 显式 trailer 挖采,每条可溯源(红线1)。
- 逃逸判定归人(打 trailer)、采集归机器(挖 git)——对齐红线6"人判质量、AI 执行"。
- 沿用 metrics 包「纯函数 + 薄 IO」分层(仿 weave-traces.ts),纯核心穷尽单测。
- 时间口径不对称如实标注,率在缺数据时回落 null(不伪造)。

**Non-Goals:**
- 不改 driver 自动 emit `Defect-Caught:` trailer(把 caught 持久化=后续"持久化存储"切片)。
- 不做 escaped 启发式推断(fix:/revert 猜测,易误报=臆造)。
- 不重建历史 3 条手维护 caught(无机器源,留旧文件 git 历史)。
- 不引入新 capability;不改 defectEscapeRate 的算法(仅加总数 0→null)。

## Decisions

**D1:caught 派生口径 = fixRounds + residualCount。**
- 每个 run:`fixRounds` 次回修各算 1 条 caught(每轮 must-fix 是评审/门抓到的真实缺陷批);escalated 的 `residual.length` 各算 1 条 caught(抓到但没修=仍是 caught)。`fixRounds=0` 且无 residual → 0 条(一次过,不臆造缺陷)。
- *备选*:精确到每个 must-fix desc——但 state.json 只持久化了 fixRounds 计数(非 done 才存 residual 详情),fixRounds 是可得的确定性代理。初始 RED gate **不计**(TDD 正常流,非缺陷)。

**D2:escaped 来源 = git commit trailer `Defect-Escaped: <desc>`。**
- 挖采:`git log --format=%H%x1f%B%x1e`,每 commit 扫 body 行匹配 `/^Defect-Escaped:\s*(.+)$/`(多条/commit 允许)。人发现合并后缺陷时,在修复提交打此 trailer。
- *备选*:独立 escapes.jsonl 手维护文件——又引入一个手维护文件,弃;git trailer 与提交同源、随代码走、可 `git log` 挖。

**D3:分层 = 纯 + 薄 IO(仿 weave-traces.ts)。**
- 纯 `deriveDefects(runs: DefectRunInput[], escapes: EscapeTrailer[]): DefectRecord[]`——纯组装/计数,可穷尽单测。
- 薄 IO `readEscapeTrailers(repoRoot): EscapeTrailer[]`——跑 git,失败返回 [](不抛)。run 读取复用 collect 既有 `readInnerLoopRuns`(扩 `residualCount?`),不重复扫描。

**D4:口径对齐 = 缺数据回落 null + scope 标注。**
- `defectEscapeRate(escaped, total)`:`total===0 → null`(原返回 0,改 null,贴"待埋点"纪律);否则 escaped/total。类型 `number → number|null`。
- 看板分别显示 caught(标"当前 runtime/ephemeral")+ escaped(标"git 全历史/持久");率 null 显"待埋点"。不对称限制写 design+retro,指向"持久化存储"切片。

## Risks / Trade-offs

- [caught ephemeral / escaped persistent 时间窗不对称 → 极端下率失真(fresh checkout caught=0 + 历史 escaped>0 → 100%)] → 缓解:total=0 回落 null;非零时看板标注两侧 scope,提醒读者口径;根治留"持久化 caught"切片。
- [fixRounds 计数 ≠ 精确缺陷数(一轮可能多个 must-fix)] → 接受为确定性代理(下界/同量级);desc 详情只在 escalated residual 可得。诚实标注"以回修轮为代理"。
- [`Defect-Escaped:` trailer 无人打 → escaped 恒 0,看似无逃逸] → 同手维护时代风险,但 trailer 与提交同流程、约定写进 guide 降低遗漏;且 caught 至少自动化,denominator 不再靠人记。
- [git body 解析跨平台换行/编码] → 用 `%x1f`/`%x1e` 分隔 + 逐行 trim 正则,execFileSync 失败返回 []。

## Open Questions

- 无(范围、escaped 来源、口径不对称处理均经 brainstorm 与用户确认)。
