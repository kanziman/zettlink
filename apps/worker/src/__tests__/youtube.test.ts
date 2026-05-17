import { writeFile } from 'node:fs/promises'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const execaMock = vi.fn()

vi.mock('execa', () => ({
  execa: execaMock,
}))

describe('extractYoutube', () => {
  beforeEach(() => {
    execaMock.mockReset()
  })

  it('prefers Korean auto subtitles including ko-orig files', async () => {
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes('--dump-json')) {
        return {
          stdout: JSON.stringify({
            title: '테스트 영상',
            description: 'description should not be used when subtitles exist',
            duration: 123,
          }),
        }
      }

      if (args.includes('--write-auto-sub')) {
        const output = args[args.indexOf('--output') + 1]
        await writeFile(
          output.replace('%(ext)s', 'ko-orig.vtt'),
          `WEBVTT

00:00:00.000 --> 00:00:01.000
안녕하세요 <c>자막</c>입니다. 이 문장은 테스트용 한국어 자동 자막입니다.

00:00:01.000 --> 00:00:02.000
ko-orig 파일명도 자막 후보로 인식해야 하고 description fallback을 사용하면 안 됩니다.

00:00:02.000 --> 00:00:03.000
충분히 긴 자막 본문을 만들어 백업 파이프라인의 최소 길이 정책과 같은 조건을 통과합니다.
`,
          'utf-8',
        )
        return { stdout: '', stderr: '', exitCode: 0 }
      }

      return { stdout: '', stderr: '', exitCode: 0 }
    })

    const { extractYoutube } = await import('../extractors/youtube.js')
    const result = await extractYoutube('video-ko')

    expect(result.transcript).toContain('안녕하세요 자막입니다')
    expect(result.transcript).toContain('ko-orig 파일명도 자막 후보로 인식')
    expect(result.transcriptSource).toBe('subtitle_ko')
  })

  it('falls back to description and records subtitle download failure details', async () => {
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args.includes('--dump-json')) {
        return {
          stdout: JSON.stringify({
            title: 'Fallback video',
            description: 'This is a long enough YouTube description that should be marked as description fallback. '.repeat(3),
            duration: 321,
          }),
        }
      }

      return { stdout: '', stderr: 'HTTP Error 429: Too Many Requests', exitCode: 1 }
    })

    const { extractYoutube } = await import('../extractors/youtube.js')
    const result = await extractYoutube('video-fallback')

    expect(result.transcript).toContain('long enough YouTube description')
    expect(result.transcriptSource).toBe('description')
    expect(result.subtitleFailures.join('\n')).toContain('HTTP Error 429')
  })
})
