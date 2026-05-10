// yt-dlp 를 subprocess 로 호출해 VTT 자막 + 메타데이터를 받아 transcript.md 형식으로 정리한다.
import { execa } from 'execa';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { vttToMarkdown } from './youtube-vtt.js';

export interface YoutubeMeta {
  video_id: string;
  channel: string;
  title: string;
  duration_sec: number;
  thumbnail: string;
  subtitle_source: 'auto' | 'manual' | 'whisper' | 'none';
}

export interface YoutubeExtraction {
  meta: YoutubeMeta;
  transcript: string;
}

export async function extractYoutube(url: string, workDir: string, cookiesBrowser?: string): Promise<YoutubeExtraction> {
  let stdout: string;
  try {
    // --no-check-formats / --ignore-no-formats-error 는 JS challenge 실패로 비디오 포맷 추출이 막혀도 자막만 받기 위함.
    const args = [
      '--skip-download',
      '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,ko',
      '--sub-format', 'vtt',
      '--print-json',
      '--no-check-formats',
      '--ignore-no-formats-error',
      '--output', `${workDir}/%(id)s.%(ext)s`,
    ];
    if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
    args.push(url);
    const result = await execa('yt-dlp', args);
    stdout = result.stdout;
  } catch (e: any) {
    if (e?.code === 'ENOENT') throw new Error('yt-dlp 가 PATH 에 없다. brew install yt-dlp');
    throw new Error(`yt-dlp 실행 실패. ${e?.message ?? e}`);
  }
  const meta = JSON.parse(stdout);
  const requested: Record<string, { ext?: string; url?: string }> = meta.requested_subtitles ?? {};
  const manualLangs = new Set(Object.keys(meta.subtitles ?? {}));
  // 원본 ASR 은 url 에 tlang= 가 없고 번역본은 있다. 원본 우선으로 정렬.
  const isTranslated = (entry: { url?: string } | undefined): boolean => /[?&]tlang=/.test(entry?.url ?? '');
  const langs = Object.keys(requested);
  // 우선순위. (1) manual subs (2) 원본 ASR auto (3) 번역 ASR auto.
  const ordered = [
    ...langs.filter((l) => manualLangs.has(l)),
    ...langs.filter((l) => !manualLangs.has(l) && !isTranslated(requested[l])),
    ...langs.filter((l) => !manualLangs.has(l) && isTranslated(requested[l])),
  ];

  let source: YoutubeMeta['subtitle_source'] = 'none';
  let transcript = '';
  // yt-dlp 의 --output 템플릿이 자막 파일을 `{id}.{lang}.{ext}` 로 떨어뜨린다. JSON 의 entry 에는 filepath 가 없어 직접 조립.
  for (const lang of ordered) {
    const entry = requested[lang];
    if (!entry) continue;
    const ext = entry.ext ?? 'vtt';
    const path = join(workDir, `${meta.id}.${lang}.${ext}`);
    if (!existsSync(path)) continue;
    source = manualLangs.has(lang) ? 'manual' : 'auto';
    const vtt = await readFile(path, 'utf8');
    transcript = vttToMarkdown(vtt);
    break;
  }
  return {
    meta: {
      video_id: meta.id,
      channel: meta.channel ?? meta.uploader ?? '',
      title: meta.title ?? '',
      duration_sec: meta.duration ?? 0,
      thumbnail: meta.thumbnail ?? '',
      subtitle_source: source,
    },
    transcript,
  };
}
