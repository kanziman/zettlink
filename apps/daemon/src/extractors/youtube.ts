// yt-dlp 를 subprocess 로 호출해 VTT 자막 + 메타데이터를 받아 transcript.md 형식으로 정리한다.
import { execa } from 'execa';
import { readFile } from 'node:fs/promises';
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

export async function extractYoutube(url: string, workDir: string): Promise<YoutubeExtraction> {
  let stdout: string;
  try {
    const result = await execa('yt-dlp', [
      '--skip-download',
      '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,ko',
      '--sub-format', 'vtt',
      '--print-json',
      '--output', `${workDir}/%(id)s.%(ext)s`,
      url,
    ]);
    stdout = result.stdout;
  } catch (e: any) {
    if (e?.code === 'ENOENT') throw new Error('yt-dlp 가 PATH 에 없다. brew install yt-dlp');
    throw new Error(`yt-dlp 실행 실패. ${e?.message ?? e}`);
  }
  const meta = JSON.parse(stdout);
  const subs = meta.requested_subtitles ?? {};
  let source: YoutubeMeta['subtitle_source'] = 'none';
  let transcript = '';
  // 우선순위. manual > auto.
  for (const lang of ['en', 'ko']) {
    const entry = subs[lang];
    if (!entry?.filepath) continue;
    const isAuto = entry.ext?.includes('auto') || entry.url?.includes('auto');
    source = isAuto ? 'auto' : 'manual';
    const vtt = await readFile(entry.filepath, 'utf8');
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
