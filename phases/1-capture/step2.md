# Step 2: extractor-yt

## 읽어야 할 파일

- `CLAUDE.md` — 기술 스택 (yt-dlp)
- `docs/ADR.md` — ADR-011(YouTube 추출 = yt-dlp), ADR-012(Whisper Phase 1 skip)
- `packages/shared/src/url-normalize.ts` — CanonicalUrl 타입
- `apps/worker/src/index.ts` — dispatch 함수 (extractor 연결 위치)
- `phases/1-capture/index.json` — step 0~1 summary

## 작업

`apps/worker/src/extractors/youtube.ts`를 구현하라. yt-dlp CLI wrapper.

### 생성할 파일

**`apps/worker/src/extractors/youtube.ts`**

인터페이스:

```typescript
export interface YoutubeExtract {
  videoId: string
  title: string
  description: string
  durationSec: number
  transcript: string        // 자동 자막 텍스트 (없으면 throws)
  rawMetadata: Record<string, unknown>
}

export async function extractYoutube(videoId: string): Promise<YoutubeExtract>
```

구현 상세:

1. yt-dlp 존재 확인:
```typescript
const { execSync } = await import('node:child_process')
try { execSync('yt-dlp --version', { stdio: 'ignore' }) }
catch { throw new Error('yt-dlp not found. Install: brew install yt-dlp') }
```

2. 메타데이터 + 자막 추출:
```typescript
const url = `https://www.youtube.com/watch?v=${videoId}`
const { execa } = await import('execa')

// JSON 메타데이터
const meta = await execa('yt-dlp', [
  '--dump-json', '--no-playlist', url
])
const data = JSON.parse(meta.stdout)

// 자동 자막 (en 우선, 없으면 ko, 없으면 throw)
const subtitleResult = await execa('yt-dlp', [
  '--write-auto-sub', '--sub-lang', 'en,ko',
  '--sub-format', 'vtt', '--skip-download',
  '--output', '/tmp/zettlink-%(id)s.%(ext)s', url
], { reject: false })

const vttPath = `/tmp/zettlink-${videoId}.en.vtt`
  || `/tmp/zettlink-${videoId}.ko.vtt`
// vtt 파일 파싱 → plain text
```

3. VTT → plain text 변환 (간단한 정규식):
```typescript
function vttToText(vtt: string): string {
  return vtt
    .split('\n')
    .filter(line => !line.match(/^(WEBVTT|NOTE|[\d:\.]+\s*-->/))
    .filter(line => line.trim())
    .join(' ')
    .replace(/<[^>]+>/g, '')  // HTML 태그 제거
    .replace(/\s+/g, ' ')
    .trim()
}
```

4. 자막이 없으면 throw:
```typescript
throw new Error('no transcript available (Phase 1: subtitles only)')
```

5. `/tmp` 임시 파일 cleanup (finally 블록)

**`apps/worker/src/extractors/index.ts`**

```typescript
export { extractYoutube } from './youtube.js'
export { extractGithub } from './github.js'  // step 3에서 구현
export type { YoutubeExtract } from './youtube.js'
export type { GithubExtract } from './github.js'
```

**`apps/worker/package.json` 업데이트**

dependencies에 추가:
- `execa`: `^9`

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# yt-dlp 설치 확인
yt-dlp --version && echo "yt-dlp OK"

# 자막 없음 에러 처리 확인
grep -r "no transcript" apps/worker/src/extractors/youtube.ts && echo "no-transcript error OK"

# execa 의존성 확인
grep '"execa"' apps/worker/package.json && echo "execa dependency OK"
```

## 금지사항

- `child_process.exec` 콜백 패턴을 쓰지 마라. `execa`로 Promise 기반 처리.
- YouTube Data API v3를 사용하지 마라. yt-dlp만.
- 자막 없는 영상을 강제 처리하지 마라. Phase 1은 throw, Phase 4에서 whisper.cpp 추가 예정.
- 임시 파일을 `/tmp` 외 경로에 쓰지 마라. finally 블록에서 반드시 cleanup.
