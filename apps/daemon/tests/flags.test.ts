import { describe, it, expect } from 'vitest';
import { parseMessage } from '../src/flags.js';

describe('parseMessage', () => {
  it('첫 URL과 플래그, 나머지 텍스트(=note)를 분리한다', () => {
    const r = parseMessage('https://youtu.be/abc +whisper 메모 텍스트');
    expect(r.url).toBe('https://youtu.be/abc');
    expect(r.flags).toEqual({ force: false, whisper: true });
    expect(r.note).toBe('메모 텍스트');
  });

  it('플래그가 없으면 모두 false 다', () => {
    const r = parseMessage('https://github.com/a/b');
    expect(r.flags).toEqual({ force: false, whisper: false });
  });

  it('URL 이 없으면 url=null 이다', () => {
    expect(parseMessage('그냥 메모').url).toBeNull();
  });

  it('+force +whisper 둘 다 인식한다', () => {
    const r = parseMessage('https://github.com/a/b +force +whisper');
    expect(r.flags).toEqual({ force: true, whisper: true });
  });
});
