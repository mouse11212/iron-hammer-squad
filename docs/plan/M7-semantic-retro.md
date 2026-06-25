# 复盘 · M7-c 语义相似度 drift sensor

> 日期 2026-06-25 · change `pipeline-drift-semantic-sensor` · 扩 `drift-monitor` capability
> drift 三型补齐第二型（Semantic）；首次引入外部依赖（embedding）。

## KB 接地（强制,先查再决策）

按 CLAUDE.md 用 `claude-obsidian:wiki-query` 读 `[[topics/agent-drift]]`（arXiv:2601.04170）：
- **Semantic Drift = agent 输出渐进偏离原始任务意图但语法仍有效**（示例：财务 agent 从「风险聚焦」语言漂移到「机会强调」语言，tone 变而无显式指令）。
- **检测法 = Output Semantic Similarity（embedding cosine similarity）** + Confidence Calibration（Jensen-Shannon divergence）。属 ASI **Response Consistency** 类（四类权重最高 0.30）。
- KB **未给语义 drift 的绝对阈值**——只有 ASI 总框架 τ=0.75/连续三窗/50 交互窗。这本身是「τ 沿用框架默认待标定」的 KB 依据。

## 做了什么

补齐 drift 三型的第二型（继 M7-a Behavioral 工具序列、M7-b Behavioral 人工干预）。

- 纯 `cosine(a, b)`：KB 指定的语义检测法。零向量→0（不臆造，避免 0/0 NaN）；维度不等→抛（embedding provider 契约违例，红线6 不静默吞）。
- 纯 `semanticConsistencySeries(vecs)`：相对首基线的 cosine 序列（同 M7-a 相对基线）。
- 注入接口 `EmbedFn = (text)=>number[]`（不绑定模型）+ 数据结构 `SemanticResponse {ts,traceId,text}`。
- 组装 `computeSemanticDrift`：复用 M7-a `driftAlert`（语义一致性**跌破 τ** = 偏离原意，与工具序列同方向）；embed 缺省/响应不足 → insufficient-data。

## 验证来源（可溯源）

- metrics gate 全绿：lint(`eslint .`) + tsc + **100 测试**（88→100，+12），**既有 88 零影响**。
- **合成验证**：测试自带 embedding（把 "x,y" 文本解析成二维向量），渐进旋转偏离基线 → cosine 序列 `[0.6,0.3,0]` 连续三窗 <τ → **正确告警**；语义稳定 → 不告警；ts 乱序先排序。
- **诚实路径**：不注入 embed / 响应 <2 → `insufficient-data` 不告警——机制不臆造已发生语义漂移。

## 贯穿洞察

- **第三次「把不确定性关在纯函数外」，外部条件最多的一刀**：M7-a 信号纯/离线/已可算；M7-b 已有 ledger 数据；M7-c **两个外部条件都缺**（响应文本未采集 + embedding 未接）。应对仍是同一招——把 embedding 做成注入接口、cosine/告警是确定性纯核，用合成 embedding 即可穷尽单测。**数据/能力的「有没有」与逻辑的「对不对」彻底解耦**。
- **第五次「待埋点」哲学，且双重**：M4+ 待埋点 → NFR 待标定 → M7-a → M7-b → **M7-c（双重待埋点）**。机制确定、阈值占位、无数据/无能力不告警。
- **框架第三次复用、同方向**：语义一致性「跌破 τ」与工具序列「跌破 τ」同方向，直接复用 `driftAlert`（M7-b 是反向镜像 `risingAlert`）。一个连续-k 窗框架已覆盖 drift 三型里两型的告警。
- **契约违例显式抛而非静默**：cosine 维度不等→抛，把 embedding provider 的错误做成可见失败（红线6），不让错误相似度悄悄进入告警判定。

## 固有限制 / 待后续

- **双重待埋点**：① 响应文本采集（需改 invoke stream-json 落 assistant 文本，碰核心执行路径，用户裁定留后续独立切片单独验证）；② embedding provider 接入（离线 embedding 选型，待定）。两者齐备前 sensor 恒为 insufficient-data。
- **Confidence Calibration（JS 散度）未做**：语义检测第二条腿，从窄到宽先 cosine。
- **相对首基线 / 固定 τ**：同 M7-a，真实数据到位后可切 rolling-window + 标定语义专用阈值。

## M7 后续候选

M7-d 共识/协调 sensor（需多 agent 同任务）→ M7-e 复合 ASI（12 维加权，纳入 §7）→ M7-f 缓解 EMC/ABA/DAR → M7-g 两级拓扑。**真信号仍待长程任务测试 + 响应文本采集 + embedding 接入**——M7 越往后外部前置越多，长程任务测试是共同关键路径。
