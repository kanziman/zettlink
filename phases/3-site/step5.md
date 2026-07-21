# Step 5: tags-page

## 읽어야 할 파일

- `apps/site/lib/cards.ts` — step 2 결과물 (getAllTags, getCardsByTag, getAllPublishedSlugs 시그니처)
- `apps/site/app/page.tsx` — step 3 결과물 (카드 리스트 스타일 패턴)

## 작업

태그별 카드 필터 페이지와 태그 인덱스 페이지를 구현한다.

### 생성할 파일

**`apps/site/app/tags/page.tsx`**

모든 태그를 usage_count 순으로 나열하는 인덱스 페이지.

```typescript
// 전체 태그 목록 페이지
import Link from 'next/link'
import { getAllTags } from '../../lib/cards'

export const metadata = { title: '태그 목록 — zettlink' }

export default async function TagsIndexPage() {
  const tags = await getAllTags()

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>태그</h1>
      {tags.length === 0 ? (
        <p style={{ color: 'var(--color-label-assistive)' }}>태그가 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {tags.map((tag) => (
            <Link
              key={tag.canonical_name}
              href={`/tags/${encodeURIComponent(tag.canonical_name)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: '1px solid var(--color-line-strong)',
                color: 'var(--color-label-alternative)',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              {tag.canonical_name}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-label-assistive)',
                }}
              >
                {tag.usage_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**`apps/site/app/tags/[tag]/page.tsx`**

특정 태그의 카드만 필터링해 표시하는 페이지.
`generateStaticParams()`로 빌드 타임에 모든 태그 경로를 정적 생성한다.

```typescript
// 태그별 카드 필터 페이지
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllTags, getCardsByTag } from '../../../lib/cards'

type Props = {
  params: Promise<{ tag: string }>
}

export async function generateStaticParams() {
  const tags = await getAllTags()
  return tags.map((t) => ({ tag: encodeURIComponent(t.canonical_name) }))
}

export async function generateMetadata({ params }: Props) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  return { title: `#${decoded} — zettlink` }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const cards = await getCardsByTag(decoded)

  if (cards.length === 0) notFound()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>#{decoded}</h1>
        <Link
          href="/tags"
          style={{ fontSize: '0.875rem', color: 'var(--color-label-alternative)' }}
        >
          ← 전체 태그
        </Link>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
        {cards.map((card) => (
          <li
            key={card.id}
            style={{ borderBottom: '1px solid var(--color-line-normal)' }}
          >
            <Link
              href={`/${card.platform}/${card.id}`}
              style={{ display: 'block', padding: '1.25rem 0', textDecoration: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '4px',
                    background: 'var(--color-background-alternative)',
                    color: 'var(--color-label-alternative)',
                    flexShrink: 0,
                  }}
                >
                  {card.platform}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-label-normal)', fontSize: '1rem' }}>
                  {card.title ?? card.id}
                </span>
              </div>
              {card.summary !== null ? (
                <p
                  style={{
                    color: 'var(--color-label-alternative)',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    margin: '0.25rem 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {card.summary}
                </p>
              ) : null}
              <span style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)', marginTop: '0.5rem', display: 'block' }}>
                {new Date(card.created_at).toLocaleDateString('ko-KR')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/site build
# → out/tags/index.html 생성
# → out/tags/<tag>/index.html 생성 (published 카드가 있는 태그마다)
# → 에러 없음

# 로컬 확인
npx serve out -p 3002
# → /tags 접속 시 태그 목록 표시
# → /tags/typescript 접속 시 해당 태그 카드만 표시
# → /tags/존재하지않는태그 → 404 페이지
```

## 금지사항

- `generateStaticParams()`를 생략하지 마라. 동적 라우트 없이 `output: 'export'`에서 빌드가 실패한다.
- tag 파라미터는 URL 인코딩이 적용될 수 있으므로 `decodeURIComponent()`를 거친 후 쿼리에 사용하라.
- `&&` 연산자로 JSX 조건부 렌더링하지 마라.
