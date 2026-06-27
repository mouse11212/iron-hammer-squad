# 词灵岛 Chat（Robo）· 最小安全文本切片 — 设计

> 状态：设计已获 BOSS 批准（2026-06-27）。本文档为 spec，下一步转 writing-plans 出实现计划。
> 来源：PRD v2.1 §7 AI 对话护栏 + 原型 #chat 屏 + 长程验证 brainstorm 决议。
> 载体：`iron-hammer-output/wordspirit/`（Vite+React18+TS）。

## 1. 目标与范围

给词灵岛接入 **AI 词灵伙伴 Robo 的文本对话**（curriculum-bounded 口语陪练，**非开放聊天**），用 DeepSeek（OpenAI 兼容 API）。**最小安全切片**：文本对话 + 按年级 scope + 本质安全护栏 + 输出过滤。

**做（IN）**：
- 文本对话 UI（移植原型 #chat：AI/me 气泡 + 中文小注 + 输入框 + 发送）。
- 服务端按年级 system prompt（词汇/语法 scope + 安全护栏）。
- DeepSeek 调用（key 服务端，OpenAI 兼容）。
- 服务端输出过滤（拦隐私索取/越范 → 安全兜底）。
- 入口：tabbar「对话」（替占位）+ 关卡后可进。
- 首发年级 = 三年级（与可玩 epic 一致；架构按 grade 参数化，扩年级只是数据）。

**不做（OUT，YAGNI/从窄到宽）**：
- 语音输入 / 发音评测（多模态留后续）。
- 快捷气泡脚手架 + 「💡帮我说」生成（留后续）。
- 家长可见面板 UI / 异常告警留痕（基建留后续）。
- 对话历史持久化（本切片仅会话内内存态）。
- 生产部署形态（Vite 中间件仅 dev；真后端属 PRD 后续）。

## 2. 架构（Vite 中间件代理 · key 服务端）

```
客户端 React                    Vite 中间件(dev,服务端)                      外部
Chat.tsx
  └POST /api/chat {grade,messages} ─▶ /api/chat handler
                                       1. buildSystemPrompt(grade, points)  ← grade3 数据 + 语法映射(PRD v2.1)
                                       2. callDeepSeek(sysPrompt, messages, key) ─▶ DeepSeek /chat/completions
                                       3. filterOutput(reply) → 命中替换安全兜底
   ◀─{reply, zh, flagged}─────────────┘
key：wordspirit/.env(gitignored) DEEPSEEK_API_KEY；中间件经 Vite loadEnv 服务端读，绝不 VITE_ 前缀（不进浏览器 bundle）。
```

**安全设计核心**：system prompt 构建 + 输出过滤**全在服务端**，客户端只发 `{grade, messages}`，无法篡改护栏；判定逻辑放可测纯函数，使儿童安全**可验证**。

## 3. 单元（单一职责 · well-defined 接口 · 可独立测）

| 文件 | 接口 | 职责 | 验证 |
|---|---|---|---|
| `src/chat/types.ts` | `ChatMessage{role:'user'\|'assistant', content}`、`ChatReply{reply, zh, flagged}` | 共享类型 | tsc |
| `src/chat/systemPrompt.ts` | `buildSystemPrompt(grade, points): string` | 按年级 scope（词汇示例取自 points、语法按 PRD v2.1 映射）+ 护栏文本 + 中文小注指令 | **纯·TDD** |
| `src/chat/outputFilter.ts` | `filterOutput(text): {safe, reason?}` | 拦隐私索取（真名/住址/电话/学校/年龄）+ 明显越范 | **纯·TDD** |
| `src/chat/safety.ts` | 常量：话题白名单、隐私索取模式 | 护栏数据（供 prompt + filter 共用） | 随上两者测 |
| `src/chat/deepseek.ts` | `callDeepSeek(sysPrompt, messages, opts): Promise<string>` | fetch DeepSeek（OpenAI 兼容），错误/超时处理 | 薄 IO 边界·联调（需 key） |
| `vite-plugin-chat.ts`（独立文件，vite.config 引入） | `configureServer` 装 `/api/chat` handler | 装配 1+2+3 + 读 env key（清晰边界，不塞进 vite.config） | 服务端胶水·联调 |
| `src/components/Chat.tsx` | — | 移植原型 #chat，调 /api/chat，渲染气泡+中文小注+输入 | UI·ui-agent 模式（playwright 验证） |
| `src/App.tsx`（改） | — | screen 加 'chat' 真实接入；tabbar「对话」替占位 | wiring |

## 4. 数据流 + 错误/边界

1. 用户输入英文 → 客户端 append me 气泡 → `POST /api/chat {grade, messages}`。
2. 服务端 `buildSystemPrompt(grade)` → `callDeepSeek` → `filterOutput(reply)`。
3. `filterOutput.safe===false` → reply 替换为安全兜底（"Let's talk about school! 🦊"），flagged=true。
4. 返回 `{reply, zh, flagged}` → 客户端 append Robo 气泡（含中文小注；flagged 时可加柔性提示）。

**错误/边界**：
- key 缺失（.env 无）→ 服务端返回明确错误 `{error:'chat-unconfigured'}`，客户端显示"对话暂未开启"（不崩、不泄露细节）。
- DeepSeek 超时/5xx → 服务端兜底回复 + 不抛给客户端原始错误。
- grade 非法 / messages 空 → 服务端 400（契约严）。
- 中文小注：让模型在回复里给 `{en, zh}`（system prompt 指令 + 服务端解析；解析失败则 zh 省略，不崩）。

## 5. 安全护栏（BOSS 批：本质全入 + 输出过滤）

**system prompt（服务端，按年级）**：
- 角色：Robo，友好简短鼓励；只用**该年级已学**词汇/语法（三年级=be/have got/like+V-ing/一般现在时；**不用过去/将来时**，按 PRD v2.1）。
- 话题白名单：学校/家庭/动物/爱好/颜色/数字等学龄适当；越界温和拉回。
- **永不索取真实隐私**：真名（昵称除外）/住址/电话/学校名/具体年龄/行踪。
- 不诱导延长使用、不培养情感依赖；回应简短、正向、护眼基调。
- 输出格式：英文回复 + 简短中文小注。

**输出过滤（服务端纯函数）**：扫 reply 是否含隐私索取/明显越范模式；命中→安全兜底 + flagged。**纯函数 TDD**，作为 system prompt 之外的**第二道防线**（模型不可靠时兜底）。

## 6. 默认值（已确认）

年级=三年级；模型=`deepseek-chat`；中文小注=模型返 `{en,zh}`；DeepSeek base=`https://api.deepseek.com`（OpenAI 兼容 `/chat/completions`）。

## 7. 测试策略（复用三种 harness 模式）

- **纯逻辑（内循环 TDD）**：`systemPrompt`（按年级 scope 正确、含全部护栏文本、排除越级语法）、`outputFilter`（拦各类隐私索取、放行安全回复、边界）、`safety` 常量。变异门纳入。
- **薄 IO 边界**：`deepseek.ts` 不单元测，真 key 联调（happy + 超时 + key 缺失）。
- **UI（ui-agent 模式）**：`Chat.tsx` playwright 视觉/交互验证（发消息→Robo 回复→中文小注；key 缺失态；越范兜底态）。真 LLM 联调待 key。

## 8. key 处理与安全纪律

- `wordspirit/.env`（gitignored，已确认 .gitignore 含 .DS_Store；需补 `.env`）`DEEPSEEK_API_KEY=...`。
- 中间件 `loadEnv(mode, cwd, '')` 服务端读 `DEEPSEEK_API_KEY`，**绝不 VITE_ 前缀**（VITE_ 会进浏览器 bundle = 泄露）。
- BOSS 经 .env 提供 key（勿明文贴对话——历史有 PAT 泄露教训）；设计/构建（除真 LLM 联调）不阻塞。
- key 进 .env 前先把 `.env` 加进 wordspirit `.gitignore`。

## 9. 验收

- 纯逻辑 gate 全绿 + 变异门达标；Chat.tsx playwright 走通（含 key 缺失/越范兜底态）；接入 key 后真 DeepSeek 联调三年级一轮对话不超纲、不索隐私、有中文小注。
