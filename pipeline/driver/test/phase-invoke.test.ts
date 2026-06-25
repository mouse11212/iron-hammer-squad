import { describe, it, expect } from 'vitest';
import { buildPhaseArgs, parsePhaseResult, isTransientApiError } from '../src/invoke.js';

describe('isTransientApiError（瞬时基础设施错误判别）', () => {
  it.each([
    'API Error: The socket connection was closed unexpectedly',
    'fetch failed',
    'Error: ECONNRESET',
    'request timed out',
    'overloaded_error',
    'rate limit exceeded',
    'HTTP 529',
    'upstream connect error 503',
  ])('瞬时错误 → true: %s', (t) => {
    expect(isTransientApiError(t)).toBe(true);
  });

  it.each([
    '测试断言失败: expected 9 to be 8',
    'TypeError: x is not a function',
    '实现缺失',
    '',
  ])('普通失败 → false: %s', (t) => {
    expect(isTransientApiError(t)).toBe(false);
  });
});

describe('buildPhaseArgs（纯构造 claude argv）', () => {
  it('新会话:用 --session-id,不含 --resume', () => {
    const args = buildPhaseArgs({ prompt: '干活', sessionId: 'uuid-1', resume: false });
    expect(args).toContain('--print');
    expect(args).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--verbose']));
    expect(args).toEqual(expect.arrayContaining(['--session-id', 'uuid-1']));
    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'bypassPermissions'])); // 自主 phase 免审批
    expect(args).not.toContain('--resume');
    expect(args.at(-1)).toBe('干活'); // prompt 走末位位置参数
  });

  it('回修:用 --resume <id>,不含 --session-id', () => {
    const args = buildPhaseArgs({ prompt: '修这条', sessionId: 'uuid-2', resume: true });
    expect(args).toEqual(expect.arrayContaining(['--resume', 'uuid-2']));
    expect(args).not.toContain('--session-id');
    expect(args.at(-1)).toBe('修这条');
  });
});

describe('parsePhaseResult（从 stream-json 行提元数据）', () => {
  const resultLine = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: 'sess-9',
    result: '完成',
    total_cost_usd: 0.012,
    usage: { input_tokens: 10, output_tokens: 5 },
  });

  it('提取 session_id / result / cost,isError=false', () => {
    const m = parsePhaseResult(['{"type":"system"}', '{"type":"assistant"}', resultLine]);
    expect(m.sessionId).toBe('sess-9');
    expect(m.result).toBe('完成');
    expect(m.isError).toBe(false);
    expect(m.costUsd).toBe(0.012);
  });

  it('is_error=true → isError=true', () => {
    const line = JSON.stringify({ type: 'result', is_error: true, session_id: 's', result: '' });
    expect(parsePhaseResult([line]).isError).toBe(true);
  });

  it('无 result 事件 → 视为出错(isError=true)', () => {
    expect(parsePhaseResult(['{"type":"system"}']).isError).toBe(true);
  });

  it('无 result 事件 → noResult=true(进程崩溃前未收尾)', () => {
    const m = parsePhaseResult(['{"type":"system","subtype":"api_retry"}', '{"type":"assistant"}']);
    expect(m.noResult).toBe(true);
    expect(m.isError).toBe(true);
  });

  it('有 result 事件 → noResult=false', () => {
    expect(parsePhaseResult([resultLine]).noResult).toBe(false);
  });

  it('忽略非 JSON 行,不抛错', () => {
    const m = parsePhaseResult(['', 'not json', resultLine]);
    expect(m.sessionId).toBe('sess-9');
  });
});
