import { describe, it, expect } from 'vitest';
import { detectPlatform, normalizeUrl } from '../src/url.js';

describe('detectPlatform', () => {
  it('youtube.com/watch URL은 youtube 다', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
  });
  it('youtu.be 단축 URL도 youtube 다', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
  });
  it('github.com/owner/repo 는 github 다', () => {
    expect(detectPlatform('https://github.com/anthropics/claude-code')).toBe('github');
  });
  it('지원 안 하는 URL은 null 이다', () => {
    expect(detectPlatform('https://example.com/x')).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('youtube watch URL은 video_id 표준 형태로 정규화', () => {
    const u = normalizeUrl('https://www.youtube.com/watch?v=abc123&t=42');
    expect(u).toEqual({ platform: 'youtube', videoId: 'abc123', canonical: 'https://www.youtube.com/watch?v=abc123' });
  });
  it('youtu.be 단축 URL도 video_id 표준 형태로', () => {
    const u = normalizeUrl('https://youtu.be/abc123?si=foo');
    expect(u).toEqual({ platform: 'youtube', videoId: 'abc123', canonical: 'https://www.youtube.com/watch?v=abc123' });
  });
  it('github URL은 owner/repo 로 정규화 (트레일링 슬래시·서브패스 제거)', () => {
    const u = normalizeUrl('https://github.com/anthropics/claude-code/blob/main/README.md');
    expect(u).toEqual({ platform: 'github', owner: 'anthropics', repo: 'claude-code', canonical: 'https://github.com/anthropics/claude-code' });
  });
  it('미지원 URL은 null 이다', () => {
    expect(normalizeUrl('https://example.com/')).toBeNull();
  });
});
