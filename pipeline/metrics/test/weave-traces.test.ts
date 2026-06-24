import { describe, it, expect } from 'vitest';
import { weaveTraces, type ArchivedChange } from '../src/weave-traces.js';

const ac = (over: Partial<ArchivedChange>): ArchivedChange => ({
  dir: '2026-06-17-fincards-m0-bloomberg-cards',
  specs: ['news-fetch'],
  commit: 'adbac4a',
  changedFiles: ['iron-hammer-output/fincards/test/parse.test.ts'],
  ...over,
});

describe('weaveTraces（纯:从归档 change 组装 TraceLink）', () => {
  it('单 capability change → 织出完整 TraceLink,changeId 去日期前缀', () => {
    const out = weaveTraces([ac({})]);
    expect(out).toEqual([
      { changeId: 'fincards-m0-bloomberg-cards', spec: 'news-fetch', tests: ['parse.test.ts'], commit: 'adbac4a' },
    ]);
  });

  it('多 capability → spec 按字典序斜杠拼接', () => {
    const out = weaveTraces([ac({ specs: ['news-parse', 'news-fetch', 'news-card-render'] })]);
    expect(out[0]?.spec).toBe('news-card-render/news-fetch/news-parse');
  });

  it('无 specs → spec 空串', () => {
    const out = weaveTraces([ac({ specs: [] })]);
    expect(out[0]?.spec).toBe('');
  });

  it('归档 commit 内无测试文件 → tests 诚实退化为 []', () => {
    const out = weaveTraces([ac({ changedFiles: ['src/parse.ts', 'README.md', 'design.md'] })]);
    expect(out[0]?.tests).toEqual([]);
  });

  it('tests 去重 + 按字典序排序;只认 *.test.ts/*.spec.ts(.ts/.js)', () => {
    const out = weaveTraces([
      ac({
        changedFiles: [
          'test/render.test.ts',
          'a/test/render.test.ts', // 同 basename → 去重
          'test/filterToday.spec.ts',
          'test/legacy.spec.js',
          'src/parse.ts', // 非测试 → 排除
          'notes.test.md', // 非 .ts/.js → 排除
        ],
      }),
    ]);
    expect(out[0]?.tests).toEqual(['filterToday.spec.ts', 'legacy.spec.js', 'render.test.ts']);
  });

  it('多 change → 各自独立织链,顺序保持', () => {
    const out = weaveTraces([
      ac({ dir: '2026-06-17-fincards-m0-bloomberg-cards', commit: 'adbac4a' }),
      ac({ dir: '2026-06-23-pipeline-verification-tax', specs: ['harness-metrics'], commit: '93b57cc', changedFiles: ['pipeline/metrics/test/events-tax.test.ts'] }),
    ]);
    expect(out.map((t) => t.changeId)).toEqual(['fincards-m0-bloomberg-cards', 'pipeline-verification-tax']);
    expect(out[1]).toEqual({ changeId: 'pipeline-verification-tax', spec: 'harness-metrics', tests: ['events-tax.test.ts'], commit: '93b57cc' });
  });
});
