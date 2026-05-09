import { describe, it, expect } from 'vitest';
import { approxTokens, headTailTruncate } from '../src/tokens.js';

describe('approxTokens', () => {
  it('text.length / 4 의 ceil 값이다', () => {
    expect(approxTokens('a'.repeat(8))).toBe(2);
    expect(approxTokens('a'.repeat(9))).toBe(3);
    expect(approxTokens('')).toBe(0);
  });
});

describe('headTailTruncate', () => {
  it('limit 이하면 원문을 그대로 반환하고 truncated=false', () => {
    const r = headTailTruncate('hello world', 100);
    expect(r).toEqual({ text: 'hello world', truncated: false });
  });
  it('limit 초과면 head + sep + tail 형태로 자르고 truncated=true', () => {
    const text = 'a'.repeat(40000);   // ~10000 토큰
    const r = headTailTruncate(text, 6000);   // 토큰 단위 임계
    expect(r.truncated).toBe(true);
    expect(r.text).toContain('...[truncated]...');
    expect(approxTokens(r.text)).toBeLessThanOrEqual(6000 + 10);
  });
});
