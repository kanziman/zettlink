import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vttToMarkdown } from '../src/extractors/youtube-vtt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const auto = readFileSync(join(__dirname, '..', 'fixtures', 'sample-auto.vtt'), 'utf8');

describe('vttToMarkdown', () => {
  it('헤더와 타임스탬프를 제거한다', () => {
    const md = vttToMarkdown(auto);
    expect(md).not.toContain('WEBVTT');
    expect(md).not.toMatch(/\d{2}:\d{2}/);
  });

  it('동일 문구는 글로벌 dedup 으로 한 번만 남긴다 (자동 자막 토큰 낭비 방지)', () => {
    const md = vttToMarkdown(auto);
    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toEqual(['hello world', 'this is a test']);
  });

  it('VTT 인라인 마크업 (<c>, <00:00:01.000>) 을 제거한다', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '<c>hello</c> <00:00:01.000>world',
    ].join('\n');
    expect(vttToMarkdown(vtt)).toBe('hello world');
  });
});
