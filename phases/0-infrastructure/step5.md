# Step 5: slug

## 읽어야 할 파일

- `CLAUDE.md` — TDD 규칙
- `docs/ARCHITECTURE.md` — §2(cards.id = slug PK)
- `docs/ADR.md` — ADR-007(Slug 정책: YouTube=영어 제목 kebab, GitHub=owner-repo)
- `packages/shared/src/url-normalize.ts` — CanonicalUrl 타입 (step 4 산출물)
- `packages/shared/src/index.ts` — step 4 산출물. `canonicalize` re-export 패턴 확인 후 `titleToSlug`, `repoToSlug` re-export를 같은 위치에 추가.
- `phases/0-infrastructure/index.json` — step 0~4 summary

## 작업

`packages/shared/src/slug.ts`를 TDD로 구현하라. **테스트를 먼저 작성하고, 통과하는 구현을 나중에 작성한다.**

### Step 순서 (반드시 이 순서)

1. `packages/shared/src/__tests__/slug.test.ts` 작성
2. `pnpm --filter @zettlink/shared test` 실행 → 실패 확인 (RED)
3. `packages/shared/src/slug.ts` 구현
4. `pnpm --filter @zettlink/shared test` 실행 → 통과 확인 (GREEN)

### `slug.ts` 인터페이스

```typescript
// 영어 제목을 URL-safe kebab-case slug로 변환
export function titleToSlug(title: string): string

// GitHub canonical externalId('owner/repo')를 slug로 변환
export function repoToSlug(externalId: string): string
```

**`titleToSlug` 규칙:**

1. 소문자 변환
2. 영숫자·하이픈·공백만 유지 (한글, 이모지, 특수문자 제거)
3. 공백 → 하이픈
4. 연속 하이픈 → 단일 하이픈
5. 앞뒤 하이픈 제거
6. 최대 80자 truncate (단어 경계에서 자름)
7. 결과가 빈 문자열이면 `'untitled'` 반환

**`repoToSlug` 규칙:**

- `'facebook/react'` → `'facebook-react'`
- `'owner/my.lib'` → `'owner-my-lib'` (점 → 하이픈)
- 이미 kebab 형태면 그대로 반환

### 테스트 케이스 (모두 포함해야 함)

```typescript
// titleToSlug
titleToSlug('How to Build a REST API with Node.js')
  → 'how-to-build-a-rest-api-with-nodejs'

titleToSlug('React 18 새로운 기능 정리 🎉')
  → 'react-18'   // 한글, 이모지 제거

titleToSlug('  multiple   spaces  ')
  → 'multiple-spaces'

titleToSlug('---leading-trailing---')
  → 'leading-trailing'

titleToSlug('한국어만 있는 제목')
  → 'untitled'

titleToSlug('a'.repeat(100))
  → 80자 이하 (단어 경계 준수)

// repoToSlug
repoToSlug('facebook/react')   → 'facebook-react'
repoToSlug('vercel/next.js')   → 'vercel-next-js'
repoToSlug('owner/my-repo')    → 'owner-my-repo'
```

### `packages/shared/src/index.ts` 업데이트

```typescript
export { titleToSlug, repoToSlug } from './slug.js'
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/shared test
# → url-normalize + slug 테스트 전체 PASS
# → coverage: slug.ts 100%

pnpm --filter @zettlink/shared build
# → 컴파일 에러 없음
```

## 금지사항

- `slugify` 등 외부 라이브러리를 사용하지 마라. 순수 문자열 조작으로 구현하라.
- `titleToSlug`에서 한글을 로마자로 변환(romanize)하지 마라. 제거가 맞다.
- 테스트를 나중에 작성하지 마라. 반드시 RED → GREEN 순서를 지켜라.
