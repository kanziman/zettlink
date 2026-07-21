# Step 3: home-page

## 읽어야 할 파일

- `apps/site/lib/cards.ts` — step 2 결과물 (getPublishedCards, getAllTags 시그니처 확인)
- `packages/ui/src/CardRow.tsx` — CardRow 컴포넌트 props 확인
- `packages/ui/src/Tag.tsx` — Tag 컴포넌트 props 확인
- `apps/site/app/layout.tsx` — 공통 레이아웃 구조 확인

## 작업

홈 페이지를 구현한다. published 카드를 최신순으로 나열하고, 태그 클릭 시 `?tag=xxx`로 필터링한다.

### 생성할 파일

**`apps/site/app/page.tsx`**

Server Component. 빌드 타임에 Supabase를 조회해 정적 HTML로 렌더한다.
`data-pagefind-body`로 Pagefind 인덱싱 범위를 지정한다.

```typescript
// 공개 사이트 홈 페이지 — published 카드 리스트, 태그 필터
import Link from 'next/link'
import { getPublishedCards, getAllTags } from '../lib/cards'

type Props = {
  searchParams: Promise<{ tag?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { tag } = await searchParams
  const [cards, tags] = await Promise.all([
    getPublishedCards(tag),
    getAllTags(),
  ])

  return (
    <div>
      {/* 태그 필터 chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
        <Link
          href="/"
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.8125rem',
            border: '1px solid var(--color-line-strong)',
            background: tag == null ? 'var(--color-primary-normal)' : 'transparent',
            color: tag == null ? '#fff' : 'var(--color-label-alternative)',
            textDecoration: 'none',
          }}
        >
          전체
        </Link>
        {tags.map((t) => (
          <Link
            key={t.canonical_name}
            href={`/?tag=${encodeURIComponent(t.canonical_name)}`}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              border: '1px solid var(--color-line-strong)',
              background: tag === t.canonical_name ? 'var(--color-primary-normal)' : 'transparent',
              color: tag === t.canonical_name ? '#fff' : 'var(--color-label-alternative)',
              textDecoration: 'none',
            }}
          >
            {t.canonical_name}
          </Link>
        ))}
      </div>

      {/* 카드 리스트 */}
      <div data-pagefind-body>
        {cards.length === 0 ? (
          <p style={{ color: 'var(--color-label-assistive)', textAlign: 'center', padding: '4rem 0' }}>
            게시된 노트가 없습니다.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0' }}>
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
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-label-normal)',
                        fontSize: '1rem',
                      }}
                    >
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
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {card.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          border: '1px solid var(--color-line-normal)',
                          color: 'var(--color-label-alternative)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-label-assistive)',
                        marginLeft: 'auto',
                      }}
                    >
                      {new Date(card.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/site build
# → out/index.html 생성, 에러 없음

# 로컬 확인 (serve는 devDependency 없이 npx로 실행)
npx serve out -p 3002
# → http://localhost:3002 접속 시 카드 리스트 표시
# → ?tag=typescript 접속 시 필터링 동작
```

## 금지사항

- Server Component에서 `'use client'`를 추가하지 마라. 이 페이지는 빌드 타임에 정적으로 렌더된다.
- `next/navigation`의 `useSearchParams()`를 사용하지 마라. `output: 'export'`에서 서버 searchParams를 사용한다.
- `getPublishedCards` 외에 Supabase를 직접 호출하지 마라.
- `&&` 연산자로 JSX 조건부 렌더링하지 마라. `condition ? <el /> : null` 형태를 사용하라.
