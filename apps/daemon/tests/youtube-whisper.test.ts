// execa + OpenAI client 둘 다 mock으로 whisper 폴백을 검증한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('node:fs', () => ({ createReadStream: vi.fn(() => 'fake-stream') }));

import { execa } from 'execa';
import { whisperTranscribe } from '../src/extractors/youtube-whisper.js';

describe('whisperTranscribe', () => {
  beforeEach(() => { (execa as any).mockReset(); });

  it('yt-dlp -x로 mp3 다운로드 후 whisper-1 호출 → 텍스트 반환', async () => {
    (execa as any).mockResolvedValue({ stdout: '' });
    const create = vi.fn().mockResolvedValue({ text: '안녕 세계' });
    const fakeOpenai = { audio: { transcriptions: { create } } } as any;
    const r = await whisperTranscribe('https://youtu.be/abc', '/tmp/work', fakeOpenai);
    expect(r).toBe('안녕 세계');
    expect(execa).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
