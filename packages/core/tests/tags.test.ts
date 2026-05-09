import { describe, it, expect } from 'vitest';
import { SEED_VOCAB, computeTagFrequency, formatTagHints } from '../src/tags.js';

describe('SEED_VOCAB', () => {
  it('초기 5개 시드 태그를 포함한다', () => {
    expect(SEED_VOCAB).toEqual(['ai', 'agents', 'claude', 'codex', 'productivity']);
  });
});

describe('computeTagFrequency', () => {
  it('카드 frontmatter 배열에서 태그 빈도를 집계한다', () => {
    const cards = [{ tags: ['ai', 'claude'] }, { tags: ['ai', 'agents'] }];
    expect(computeTagFrequency(cards)).toEqual({ ai: 2, claude: 1, agents: 1 });
  });
});

describe('formatTagHints', () => {
  it('빈도 내림차순으로 시드 + 기존 태그를 합쳐 system prompt 문자열을 만든다', () => {
    const hint = formatTagHints({ ai: 5, agents: 3 });
    expect(hint).toContain('ai (5)');
    expect(hint).toContain('agents (3)');
    expect(hint).toContain('claude');   // seed 도 포함
  });
});
