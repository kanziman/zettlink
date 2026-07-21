# Step 4: card-detail

## 읽어야 할 파일

- `CLAUDE.md` — React 컴포넌트 생성 전 /react-best-practices 스킬 호출 CRITICAL 규칙
- `packages/db/src/types.gen.ts` — cards, card_tags, tags Row 타입
- `packages/shared/src/types.ts` — Card, CardStatus 타입
- `apps/dashboard/lib/supabase/server.ts` — createSupabaseServerClient
- `packages/ui/src/index.ts` — Button, Badge, Tag export 확인
- `apps/worker/src/index.ts` — card.id 가 slug임을 확인 (titleToSlug / repoToSlug 결과)

## 작업

카드 상세 페이지를 구현한다. 서버에서 카드 데이터를 조회하고, 액션 버튼(심화 요약/TIL/가이드/Publish/재처리)은 Client Component로 분리한다.

`server-cache-react` 규칙 적용: 같은 요청 내에서 카드 조회가 중복될 경우를 대비해 `React.cache()`로 래핑한다.

### 생성할 파일

**`apps/dashboard/app/(admin)/cards/[slug]/page.tsx`**

```typescript
// 카드 상세 페이지 — 요약·인사이트·태그 표시 + 액션 버튼
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'
import { Badge } from '@zettlink/ui'
import { CardActions } from './CardActions'

// server-cache-react: 동일 요청 내 중복 조회 방지
const getCard = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('cards')
    .select('*, card_tags(tags(canonical_name))')
    .eq('id', slug)
    .single()
  return data
})

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CardDetailPage({ params }: PageProps) {
  const { slug } = await params
  const card = await getCard(slug)

  if (!card) notFound()

  const tags = (card.card_tags ?? [])
    .map((ct: { tags: { canonical_name: string } | null }) => ct.tags?.canonical_name ?? '')
    .filter(Boolean)

  const createdAt = new Date(card.created_at).toLocaleString('ko-KR')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 헤더 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-label-alternative)' }}>{card.platform}</span>
          <Badge status={card.status as Parameters<typeof Badge>[0]['status']} />
          {card.published ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-status-success)', fontWeight: 600 }}>공개</span>
          ) : null}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>
          {card.title ?? card.url}
        </h1>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.875rem', color: 'var(--color-primary-normal)', wordBreak: 'break-all' }}
        >
          {card.url}
        </a>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-label-alternative)' }}>
          {createdAt}
        </p>
      </div>

      {/* 태그 */}
      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {tags.map(t => (
            <span
              key={t}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                background: 'var(--color-background-alternative)',
                border: '1px solid var(--color-line-normal)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* 요약 */}
      {card.summary !== null ? (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-label-alternative)' }}>
            요약
          </h2>
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{card.summary}</p>
        </section>
      ) : null}

      {/* 인사이트 */}
      {Array.isArray(card.insights) && card.insights.length > 0 ? (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-label-alternative)' }}>
            인사이트
          </h2>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {(card.insights as string[]).map((ins, i) => (
              <li key={i} style={{ lineHeight: 1.6 }}>{ins}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 액션 버튼 */}
      <CardActions
        cardId={card.id}
        hasDeep={card.has_deep}
        hasTil={card.has_til}
        hasGuide={card.has_guide}
        published={card.published}
      />

      {/* vault 경로 */}
      {card.vault_path !== null ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-assistive)', fontFamily: 'monospace' }}>
          vault: {card.vault_path}
        </p>
      ) : null}

      {/* 뒤로 가기 */}
      <div>
        <a href="/" style={{ fontSize: '0.875rem', color: 'var(--color-label-alternative)', textDecoration: 'none' }}>
          ← 목록으로
        </a>
      </div>
    </div>
  )
}
```

**`apps/dashboard/app/(admin)/cards/[slug]/CardActions.tsx`**

액션 버튼 Client Component. API 호출 후 `router.refresh()`로 서버 데이터 갱신.

```typescript
'use client'
// 카드 상세 액션 버튼 — enrich / publish / reprocess
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@zettlink/ui'

interface CardActionsProps {
  cardId: string
  hasDeep: boolean
  hasTil: boolean
  hasGuide: boolean
  published: boolean
}

export function CardActions({ cardId, hasDeep, hasTil, hasGuide, published }: CardActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function callApi(path: string, body: Record<string, unknown>) {
    setError(null)
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }
    return res.json()
  }

  async function handleEnrich(type: 'deep' | 'til' | 'guide') {
    setLoading(type)
    try {
      await callApi('/api/enrich', { id: cardId, type })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  async function handlePublish() {
    setLoading('publish')
    try {
      await callApi('/api/publish', { id: cardId })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  async function handleReprocess() {
    setLoading('reprocess')
    try {
      await callApi('/api/reprocess', { id: cardId })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('deep')}
          disabled={hasDeep || loading !== null}
        >
          {loading === 'deep' ? '생성 중…' : hasDeep ? '심화 완료' : '심화 요약'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('til')}
          disabled={hasTil || loading !== null}
        >
          {loading === 'til' ? '생성 중…' : hasTil ? 'TIL 완료' : 'TIL'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleEnrich('guide')}
          disabled={hasGuide || loading !== null}
        >
          {loading === 'guide' ? '생성 중…' : hasGuide ? '가이드 완료' : '가이드'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePublish}
          disabled={loading !== null}
        >
          {loading === 'publish' ? '처리 중…' : published ? 'Unpublish' : 'Publish'}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleReprocess}
          disabled={loading !== null}
        >
          {loading === 'reprocess' ? '큐잉 중…' : '재처리'}
        </Button>
      </div>
      {error !== null ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-status-error)' }}>{error}</p>
      ) : null}
    </div>
  )
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/dashboard build
# → 성공, /cards/[slug] 라우트 생성 확인

# 수동 확인
# 1. 존재하는 카드 slug로 접근 → 상세 정보 표시
# 2. 없는 slug로 접근 → 404 페이지
# 3. "심화 요약" 버튼 클릭 → /api/enrich POST 호출 → DB has_deep=true
# 4. "Publish" 버튼 클릭 → DB published 반전
```

## 금지사항

- 서버 데이터 조회를 Client Component에서 하지 마라. `getCard()`는 Server Component에서만 호출.
- `&&` 연산자로 JSX 조건부 렌더링 금지.
- 버튼 클릭 핸들러를 Server Action으로 만들지 마라. 이 단계에서는 fetch → API route 패턴 사용.
- `CardActions`에서 Supabase를 직접 호출하지 마라. 반드시 `/api/*` route를 통해서.
