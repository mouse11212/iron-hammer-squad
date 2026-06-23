import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// 统一操作事件:一条操作 = 一行 JSONL,贯穿一个 US 全链(traceId=jobId)。
// 可观测属 computational sensor(KB guides-and-sensors):确定、可测——故构造器纯、时钟注入,IO 落薄边界 sink。

/** 操作类型:inner-loop 全链的关键操作。 */
export type EventOp = 'phase' | 'gate' | 'squash' | 'integrate' | 'orchestrator-fix';

/** phase 事件的角色。 */
export type PhaseRole = 'test' | 'dev' | 'review';

/** 统一事件 schema。可选字段缺省即不出现(不臆造默认值)。 */
export interface Event {
  /** ISO8601;由注入时钟提供,构造器不读系统时钟。 */
  ts: string;
  /** 贯穿一个 US 全链 = jobId。 */
  traceId: string;
  op: EventOp;
  /** op='phase' 时的角色。 */
  phase?: PhaseRole;
  /** op 特定:ok|error|done|failed|merged|held...。 */
  status?: string;
  /** 该操作耗时——为后续 Verification Tax 切片预留钩子。 */
  durationMs?: number;
  /** op 特定结构化数据。 */
  payload?: Record<string, unknown>;
}

/** makeEvent 入参(与 Event 同构:ts 必由调用方注入)。 */
export type MakeEventInput = Event;

/** 纯构造器:仅装配传入字段,可选字段缺省即省略键,无 IO、不读时钟。 */
export function makeEvent(input: MakeEventInput): Event {
  const ev: Event = { ts: input.ts, traceId: input.traceId, op: input.op };
  if (input.phase !== undefined) ev.phase = input.phase;
  if (input.status !== undefined) ev.status = input.status;
  if (input.durationMs !== undefined) ev.durationMs = input.durationMs;
  if (input.payload !== undefined) ev.payload = input.payload;
  return ev;
}

/** 事件落盘函数:一条 Event。 */
export type EventSink = (ev: Event) => void;

/**
 * 薄 IO sink:序列化为单行 JSON 追加写入 path(append-only),目标目录不存在先建。
 * 仅做序列化 + 追加,无计算逻辑。
 */
export function makeEventSink(path: string): EventSink {
  return (ev: Event): void => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(ev) + '\n');
  };
}
