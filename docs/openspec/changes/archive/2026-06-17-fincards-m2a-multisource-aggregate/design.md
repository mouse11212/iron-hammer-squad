## Context

M2-A 在 fincards 上加"多源聚合",同时作为多角色编排(Planner-Workers-Judge)的首个真实载体。源=Bloomberg markets/economics/technology 三个官方 feed(实测可用)。复用 M0 分层(薄 IO + 纯逻辑)与 M1 变异门。

## Goals / Non-Goals

**Goals:**
- 纯函数 `aggregate(sources: NewsItem[][]): NewsItem[]`:合并 → 按 link 去重 → 按 pubDate 倒序。
- main 多 feed 流程 + 单源失败韧性。
- 多角色编排:测试 Agent(写用例,隔离实现)→ 开发 Agent(实现,不改测试)→ 评审两遍。

**Non-Goals:**
- 不接跨发布方(CNBC/Yahoo 等留后续);本片仅 Bloomberg 多 topic。
- 不做排序选取 Top10/20、不做 LLM 摘要(后续里程碑)。

## Decisions

- **聚合做成纯函数**,入参为"各源已解析的 NewsItem[][]",把网络(多次 fetch)留在 main——延续薄 IO 边界,聚合可确定性测试。
- **去重键 = link**:Bloomberg 同文跨 topic 复用同一 article link,link 比 title 稳。
- **排序 = pubDate 倒序**,Invalid Date 垫底(复用 M0 NaN 处理思路)。
- **韧性在 main**:逐源 try/catch,失败源记 run log 跳过;聚合函数本身只处理成功源的数据。
- **多角色编排机制**:主 session 为 orchestrator,用子 agent 分别承担测试/开发/评审;测试与实现在不同子 agent 的隔离上下文中完成,结构性保证"写测试≠写实现"(V4 §4.6)。

## Risks / Trade-offs

- [子 agent 产出不一致/越界] → 给每个子 agent 明确的文件边界与禁令(测试 agent 不碰 src 实现;开发 agent 不碰 test);评审两遍把关。
- [去重误杀不同文同 link] → Bloomberg link 唯一对应 article,风险低;测试覆盖"不同 link 全保留"。
- [聚合慢] → 纯内存操作,可忽略;多 feed 抓取串行/并行在 main,失败不阻塞。

## Open Questions

- 多 feed 在 main 中串行还是并行抓取(M2-A 先串行,简单可靠;并行留优化)。
