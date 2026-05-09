import { describe, it, expect } from 'vitest';
import { youtubeTitleSlug, githubSlug, datedFolder } from '../src/slug.js';

describe('youtubeTitleSlug', () => {
  it('영어 제목을 소문자 + 하이픈으로 변환한다', () => {
    expect(youtubeTitleSlug('How Claude Code Uses Tools')).toBe('how-claude-code-uses-tools');
  });
  it('특수문자는 제거하고 단어 사이만 하이픈으로 묶는다', () => {
    expect(youtubeTitleSlug('AI / Agents: 2026 outlook!')).toBe('ai-agents-2026-outlook');
  });
  it('한글이 섞이면 영문 부분만 남긴다 (LLM 변환 위치는 호출자)', () => {
    expect(youtubeTitleSlug('Claude Code 한국어 시연')).toBe('claude-code');
  });
  it('60자를 초과하면 60자로 자르고 끝의 하이픈을 제거한다', () => {
    const long = 'a'.repeat(70);
    expect(youtubeTitleSlug(long).length).toBeLessThanOrEqual(60);
  });
  it('빈 입력은 fallback-slug 를 반환한다', () => {
    expect(youtubeTitleSlug('')).toBe('untitled');
  });
});

describe('githubSlug', () => {
  it('owner/repo 를 owner-repo 로 변환한다', () => {
    expect(githubSlug('anthropics', 'claude-code')).toBe('anthropics-claude-code');
  });
  it('repo 안의 점·언더바도 그대로 유지한다', () => {
    expect(githubSlug('foo', 'bar.baz_qux')).toBe('foo-bar.baz_qux');
  });
});

describe('datedFolder', () => {
  it('YYYY-MM-DD-{slug} 형태로 만든다', () => {
    expect(datedFolder('2026-05-09', 'hello')).toBe('2026-05-09-hello');
  });
});
