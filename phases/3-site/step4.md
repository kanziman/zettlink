# Step 4: card-detail

## 읽어야 할 파일

- `apps/site/lib/cards.ts` — step 2 결과물 (getCardBySlug, getAllPublishedSlugs, CardDetail 타입)
- `apps/site/app/page.tsx` — step 3 결과물 (스타일 패턴 참고)
- `docs/ARCHITECTURE.md` — §1 디렉토리 구조 (`[platform]/[slug]/page.tsx` 경로)
- `CLAUDE.md` — react-best-practices 호출 규칙

## 작업

카드 상세 페이지를 구현한다. summary와 insights를 마크다운으로 렌더하고, deep/til/guide 콘텐츠가 있으면 섹션으로 표시한다.

> **CRITICAL:** `.tsx` 파일 생성 전에 `/react-best-practices` 스킬을 호출하라.

### 생성할 파일

**`apps/site/app/[platform]/[slug]/page.tsx`**

```typescript
// 카드 상세 페이지 — summary/insights/심화 콘텐츠 정적 렌더
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getCardBySlug, getAllPublishedSlugs } from '../../../lib/cards'

type Props = {
  params: Promise<{ platform: string; slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs()
  return slugs.map(({ platform, slug }) => ({ platform, slug }))
}

export async function generateMetadata({ params }: Props) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  return { title: card?.title ?? slug }
}

export default async function CardPage({ params }: Props) {
  const { platform, slug } = await params
  const card = await getCardBySlug(platform, slug)
  if (card == null) notFound()

  return (
    <article data-pagefind-body>
      {/* 헤더 */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              background: 'var(--color-background-alternative)',
              color: 'var(--color-label-alternative)',
            }}
          >
            {card.platform}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)' }}>
            {new Date(card.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>

        <h1
          data-pagefind-meta="title"
          style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.75rem' }}
        >
          {card.title ?? card.id}
        </h1>

        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-primary-normal)',
            wordBreak: 'break-all',
          }}
        >
          {card.url}
        </a>

        {/* 태그 */}
        {card.tags.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {card.tags.map((t) => (
              <a
                key={t}
                href={`/tags/${encodeURIComponent(t)}`}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-line-normal)',
                  color: 'var(--color-label-alternative)',
                  textDecoration: 'none',
                }}
              >
                {t}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {/* 구분선 */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-line-normal)', margin: '2rem 0' }} />

      {/* 요약 */}
      {card.summary !== null ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>요약</h2>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.summary}</ReactMarkdown>
          </div>
        </section>
      ) : null}

      {/* 인사이트 */}
      {card.insights !== null && card.insights.length > 0 ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>인사이트</h2>
          <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {card.insights.map((insight, i) => (
              <li key={i} style={{ lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
                {insight}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 심화 콘텐츠 섹션들 */}
      {card.has_deep && card.deep_content !== null ? (
        <section style={{ marginBottom: '2rem' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-line-normal)', margin: '2rem 0' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>심화 요약</h2>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.deep_content}</ReactMarkdown>
          </div>
        </section>
      ) : null}

      {card.has_til && card.til_content !== null ? (
        <section style={{ marginBottom: '2rem' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-line-normal)', margin: '2rem 0' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>TIL</h2>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.til_content}</ReactMarkdown>
          </div>
        </section>
      ) : null}

      {card.has_guide && card.guide_content !== null ? (
        <section style={{ marginBottom: '2rem' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-line-normal)', margin: '2rem 0' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>가이드</h2>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.guide_content}</ReactMarkdown>
          </div>
        </section>
      ) : null}
    </article>
  )
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/site build
# → out/youtube/<slug>/index.html 생성 (published youtube 카드가 있을 경우)
# → out/github/<slug>/index.html 생성 (published github 카드가 있을 경우)
# → 에러 없음

# 로컬 확인
npx serve out -p 3002
# → /youtube/<slug> 접속 시 제목/요약/인사이트/태그 표시
# → has_deep=true 카드의 경우 심화 요약 섹션 표시
```

## 금지사항

- `output: 'export'` 환경에서 동작하지 않는 `useRouter`, `useSearchParams`, `usePathname`을 이 Server Component에서 사용하지 마라.
- `generateStaticParams()`가 없으면 동적 라우트로 인식되어 빌드가 실패한다. 반드시 포함하라.
- `insights`가 jsonb 배열로 저장되어 있으므로, null/비배열 케이스를 항상 방어하라.
- `&&` 연산자로 JSX 조건부 렌더링하지 마라. `condition !== null ? <el /> : null` 형태를 사용하라.
- `className="prose"` 등 Tailwind 유틸리티를 사용할 경우 `@tailwindcss/typography` 플러그인이 설치된 것을 확인하라 (step 1에서 이미 추가).
