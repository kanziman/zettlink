// yt-dlp subprocess 래퍼 extractYoutube 의 단위 테스트 (execa mock).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { extractYoutube } from '../src/extractors/youtube.js';

describe('extractYoutube', () => {
  beforeEach(() => { (execa as any).mockReset(); });

  it('manual 자막이 있으면 subtitle_source=manual', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    const vttPath = join(dir, 'video.en.vtt');
    await writeFile(vttPath, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n', 'utf8');
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({
        id: 'abc', title: 'T', channel: 'C', duration: 60,
        thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
        requested_subtitles: { en: { filepath: vttPath } },
      }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.video_id).toBe('abc');
    expect(r.meta.subtitle_source).toBe('manual');
    expect(r.transcript).toContain('hello');
  });

  it('자막이 전혀 없으면 subtitle_source=none + 빈 transcript', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({ id: 'abc', title: 'T', channel: 'C', duration: 60, thumbnail: 'x' }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.subtitle_source).toBe('none');
    expect(r.transcript).toBe('');
  });

  it('yt-dlp PATH 누락 시 식별 가능한 에러를 던진다', async () => {
    (execa as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(extractYoutube('https://youtu.be/abc', '/tmp')).rejects.toThrow(/yt-dlp/);
  });
});
