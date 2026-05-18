# Step 3: card-list

## 읽어야 할 파일

- `CLAUDE.md` — React 컴포넌트 생성 전 /react-best-practices 스킬 호출 CRITICAL 규칙
- `packages/db/src/types.gen.ts` — cards, tags, card_tags 테이블 Row 타입 확인
- `packages/shared/src/types.ts` — Card, Platform, CardStatus 타입
- `apps/dashboard/lib/supabase/server.ts` — createSupabaseServerClient 시그니처
- `packages/ui/src/index.ts` — CardRow, Tag 컴포넌트 export 확인
- `apps/dashboard/app/layout.tsx` — 루트 레이아웃 구조 확인

## 작업

admin 영역 레이아웃과 카드 리스트 메인 페이지를 구현한다. Server Component 기반으로 검색·태그 필터를 searchParams로 처리한다.

`server-parallel-fetching` 규칙 적용: 카드 목록 조회와 태그 목록 조회는 `Promise.all`로 병렬 실행한다.

### 생성할 파일

**`apps/dashboard/app/(admin)/layout.tsx`**

admin 영역 공통 레이아웃. 서버에서 세션 재확인, 네비게이션 바.

```typescript
// admin 영역 공통 레이아웃 — 네비게이션 바 + 서버 측 admin 재확인
import { redirect } from 'next/navigation'
import { config } from '@zettlink/shared'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (!config.adminUserIds.includes(user.id)) {
    return <div style={{ padding: '2rem' }}>Forbidden</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-normal)' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '0 1.5rem',
        height: '56px',
        borderBottom: '1px solid var(--color-line-normal)',
        position: 'sticky',
        top: 0,
        background: 'var(--color-background-normal)',
        zIndex: 10,
      }}>
        <a href="/" style={{ fontWeight: 700, fontSize: '1.125rem', textDecoration: 'none', color: 'inherit' }}>
          zettlink
        </a>
        <a href="/monitor" style={{ fontSize: '0.875rem', color: 'var(--color-label-alternative)', textDecoration: 'none' }}>
          모니터
        </a>
        <div style={{ flex: 1 }} />
        <LogoutButton />
      </nav>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
```

`LogoutButton`은 같은 파일 하단에 Client Component로 선언한다:

```typescript
'use client'
import { createSupabaseBrowserClient } from '../../lib/supabase/browser'
import { useRouter } from 'next/navigation'

function LogoutButton() {
  const router = useRouter()
  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <button
      onClick={handleLogout}
      style={{
        fontSize: '0.875rem',
        color: 'var(--color-label-alternative)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      로그아웃
    </button>
  )
}
```

**`apps/dashboard/app/(admin)/page.tsx`**

카드 리스트 메인 페이지. Server Component.

searchParams:
- `q`: 제목/URL ilike 검색
- `tag`: 태그 필터 (canonical_name)
- `status`: done | failed | all (기본: all)

```typescript
// 카드 리스트 메인 페이지 — 검색·태그 필터·상태 필터
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { CardRow } from '@zettlink/ui'

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; status?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { q, tag, status } = await searchParams
  const supabase = await createSupabaseServerClient()

  // server-parallel-fetching: 카드 목록과 태그 목록을 병렬 조회
  const [cardsResult, tagsResult] = await Promise.all([
    buildCardsQuery(supabase, { q, tag, status }),
    supabase.from('tags').select('canonical_name').order('usage_count', { ascending: false }).limit(30),
  ])

  const cards = cardsResult.data ?? []
  const tags = (tagsResult.data ?? []).map(t => t.canonical_name)

  return (
    <div>
      {/* 검색 바 */}
      <form method="GET" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="제목 또는 URL 검색"
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: '8px',
            border: '1px solid var(--color-line-strong)',
            background: 'var(--color-background-normal)',
            color: 'var(--color-label-normal)',
            fontSize: '0.9375rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            background: 'var(--color-primary-normal)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          검색
        </button>
      </form>

      {/* 태그 필터 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
        <a
          href="/"
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8125rem',
            background: !tag ? 'var(--color-primary-normal)' : 'var(--color-background-alternative)',
            color: !tag ? '#fff' : 'var(--color-label-normal)',
            textDecoration: 'none',
            border: '1px solid var(--color-line-normal)',
          }}
        >
          전체
        </a>
        {tags.map(t => (
          <a
            key={t}
            href={`/?tag=${encodeURIComponent(t)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.8125rem',
              background: tag === t ? 'var(--color-primary-normal)' : 'var(--color-background-alternative)',
              color: tag === t ? '#fff' : 'var(--color-label-normal)',
              textDecoration: 'none',
              border: '1px solid var(--color-line-normal)',
            }}
          >
            {t}
          </a>
        ))}
      </div>

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['all', 'done', 'failed'] as const).map(s => (
          <a
            key={s}
            href={`/?${new URLSearchParams({ ...(q ? { q } : {}), ...(tag ? { tag } : {}), status: s }).toString()}`}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              background: (status ?? 'all') === s ? 'var(--color-primary-normal)' : 'transparent',
              color: (status ?? 'all') === s ? '#fff' : 'var(--color-label-alternative)',
              textDecoration: 'none',
              border: '1px solid var(--color-line-normal)',
            }}
          >
            {s === 'all' ? '전체' : s === 'done' ? '완료' : '실패'}
          </a>
        ))}
      </div>

      {/* 카드 목록 */}
      <div style={{ border: '1px solid var(--color-line-normal)', borderRadius: '12px', overflow: 'hidden' }}>
        {cards.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-label-alternative)' }}>
            카드가 없습니다.
          </p>
        ) : (
          cards.map(card => (
            <CardRow
              key={card.id}
              slug={card.id}
              title={card.title}
              url={card.url}
              platform={card.platform}
              status={card.status}
              published={card.published}
              tags={card.card_tags?.map((ct: { tags: { canonical_name: string } | null }) => ct.tags?.canonical_name ?? '').filter(Boolean) ?? []}
              createdAt={card.created_at}
              href={`/cards/${card.id}`}
            />
          ))
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--color-label-assistive)' }}>
        최대 50개 표시
      </p>
    </div>
  )
}
```

`buildCardsQuery` 헬퍼를 같은 파일에 선언한다:

```typescript
type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

async function buildCardsQuery(
  supabase: SupabaseClient,
  { q, tag, status }: { q?: string; tag?: string; status?: string },
) {
  let query = supabase
    .from('cards')
    .select('id, title, url, platform, status, published, created_at, card_tags(tags(canonical_name))')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) query = query.ilike('title', `%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)
  if (tag) {
    // 태그 필터: card_tags → tags.canonical_name으로 필터
    const { data: tagRow } = await supabase
      .from('tags')
      .select('id')
      .eq('canonical_name', tag)
      .single()
    if (tagRow) {
      query = query.eq('card_tags.tag_id', tagRow.id)
    }
  }

  return query
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/dashboard build
# → 성공

# 수동 확인 (로컬 dev 서버)
pnpm --filter @zettlink/dashboard dev
# http://localhost:3001 → 카드 리스트 표시
# ?q=검색어 → 제목 필터 동작
# ?tag=태그명 → 태그 필터 동작
# ?status=done → 완료 카드만 표시
```

## 금지사항

- 카드 목록과 태그 목록 조회를 순차 await로 처리하지 마라. `Promise.all`로 병렬 실행.
- Client Component에서 Supabase를 직접 호출하지 마라. 데이터 조회는 Server Component에서.
- `&&` 연산자로 JSX 조건부 렌더링 금지.
- Tailwind의 `text-[]` 등 임의 값 사용 금지. CSS 변수 사용.
