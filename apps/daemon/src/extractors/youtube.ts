// yt-dlp 를 subprocess 로 호출해 메타데이터 + 자막 (또는 description fallback) 을 받아 transcript.md 형식으로 정리한다.
// 디자인은 zettlink_bak 의 yt-fetcher Python 스크립트에서 가져왔다 — 단계별 fallback + 격리 tmpdir + description fallback.
import { execa } from 'execa';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vttToMarkdown } from './youtube-vtt.js';

export interface YoutubeMeta {
  video_id: string;
  channel: string;
  title: string;
  duration_sec: number;
  thumbnail: string;
  subtitle_source: 'auto' | 'manual' | 'whisper' | 'description' | 'none';
}

export interface YoutubeExtraction {
  meta: YoutubeMeta;
  transcript: string;
}

// 자막 의미 보유 임계 — 너무 짧으면 "[음악]" 한 줄 같은 무의미 자막으로 간주.
const MIN_SUBTITLE_CHARS = 100;
// LLM 토큰 보호 — Python 디자인의 20K 와 동일.
const TRANSCRIPT_MAX_CHARS = 20_000;

interface AttemptResult {
  text: string;
  source: YoutubeMeta['subtitle_source'];
}

async function ytdlpDumpJson(url: string, cookiesBrowser?: string): Promise<any> {
  const args = [
    '--dump-json',
    '--no-playlist',
    '--quiet',
    '--no-check-formats',
    '--ignore-no-formats-error',
  ];
  if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
  args.push(url);
  try {
    const { stdout } = await execa('yt-dlp', args);
    return JSON.parse(stdout);
  } catch (e: any) {
    if (e?.code === 'ENOENT') throw new Error('yt-dlp 가 PATH 에 없다. brew install yt-dlp');
    throw new Error(`yt-dlp 메타데이터 수집 실패. ${e?.shortMessage ?? e?.message ?? e}`);
  }
}

// 단일 (lang, kind) 조합으로 자막 다운로드 시도. 결과 텍스트가 임계 미만이면 null.
async function tryFetchSubtitle(
  url: string,
  lang: string,
  kind: 'manual' | 'auto',
  cookiesBrowser?: string,
): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), `zettlink-yt-${lang}-${kind}-`));
  try {
    const args = [
      '--skip-download',
      '--no-playlist',
      '--quiet',
      '--no-check-formats',
      '--ignore-no-formats-error',
      '--sub-format', 'vtt',
      '--sub-langs', lang,
      '--output', `${dir}/sub.%(ext)s`,
    ];
    args.push(kind === 'auto' ? '--write-auto-sub' : '--write-sub');
    if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
    args.push(url);
    try {
      await execa('yt-dlp', args);
    } catch {
      // 일시 실패는 무시하고 파일 존재 여부로만 판단 (Python 디자인과 동일).
    }
    const files = await readdir(dir);
    const vtt = files.find((f) => f.endsWith('.vtt'));
    if (!vtt) return null;
    const raw = await readFile(join(dir, vtt), 'utf8');
    const text = vttToMarkdown(raw);
    return text.length >= MIN_SUBTITLE_CHARS ? text : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// 언어 무관 첫 번째 수동 자막 다운로드.
async function tryFetchAnySubtitle(url: string, cookiesBrowser?: string): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), 'zettlink-yt-any-'));
  try {
    const args = [
      '--skip-download',
      '--no-playlist',
      '--quiet',
      '--no-check-formats',
      '--ignore-no-formats-error',
      '--write-sub',
      '--sub-langs', 'all',
      '--sub-format', 'vtt',
      '--output', `${dir}/sub.%(ext)s`,
    ];
    if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
    args.push(url);
    try {
      await execa('yt-dlp', args);
    } catch { /* 무시 */ }
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.vtt')) continue;
      const raw = await readFile(join(dir, f), 'utf8');
      const text = vttToMarkdown(raw);
      if (text.length >= MIN_SUBTITLE_CHARS) return text;
    }
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function determineContent(
  url: string,
  description: string,
  cookiesBrowser?: string,
): Promise<AttemptResult> {
  // 우선순위. (1) ko 수동 → (2) ko 자동 → (3) en 수동 → (4) 임의 언어 수동 → (5) description fallback.
  const sequence: Array<[() => Promise<string | null>, YoutubeMeta['subtitle_source']]> = [
    [() => tryFetchSubtitle(url, 'ko', 'manual', cookiesBrowser), 'manual'],
    [() => tryFetchSubtitle(url, 'ko', 'auto', cookiesBrowser), 'auto'],
    [() => tryFetchSubtitle(url, 'en', 'manual', cookiesBrowser), 'manual'],
    [() => tryFetchAnySubtitle(url, cookiesBrowser), 'manual'],
  ];
  for (const [fn, source] of sequence) {
    const text = await fn();
    if (text) return { text: text.slice(0, TRANSCRIPT_MAX_CHARS), source };
  }
  if (description.length >= MIN_SUBTITLE_CHARS) {
    return { text: description.slice(0, TRANSCRIPT_MAX_CHARS), source: 'description' };
  }
  return { text: '', source: 'none' };
}

// workDir 는 호출 측 호환을 위해 받지만 자막 임시 파일은 system tmp 에 격리한다 (vault working tree 오염 방지).
export async function extractYoutube(url: string, _workDir: string, cookiesBrowser?: string): Promise<YoutubeExtraction> {
  const meta = await ytdlpDumpJson(url, cookiesBrowser);
  const description: string = meta.description ?? '';
  const { text, source } = await determineContent(url, description, cookiesBrowser);
  return {
    meta: {
      video_id: meta.id,
      channel: meta.channel ?? meta.uploader ?? '',
      title: meta.title ?? '',
      duration_sec: meta.duration ?? 0,
      thumbnail: meta.thumbnail ?? '',
      subtitle_source: source,
    },
    transcript: text,
  };
}
