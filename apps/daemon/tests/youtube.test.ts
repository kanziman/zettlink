// yt-dlp subprocess 래퍼 extractYoutube 의 순차 fallback 동작을 검증한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
import { extractYoutube } from '../src/extractors/youtube.js';

// 100 자 임계 통과용 더미 자막. 동일 단어가 여러 번이라도 vttToMarkdown 의 글로벌 dedup 으로 한 줄로 줄어드는 점에 유의.
const longText = (label: string) => Array.from({ length: 30 }, (_, i) => `${label} cue ${i}`).join(' ');
const buildVtt = (label: string) => `WEBVTT\n\n00:00:00.000 --> 00:00:30.000\n${longText(label)}\n`;

const baseMeta = {
  id: 'abc', title: 'T', channel: 'C', duration: 60, thumbnail: 'x',
  description: '',
};

interface Scenario {
  meta?: Partial<typeof baseMeta>;
  // key 형태. "ko-manual" / "ko-auto" / "en-manual" / "any-manual"
  subs?: Record<string, string>;
}

function setupMock(s: Scenario): void {
  (execa as any).mockImplementation(async (_cmd: string, args: string[]) => {
    if (args.includes('--dump-json')) {
      return { stdout: JSON.stringify({ ...baseMeta, ...(s.meta ?? {}) }) };
    }
    const langIdx = args.indexOf('--sub-langs');
    const lang = args[langIdx + 1];
    const kind = args.includes('--write-auto-sub') ? 'auto' : 'manual';
    const key = lang === 'all' ? 'any-manual' : `${lang}-${kind}`;
    const text = s.subs?.[key];
    if (text) {
      const outIdx = args.indexOf('--output');
      const tmpl = args[outIdx + 1] as string;
      const dir = tmpl.replace(/\/sub\..*$/, '');
      await writeFile(join(dir, 'sub.vtt'), text, 'utf8');
    }
    return { stdout: '' };
  });
}

describe('extractYoutube', () => {
  beforeEach(() => { (execa as any).mockReset(); });

  it('ko 수동 자막이 있으면 그것을 골라 source=manual', async () => {
    setupMock({ subs: { 'ko-manual': buildVtt('hello korean manual') } });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('manual');
    expect(r.transcript).toContain('hello korean manual');
  });

  it('ko 수동이 없으면 ko 자동 으로 폴백 source=auto', async () => {
    setupMock({ subs: { 'ko-auto': buildVtt('hello korean auto') } });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('auto');
    expect(r.transcript).toContain('hello korean auto');
  });

  it('ko 가 전혀 없으면 en 수동 으로 폴백 source=manual', async () => {
    setupMock({ subs: { 'en-manual': buildVtt('hello english manual') } });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('manual');
    expect(r.transcript).toContain('hello english manual');
  });

  it('모든 자막이 실패하고 description 이 길면 description fallback source=description', async () => {
    setupMock({ meta: { description: 'x'.repeat(500) } });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('description');
    expect(r.transcript.length).toBeGreaterThanOrEqual(100);
  });

  it('모든 자막 + description 도 부족하면 source=none + 빈 transcript', async () => {
    setupMock({ meta: { description: 'short' } });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('none');
    expect(r.transcript).toBe('');
  });

  it('100 자 미만 자막은 무의미하다고 보고 다음 단계로 폴백한다', async () => {
    // ko-manual 은 짧고, ko-auto 가 충분함.
    setupMock({
      subs: {
        'ko-manual': 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n짧음\n',
        'ko-auto': buildVtt('long korean auto'),
      },
    });
    const r = await extractYoutube('https://youtu.be/abc', '/tmp');
    expect(r.meta.subtitle_source).toBe('auto');
  });

  it('yt-dlp PATH 누락 시 식별 가능한 에러를 던진다', async () => {
    (execa as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(extractYoutube('https://youtu.be/abc', '/tmp')).rejects.toThrow(/yt-dlp/);
  });
});
