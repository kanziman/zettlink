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

  it('종결자 없는 큐는 한 문단으로 합치고 글로벌 dedup 한다', () => {
    const md = vttToMarkdown(auto);
    expect(md).toBe('hello world this is a test');
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

  it('한국어 문장 종결자 (.) 뒤에서 줄을 끊는다', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '맥락이 없어요. 기억이 없어요.',
      '',
      '00:00:02.000 --> 00:00:04.000',
      '매번 새로 시작이에요.',
    ].join('\n');
    expect(vttToMarkdown(vtt)).toBe('맥락이 없어요.\n기억이 없어요.\n매번 새로 시작이에요.');
  });

  it('종결자 직후 공백 누락 (자동 자막 노이즈) 도 정상 처리한다', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      '근데 말이죠.이 문제를',
      '',
      '00:00:02.000 --> 00:00:04.000',
      '해결하는 방법이 있어요.',
    ].join('\n');
    expect(vttToMarkdown(vtt)).toBe('근데 말이죠.\n이 문제를 해결하는 방법이 있어요.');
  });

  it('cue 가 mid-sentence 로 끊겨도 합쳐서 한 문장으로 만든다', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      'AA한테 물어보면 잘 대답하는데',
      '',
      '00:00:02.000 --> 00:00:04.000',
      '다음날 또 물어보면 또 처음부터',
      '',
      '00:00:04.000 --> 00:00:06.000',
      '설명해야 해요.',
    ].join('\n');
    expect(vttToMarkdown(vtt)).toBe('AA한테 물어보면 잘 대답하는데 다음날 또 물어보면 또 처음부터 설명해야 해요.');
  });
});
