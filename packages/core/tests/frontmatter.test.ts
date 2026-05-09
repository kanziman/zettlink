// 카드(index.md)의 frontmatter 스키마를 검증하는 테스트.
import { describe, it, expect } from 'vitest';
import { parseIndex, serializeIndex, type IndexFrontmatter } from '../src/frontmatter.js';

const sample: IndexFrontmatter = {
  url: 'https://www.youtube.com/watch?v=abc',
  platform: 'youtube',
  slug: 'how-claude-code-uses-tools',
  captured_at: '2026-05-09T12:00:00Z',
  title: 'How Claude Code Uses Tools',
  summary_one_line: 'Tool calling 모델 정리.',
  tags: ['claude', 'agents'],
  status: 'summarized',
  reviewed: false,
  published: false,
  note: '',
  generated: { deep: false, til: false, guide: false },
  llm: { model: 'claude-sonnet-4-6', truncated: false },
  youtube: {
    video_id: 'abc',
    channel: 'Anthropic',
    duration_sec: 120,
    thumbnail: 'https://i.ytimg.com/vi/abc/maxres.jpg',
    subtitle_source: 'auto',
  },
};

describe('serialize/parse round trip', () => {
  it('serialize → parse 후 동일한 객체가 복원된다', () => {
    const md = serializeIndex(sample, '본문 요약 텍스트');
    const { frontmatter, body } = parseIndex(md);
    expect(frontmatter).toEqual(sample);
    expect(body.trim()).toBe('본문 요약 텍스트');
  });

  it('platform=github 카드는 youtube 키를 포함하지 않는다', () => {
    const gh: IndexFrontmatter = {
      ...sample,
      platform: 'github',
      youtube: undefined,
      github: { owner: 'a', repo: 'b', stars: 10, primary_language: 'TS', topics: ['x'] },
    };
    const md = serializeIndex(gh, '');
    expect(md).not.toMatch(/^youtube:/m);
    expect(md).toMatch(/^github:/m);
  });

  it('알 수 없는 키가 있으면 throw 한다', () => {
    const md = '---\nplatform: weird\n---\n';
    expect(() => parseIndex(md)).toThrow();
  });
});
