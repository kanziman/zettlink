// 카드 리스트 메인 페이지 — 검색·태그 필터·상태 필터
import { CardRow } from '@zettlink/ui'
import { createSupabaseServerClient } from '../../lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; status?: string }>
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type CardWithTags = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  created_at: string
  card_tags: Array<{ tags: { canonical_name: string } | null }> | null
}

async function fetchCards(
  supabase: SupabaseClient,
  { q, tag, status }: { q?: string; tag?: string; status?: string },
): Promise<{ data: CardWithTags[] | null; error: unknown }> {
  // 태그 필터가 있을 때 해당 태그를 가진 card_id 목록을 먼저 조회
  if (tag) {
    const { data: tagRow } = await supabase
      .from('tags')
      .select('id')
      .eq('canonical_name', tag)
      .single()

    if (!tagRow) return { data: [], error: null }

    const { data: cardTagRows } = await supabase
      .from('card_tags')
      .select('card_id')
      .eq('tag_id', tagRow.id)

    const cardIds = (cardTagRows ?? []).map((r) => r.card_id)
    if (cardIds.length === 0) return { data: [], error: null }

    let query = supabase
      .from('cards')
      .select('id, title, url, platform, status, published, created_at, card_tags(tags(canonical_name))')
      .in('id', cardIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (q) query = query.ilike('title', `%${q}%`)
    if (status && status !== 'all') query = query.eq('status', status)

    const result = await query
    return { data: (result.data as CardWithTags[] | null), error: result.error }
  }

  let query = supabase
    .from('cards')
    .select('id, title, url, platform, status, published, created_at, card_tags(tags(canonical_name))')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) query = query.ilike('title', `%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)

  const result = await query
  return { data: (result.data as CardWithTags[] | null), error: result.error }
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { q, tag, status } = await searchParams
  const supabase = await createSupabaseServerClient()

  // server-parallel-fetching: 카드 목록과 태그 목록을 병렬 조회
  const [cardsResult, tagsResult] = await Promise.all([
    fetchCards(supabase, { q, tag, status }),
    supabase
      .from('tags')
      .select('canonical_name')
      .order('usage_count', { ascending: false })
      .limit(30),
  ])

  const cards = cardsResult.data ?? []
  const tags = (tagsResult.data ?? []).map((t) => t.canonical_name)

  const activeStatus = status ?? 'all'

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
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
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
          href={`/?${new URLSearchParams({ ...(q ? { q } : {}), status: activeStatus }).toString()}`}
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
        {tags.map((t) => (
          <a
            key={t}
            href={`/?${new URLSearchParams({ tag: t, ...(q ? { q } : {}), status: activeStatus }).toString()}`}
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
        {(['all', 'done', 'failed'] as const).map((s) => (
          <a
            key={s}
            href={`/?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(tag ? { tag } : {}),
              status: s,
            }).toString()}`}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              background: activeStatus === s ? 'var(--color-primary-normal)' : 'transparent',
              color: activeStatus === s ? '#fff' : 'var(--color-label-alternative)',
              textDecoration: 'none',
              border: '1px solid var(--color-line-normal)',
            }}
          >
            {s === 'all' ? '전체' : s === 'done' ? '완료' : '실패'}
          </a>
        ))}
      </div>

      {/* 카드 목록 */}
      <div
        style={{
          border: '1px solid var(--color-line-normal)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {cards.length === 0 ? (
          <p
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--color-label-alternative)',
              margin: 0,
            }}
          >
            카드가 없습니다.
          </p>
        ) : (
          cards.map((card) => (
            <CardRow
              key={card.id}
              slug={card.id}
              title={card.title}
              url={card.url}
              platform={card.platform}
              status={card.status}
              published={card.published}
              tags={(card.card_tags ?? []).flatMap((ct) =>
                ct.tags ? [ct.tags.canonical_name] : [],
              )}
              createdAt={card.created_at}
              href={`/cards/${card.id}`}
            />
          ))
        )}
      </div>

      <p
        style={{
          marginTop: '1rem',
          fontSize: '0.8125rem',
          color: 'var(--color-label-assistive)',
        }}
      >
        최대 50개 표시
      </p>
    </div>
  )
}
