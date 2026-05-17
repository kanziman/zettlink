// YouTube 영상에서 메타데이터와 자막을 추출하는 yt-dlp wrapper
import { execSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface YoutubeExtract {
  videoId: string
  title: string
  description: string
  durationSec: number
  transcript: string
  transcriptSource: 'subtitle_ko' | 'subtitle_en' | 'subtitle_other' | 'description'
  subtitleFailures: string[]
  rawMetadata: Record<string, unknown>
}

function vttToText(vtt: string): string {
  return vtt
    .split('\n')
    .filter((line) => !line.match(/^(WEBVTT|NOTE|[\d:\.]+\s*-->)/))
    .filter((line) => line.trim())
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ensureYtDlp(): void {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' })
  } catch {
    throw new Error('yt-dlp not found. Install: brew install yt-dlp')
  }
}

async function findVttFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  return entries
    .filter((entry) => entry.endsWith('.vtt'))
    .sort()
    .map((entry) => join(dir, entry))
}

async function trySubtitle(
  url: string,
  mode: 'manual' | 'auto',
  langs: string,
  source: YoutubeExtract['transcriptSource'],
): Promise<{ transcript: string, source: YoutubeExtract['transcriptSource'], failure?: string }> {
  const { execa } = await import('execa')
  const dir = await mkdtemp(join(tmpdir(), 'zettlink-youtube-sub-'))

  try {
    const result = await execa(
      'yt-dlp',
      [
        mode === 'auto' ? '--write-auto-sub' : '--write-sub',
        '--sub-langs', langs,
        '--sub-format', 'vtt',
        '--skip-download',
        '--output', join(dir, 'sub.%(ext)s'),
        '--no-playlist',
        url,
      ],
      { reject: false },
    )

    const vttFiles = await findVttFiles(dir)
    if (!vttFiles[0]) {
      const stderr = result.stderr.trim()
      const detail = stderr || `yt-dlp exit ${result.exitCode ?? 0} produced no vtt files`
      return { transcript: '', source, failure: `${mode}:${langs}: ${detail}` }
    }

    const transcript = vttToText(await readFile(vttFiles[0], 'utf-8'))
    if (transcript.length < 100) {
      return { transcript: '', source, failure: `${mode}:${langs}: subtitle text too short (${transcript.length} chars)` }
    }

    return { transcript, source }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function extractYoutube(videoId: string): Promise<YoutubeExtract> {
  ensureYtDlp()

  const { execa } = await import('execa')
  const url = `https://www.youtube.com/watch?v=${videoId}`

  // 메타데이터 추출
  const meta = await execa('yt-dlp', ['--dump-json', '--no-playlist', url])
  const data = JSON.parse(meta.stdout) as Record<string, unknown>
  const subtitleFailures: string[] = []

  const attempts: Array<Parameters<typeof trySubtitle>> = [
    [url, 'manual', 'ko', 'subtitle_ko'],
    [url, 'auto', 'ko-orig,ko', 'subtitle_ko'],
    [url, 'manual', 'en', 'subtitle_en'],
    [url, 'manual', 'all', 'subtitle_other'],
  ]

  for (const attempt of attempts) {
    const result = await trySubtitle(...attempt)
    if (result.transcript) {
      return {
        videoId,
        title: String(data['title'] ?? ''),
        description: String(data['description'] ?? ''),
        durationSec: Number(data['duration'] ?? 0),
        transcript: result.transcript,
        transcriptSource: result.source,
        subtitleFailures,
        rawMetadata: data,
      }
    }
    if (result.failure) subtitleFailures.push(result.failure)
  }

  // 자막 없음 또는 다운로드 실패 → description fallback (100자 미만이면 추출 불가로 처리)
  const desc = String(data['description'] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
  if (desc.length < 100) {
    throw new Error('no transcript available: subtitles missing and description too short')
  }

  return {
    videoId,
    title: String(data['title'] ?? ''),
    description: String(data['description'] ?? ''),
    durationSec: Number(data['duration'] ?? 0),
    transcript: desc.slice(0, 20_000),
    transcriptSource: 'description',
    subtitleFailures,
    rawMetadata: data,
  }
}
