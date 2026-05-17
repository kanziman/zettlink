# Step 4: url-normalize

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(URL은 항상 canonicalize 후 DB 저장), TDD 규칙
- `docs/ADR.md` — ADR-007(URL canonical 정규화 — YouTube/GitHub 변형 목록)
- `packages/shared/src/index.ts` — step 3 산출물. `canonicalize` re-export를 이 파일에 추가해야 한다.
- `phases/0-infrastructure/index.json` — step 0~3 summary

## 작업

`packages/shared/src/url-normalize.ts`를 TDD로 구현하라. **테스트를 먼저 작성하고, 통과하는 구현을 나중에 작성한다.**

### Step 순서 (반드시 이 순서)

1. `packages/shared/src/__tests__/url-normalize.test.ts` 작성
2. `pnpm --filter @zettlink/shared test` 실행 → 실패 확인 (RED)
3. `packages/shared/src/url-normalize.ts` 구현
4. `pnpm --filter @zettlink/shared test` 실행 → 통과 확인 (GREEN)

### `url-normalize.ts` 인터페이스

```typescript
export type CanonicalUrl =
  | { platform: 'youtube'; externalId: string; canonical: string }
  | { platform: 'github'; externalId: string; canonical: string }

// URL을 canonical form으로 변환. 지원하지 않는 도메인이면 null 반환
export function canonicalize(rawUrl: string): CanonicalUrl | null
```

**YouTube canonical 규칙:**
- `external_id` = 11자리 video ID (예: `dQw4w9WgXcQ`)
- canonical URL = `https://www.youtube.com/watch?v={id}`
- 처리해야 할 입력 변형:
  - `youtube.com/watch?v=ID` (기본)
  - `youtu.be/ID` (단축)
  - `youtube.com/shorts/ID`
  - `youtube.com/live/ID`
  - `youtube.com/embed/ID` (임베드)
  - `m.youtube.com/watch?v=ID` (모바일)
  - URL에 추가 쿼리 파라미터 있어도 ID만 추출 (`&t=30`, `&list=...` 등)

**GitHub canonical 규칙:**
- `external_id` = `owner/repo` (소문자, 예: `facebook/react`)
- canonical URL = `https://github.com/{owner}/{repo}`
- 처리해야 할 입력 변형:
  - `github.com/owner/repo` (기본)
  - `github.com/owner/repo/` (trailing slash)
  - `github.com/owner/repo/tree/main` (브랜치)
  - `github.com/owner/repo/blob/main/README.md` (파일)
  - `github.com/owner/repo/pulls` (PR 목록)
  - `github.com/owner/repo/issues` (이슈 목록)
  - `github.com/owner/repo/issues/123` (개별 이슈)
  - 대소문자 혼용 (`GitHub.com/Owner/Repo` → `github.com/owner/repo`)

**미지원 도메인:** `null` 반환.

### 테스트 케이스 (모두 포함해야 함)

```typescript
// YouTube
canonicalize('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  → { platform: 'youtube', externalId: 'dQw4w9WgXcQ', canonical: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }

canonicalize('https://youtu.be/dQw4w9WgXcQ')
  → same externalId

canonicalize('https://www.youtube.com/shorts/dQw4w9WgXcQ')
  → same externalId

canonicalize('https://www.youtube.com/live/dQw4w9WgXcQ')
  → same externalId

canonicalize('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30')
  → same externalId (쿼리 파라미터 무시)

canonicalize('https://www.youtube.com/embed/dQw4w9WgXcQ')
  → same externalId

// GitHub
canonicalize('https://github.com/facebook/react')
  → { platform: 'github', externalId: 'facebook/react', canonical: 'https://github.com/facebook/react' }

canonicalize('https://github.com/Facebook/React/tree/main')
  → same externalId (소문자 정규화)

canonicalize('https://github.com/facebook/react/blob/main/README.md')
  → same externalId

canonicalize('https://github.com/facebook/react/')
  → same externalId (trailing slash 제거)

canonicalize('https://github.com/facebook/react/issues/123')
  → same externalId (개별 이슈 URL)

canonicalize('https://GITHUB.COM/Owner/Repo/pulls')
  → externalId: 'owner/repo'

// 미지원
canonicalize('https://twitter.com/someone')  → null
canonicalize('not-a-url')                     → null
canonicalize('')                              → null
```

### 테스트 프레임워크

`vitest`를 사용하라. `packages/shared/package.json`의 `devDependencies`에 `vitest`를 추가하고 `test` script를 설정하라.

## Acceptance Criteria

```bash
pnpm --filter @zettlink/shared test
# → url-normalize 관련 테스트 전체 PASS
# → coverage: url-normalize.ts 100% (lines, branches, functions)
```

## 금지사항

- 테스트를 나중에 작성하지 마라. 반드시 테스트 먼저(RED), 구현 나중(GREEN) 순서를 지켜라.
- 외부 라이브러리(`url-parse`, `whatwg-url` 등)에 의존하지 마라. Node 22 기본 `URL` API로 구현하라.
- YouTube video ID 길이가 11자가 아닌 경우 null을 반환하라. ID 유효성 검사 포함.
