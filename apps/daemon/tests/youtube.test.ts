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

const VTT = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n';

describe('extractYoutube', () => {
  beforeEach(() => { (execa as any).mockReset(); });

  it('manual 자막이 있으면 subtitle_source=manual', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    await writeFile(join(dir, 'abc.en.vtt'), VTT, 'utf8');
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({
        id: 'abc', title: 'T', channel: 'C', duration: 60,
        thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
        subtitles: { en: [{ ext: 'vtt' }] },                      // manual subs
        requested_subtitles: { en: { ext: 'vtt' } },
      }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.video_id).toBe('abc');
    expect(r.meta.subtitle_source).toBe('manual');
    expect(r.transcript).toContain('hello');
  });

  it('영상 원어가 한국어인 경우 영어(tlang=en) 가 아닌 한국어(원본 ASR) 자막을 우선한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    await writeFile(join(dir, 'abc.en.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nenglish translated\n', 'utf8');
    await writeFile(join(dir, 'abc.ko.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n안녕하세요\n', 'utf8');
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({
        id: 'abc', title: 'T', channel: 'C', duration: 60, thumbnail: 'x',
        subtitles: {},
        automatic_captions: { ko: [{ ext: 'vtt' }], en: [{ ext: 'vtt' }] },
        requested_subtitles: {
          en: { ext: 'vtt', url: 'https://...&lang=ko&tlang=en' },   // 번역
          ko: { ext: 'vtt', url: 'https://...&lang=ko' },            // 원본 ASR
        },
      }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.subtitle_source).toBe('auto');
    expect(r.transcript).toContain('안녕하세요');
    expect(r.transcript).not.toContain('english translated');
  });

  it('자막이 자동 생성만 있으면 subtitle_source=auto', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    await writeFile(join(dir, 'abc.en.vtt'), VTT, 'utf8');
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({
        id: 'abc', title: 'T', channel: 'C', duration: 60,
        thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
        subtitles: {},                                            // 매뉴얼 없음
        automatic_captions: { en: [{ ext: 'vtt' }] },
        requested_subtitles: { en: { ext: 'vtt' } },
      }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.subtitle_source).toBe('auto');
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
