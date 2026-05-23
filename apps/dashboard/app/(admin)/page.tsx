// 카드 리스트 메인 페이지 — 통계 행 + 태그/상태 필터 + 그리드 카드
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { TagFilter } from './_components/TagFilter'
import { StatusFilter } from './_components/StatusFilter'
import { CardGrid } from './_components/CardGrid'
import type { CardForGrid } from './_components/CardGrid'

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; status?: string }>
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type SupabaseCardRow = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  created_at: string
  summary: string | null
  card_tags: Array<{ tags: { canonical_name: string } | null }> | null
}

async function fetchCards(
  supabase: SupabaseClient,
  { q, tag, status }: { q?: string; tag?: string; status?: string },
): Promise<SupabaseCardRow[]> {
  if (tag) {
    const { data: tagRow } = await supabase
      .from('tags')
      .select('id')
      .eq('canonical_name', tag)
      .single()
    if (!tagRow) return []

    const { data: cardTagRows } = await supabase
      .from('card_tags')
      .select('card_id')
      .eq('tag_id', tagRow.id)
    const cardIds = (cardTagRows ?? []).map((r: { card_id: string }) => r.card_id)
    if (cardIds.length === 0) return []

    let query = supabase
      .from('cards')
      .select('id, title, url, platform, status, published, created_at, summary, card_tags(tags(canonical_name))')
      .in('id', cardIds)
      .order('created_at', { ascending: false })
      .limit(50)
    if (q) query = query.ilike('title', `%${q}%`)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) console.error('[fetchCards] tag query failed:', error.message)
    return (data ?? []) as SupabaseCardRow[]
  }

  let query = supabase
    .from('cards')
    .select('id, title, url, platform, status, published, created_at, summary, card_tags(tags(canonical_name))')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.ilike('title', `%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) console.error('[fetchCards] query failed:', error.message)
  return (data ?? []) as SupabaseCardRow[]
}

function StatChip({
  value,
  label,
  color = 'var(--color-label-normal)',
}: {
  value: number
  label: string
  color?: string
}) {
  return (
    <div style={{
      background: 'var(--color-background-normal)',
      border: '1px solid var(--color-line-normal)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { q, tag, status } = await searchParams
  const supabase = await createSupabaseServerClient()

  // async-parallel: 카드 목록·태그 목록·전체 통계 병렬 조회
  const [cards, tagsResult, totalResult, doneResult, publishedResult] = await Promise.all([
    fetchCards(supabase, { q, tag, status }),
    supabase
      .from('tags')
      .select('canonical_name')
      .order('usage_count', { ascending: false })
      .limit(30),
    supabase.from('cards').select('*', { count: 'exact', head: true }),
    supabase.from('cards').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    supabase.from('cards').select('*', { count: 'exact', head: true }).eq('published', true),
  ])

  const tags = (tagsResult.data ?? []).map((t: { canonical_name: string }) => t.canonical_name)
  const stats = {
    total: totalResult.count ?? 0,
    done: doneResult.count ?? 0,
    published: publishedResult.count ?? 0,
  }

  const activeStatus = status ?? 'all'

  const gridCards: CardForGrid[] = cards.map((c) => ({
    id: c.id,
    title: c.title,
    url: c.url,
    platform: c.platform,
    status: c.status,
    published: c.published,
    created_at: c.created_at,
    summary: c.summary,
    tags: (c.card_tags ?? []).flatMap((ct) => (ct.tags ? [ct.tags.canonical_name] : [])),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 통계 행 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <StatChip value={stats.total} label="전체 카드" />
        <StatChip value={stats.done} label="완료" color="var(--color-status-success)" />
        <StatChip value={stats.published} label="공개" color="var(--color-primary-normal)" />
      </div>

      {/* 검색 바 */}
      <form method="GET" style={{ display: 'flex', gap: '0.5rem' }}>
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
        {tag != null ? <input type="hidden" name="tag" value={tag} /> : null}
        {status != null ? <input type="hidden" name="status" value={status} /> : null}
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
      <TagFilter tags={tags} activeTag={tag} activeStatus={activeStatus} q={q} />

      {/* 상태 필터 */}
      <StatusFilter activeStatus={activeStatus} activeTag={tag} q={q} />

      {/* 카드 그리드 */}
      <CardGrid cards={gridCards} />

      <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-assistive)' }}>
        최대 50개 표시
      </p>
    </div>
  )
}
