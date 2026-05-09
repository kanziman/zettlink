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

  it('인접 중복만 제거하고 멀리 떨어진 동일 문구는 보존한다', () => {
    const md = vttToMarkdown(auto);
    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toEqual(['hello world', 'this is a test', 'hello world']);
  });
});
