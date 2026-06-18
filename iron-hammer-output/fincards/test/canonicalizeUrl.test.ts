import { describe, it, expect } from 'vitest';
import { canonicalizeUrl } from '../src/canonicalizeUrl.js';

// 纯字符串变换，确定性可测：内联构造输入，不触网络/时钟/随机。
// 逐条覆盖规约 8 个 WHEN/THEN 场景 + 合理边界。
describe('canonicalizeUrl (news-url-canonicalization)', () => {
  // 场景 1：scheme 与 host 转小写；path 与 query 大小写保持不变。
  describe('场景 1 — 仅 scheme/host 小写化，path/query 大小写保留', () => {
    it('host 大写转小写，scheme 转小写', () => {
      expect(canonicalizeUrl('HTTP://Example.COM/path')).toBe('http://example.com/path');
    });

    it('path 大小写敏感，原样保留', () => {
      expect(canonicalizeUrl('https://example.com/Path/To/Article')).toBe(
        'https://example.com/Path/To/Article',
      );
    });

    it('query 键名与值的大小写原样保留（单参数无需排序）', () => {
      expect(canonicalizeUrl('https://example.com/p?Key=Value')).toBe(
        'https://example.com/p?Key=Value',
      );
    });

    it('host 含子域名也整体小写化，但 path 混合大小写不动', () => {
      expect(canonicalizeUrl('https://WWW.Example.Com/MixedCase')).toBe(
        'https://www.example.com/MixedCase',
      );
    });
  });

  // 场景 2：默认端口去掉（http:80 / https:443）；非默认端口保留。
  describe('场景 2 — 默认端口去除，非默认端口保留', () => {
    it('http 的 :80 默认端口被去掉', () => {
      expect(canonicalizeUrl('http://example.com:80/path')).toBe('http://example.com/path');
    });

    it('https 的 :443 默认端口被去掉', () => {
      expect(canonicalizeUrl('https://example.com:443/path')).toBe('https://example.com/path');
    });

    it('非默认端口 :8080 保留', () => {
      expect(canonicalizeUrl('http://example.com:8080/path')).toBe('http://example.com:8080/path');
    });

    it('https 上的 :80 非该 scheme 默认端口，应保留', () => {
      expect(canonicalizeUrl('https://example.com:80/path')).toBe('https://example.com:80/path');
    });
  });

  // 场景 3：去掉 fragment（# 及其后内容）。
  describe('场景 3 — 去除 fragment', () => {
    it('纯 fragment 被去掉', () => {
      expect(canonicalizeUrl('https://example.com/path#section')).toBe(
        'https://example.com/path',
      );
    });

    it('query 之后的 fragment 被去掉，query 保留', () => {
      expect(canonicalizeUrl('https://example.com/path?a=1#frag')).toBe(
        'https://example.com/path?a=1',
      );
    });

    it('仅有 "#" 无内容也被去掉', () => {
      expect(canonicalizeUrl('https://example.com/path#')).toBe('https://example.com/path');
    });
  });

  // 场景 4：移除跟踪参数，保留功能参数。
  describe('场景 4 — 移除跟踪参数，保留功能参数', () => {
    it('移除所有 utm_ 前缀参数，保留功能参数', () => {
      expect(
        canonicalizeUrl(
          'https://example.com/p?utm_source=s&utm_medium=m&utm_campaign=c&utm_term=t&utm_content=co&utm_id=i&id=123',
        ),
      ).toBe('https://example.com/p?id=123');
    });

    // 逐个具名跟踪参数都要能被剥离。
    const namedTrackers = [
      'fbclid',
      'gclid',
      'gbraid',
      'wbraid',
      'dclid',
      'msclkid',
      'twclid',
      'ttclid',
      'igshid',
      'yclid',
      '_ga',
      '_gl',
    ];
    for (const tracker of namedTrackers) {
      it(`移除具名跟踪参数 ${tracker}，保留功能参数 id`, () => {
        expect(canonicalizeUrl(`https://example.com/p?${tracker}=x&id=1`)).toBe(
          'https://example.com/p?id=1',
        );
      });
    }

    it('utm_ 前缀匹配是精确前缀，不误伤无下划线的 utmsource', () => {
      expect(canonicalizeUrl('https://example.com/p?utm_source=x&utmsource=keep')).toBe(
        'https://example.com/p?utmsource=keep',
      );
    });

    it('与跟踪参数名相近但不在清单内的参数（如 gclsrc）应保留', () => {
      expect(canonicalizeUrl('https://example.com/p?gclid=x&gclsrc=keep')).toBe(
        'https://example.com/p?gclsrc=keep',
      );
    });

    it('无值（无 "="）的具名跟踪参数仍被剥离', () => {
      expect(canonicalizeUrl('https://example.com/p?gclid&id=1')).toBe(
        'https://example.com/p?id=1',
      );
    });
  });

  // 场景 5：剩余参数按键名字典序升序；同名重复键保相对顺序；值原样保留。
  describe('场景 5 — 剩余参数按键名排序，重复键保序，值不变', () => {
    it('?b=2&a=1 排序后为 ?a=1&b=2', () => {
      expect(canonicalizeUrl('https://example.com/p?b=2&a=1')).toBe('https://example.com/p?a=1&b=2');
    });

    it('已有序的 ?a=1&b=2 排序后不变（与上例规范化结果相同 → 去重等价）', () => {
      expect(canonicalizeUrl('https://example.com/p?a=1&b=2')).toBe('https://example.com/p?a=1&b=2');
    });

    it('?b=2&a=1 与 ?a=1&b=2 规范化结果相等', () => {
      expect(canonicalizeUrl('https://example.com/p?b=2&a=1')).toBe(
        canonicalizeUrl('https://example.com/p?a=1&b=2'),
      );
    });

    it('同名重复键 ?a=2&a=1 保持彼此相对顺序', () => {
      expect(canonicalizeUrl('https://example.com/p?a=2&a=1')).toBe(
        'https://example.com/p?a=2&a=1',
      );
    });

    it('排序与重复键保序同时成立：?b=1&a=2&a=1 → ?a=2&a=1&b=1', () => {
      expect(canonicalizeUrl('https://example.com/p?b=1&a=2&a=1')).toBe(
        'https://example.com/p?a=2&a=1&b=1',
      );
    });

    it('参数值大小写原样保留', () => {
      expect(canonicalizeUrl('https://example.com/p?z=Hello&a=World')).toBe(
        'https://example.com/p?a=World&z=Hello',
      );
    });

    it('参数值不被解码（百分号转义原样保留）', () => {
      expect(canonicalizeUrl('https://example.com/p?utm_source=x&ref=a%2Fb')).toBe(
        'https://example.com/p?ref=a%2Fb',
      );
    });

    it('无值（无 "="）的功能参数参与排序并原样保留（不补 "="）', () => {
      expect(canonicalizeUrl('https://example.com/p?z&a=1')).toBe('https://example.com/p?a=1&z');
    });
  });

  // 场景 6：移除所有参数后无参数 → 结果不保留 "?"。
  describe('场景 6 — 移空查询后不残留 "?"', () => {
    it('唯一参数是跟踪参数，移除后不带 "?"', () => {
      expect(canonicalizeUrl('https://example.com/path?utm_source=x')).toBe(
        'https://example.com/path',
      );
    });

    it('多个跟踪参数全部移除后不带 "?"', () => {
      expect(canonicalizeUrl('https://example.com/path?utm_source=x&fbclid=y')).toBe(
        'https://example.com/path',
      );
    });

    it('原始就是空查询 "?" 时结果不残留 "?"', () => {
      expect(canonicalizeUrl('https://example.com/path?')).toBe('https://example.com/path');
    });
  });

  // 场景 7：去尾斜杠（非根路径）；根 "/" 也按去尾斜杠处理。
  describe('场景 7 — 去尾斜杠，根路径归一', () => {
    it('非根路径尾斜杠被去掉', () => {
      expect(canonicalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('根路径单独的 "/" 被去掉', () => {
      expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com');
    });

    it('https://a.com/ 与 https://a.com 规范化结果相同', () => {
      expect(canonicalizeUrl('https://a.com/')).toBe(canonicalizeUrl('https://a.com'));
    });

    it('多级 path 末尾尾斜杠被去掉，中间斜杠不动', () => {
      expect(canonicalizeUrl('https://example.com/a/b/')).toBe('https://example.com/a/b');
    });

    it('尾斜杠 path 与 query 并存：去尾斜杠且保留 query', () => {
      expect(canonicalizeUrl('https://example.com/path/?a=1')).toBe('https://example.com/path?a=1');
    });
  });

  // 场景 8：非法绝对 URL → 返回去首尾空白的原始串，不抛错（优雅降级）。
  describe('场景 8 — 非法 URL 优雅降级（trim 原串、不抛错）', () => {
    it('相对路径原样返回（trim 后）', () => {
      expect(canonicalizeUrl('/foo/bar')).toBe('/foo/bar');
    });

    it('无 scheme 的裸串原样返回', () => {
      expect(canonicalizeUrl('example.com/path')).toBe('example.com/path');
    });

    it('畸形串原样返回，不抛错', () => {
      expect(canonicalizeUrl('http://')).toBe('http://');
    });

    it('空串返回空串', () => {
      expect(canonicalizeUrl('')).toBe('');
    });

    it('纯空白串 trim 为空串', () => {
      expect(canonicalizeUrl('   ')).toBe('');
    });

    it('带首尾空白的相对路径返回 trim 后的原串', () => {
      expect(canonicalizeUrl('  /relative/path  ')).toBe('/relative/path');
    });

    it('对任意非法输入都不抛异常（保证去重链不崩）', () => {
      const badInputs = ['', '   ', 'not a url', '/rel', 'http://', '://nohost', 'ht!tp://x'];
      for (const bad of badInputs) {
        expect(() => canonicalizeUrl(bad)).not.toThrow();
      }
    });
  });
});
