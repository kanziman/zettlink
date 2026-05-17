// YouTube 영상에서 메타데이터와 자막을 추출하는 yt-dlp wrapper
import { execSync } from 'node:child_process'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'

export interface YoutubeExtract {
  videoId: string
  title: string
  description: string
  durationSec: number
  transcript: string
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

export async function extractYoutube(videoId: string): Promise<YoutubeExtract> {
  ensureYtDlp()

  const { execa } = await import('execa')
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const tmpPrefix = `/tmp/zettlink-${videoId}`

  // 임시 파일 경로 목록 (cleanup용)
  const tmpFiles: string[] = []

  try {
    // 메타데이터 추출
    const meta = await execa('yt-dlp', ['--dump-json', '--no-playlist', url])
    const data = JSON.parse(meta.stdout) as Record<string, unknown>

    // 자동 자막 추출 (en 우선, ko 폴백)
    await execa(
      'yt-dlp',
      [
        '--write-auto-sub',
        '--sub-lang', 'en,ko',
        '--sub-format', 'vtt',
        '--skip-download',
        '--output', `${tmpPrefix}.%(ext)s`,
        '--no-playlist',
        url,
      ],
      { reject: false },
    )

    // 생성된 vtt 파일 탐색 (en → ko 순)
    const candidates = [
      `${tmpPrefix}.en.vtt`,
      `${tmpPrefix}.en-auto.vtt`,
      `${tmpPrefix}.ko.vtt`,
      `${tmpPrefix}.ko-auto.vtt`,
    ]

    for (const p of candidates) {
      if (existsSync(p)) tmpFiles.push(p)
    }

    const vttPath = tmpFiles[0]
    if (!vttPath) {
      throw new Error('no transcript available (Phase 1: subtitles only)')
    }

    const vttContent = readFileSync(vttPath, 'utf-8')
    const transcript = vttToText(vttContent)

    return {
      videoId,
      title: String(data['title'] ?? ''),
      description: String(data['description'] ?? ''),
      durationSec: Number(data['duration'] ?? 0),
      transcript,
      rawMetadata: data,
    }
  } finally {
    for (const p of tmpFiles) {
      try { unlinkSync(p) } catch { /* ignore */ }
    }
  }
}
