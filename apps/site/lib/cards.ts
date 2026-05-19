// 공개 사이트 빌드 타임 Supabase 조회 — anon 키 전용, SERVICE_ROLE_KEY 불필요
// @zettlink/shared/config 를 import하지 않는다 (SERVICE_ROLE_KEY 검증 없어야 함)
import { createClient } from '@supabase/supabase-js'

// 빌드 타임 anon 클라이언트 — RLS로 published=true 카드만 노출
// SUPABASE_URL / SUPABASE_ANON_KEY는 루트 .env를 next.config.ts에서 로드한 폴백
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수 없음')
  }
  return createClient(url, key)
}

export type CardListItem = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  summary: string | null
  created_at: string
  tags: string[]
}

export type CardDetail = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  summary: string | null
  insights: string[] | null
  has_deep: boolean
  has_til: boolean
  has_guide: boolean
  deep_content: string | null
  til_content: string | null
  guide_content: string | null
  created_at: string
  tags: string[]
}

// Supabase 반환 행 내부 타입 (제네릭 없이 쓰므로 로컬 정의)
type RawRow = {
  id: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  created_at: string
  card_tags: Array<{ tags: { canonical_name: string } | null }> | null
}

type RawDetailRow = RawRow & {
  summary: string | null
  insights: unknown
  has_deep: boolean
  has_til: boolean
  has_guide: boolean
  deep_content: string | null
  til_content: string | null
  guide_content: string | null
}

/** published 카드 리스트. tag 지정 시 해당 태그로 필터링한다. */
export async function getPublishedCards(tag?: string): Promise<CardListItem[]> {
  const supabase = getClient()

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
      .eq('tag_id', (tagRow as { id: number }).id)

    const cardIds = ((cardTagRows ?? []) as Array<{ card_id: string }>).map((r) => r.card_id)
    if (cardIds.length === 0) return []

    const { data } = await supabase
      .from('cards')
      .select('id, title, url, platform, status, published, created_at, card_tags(tags(canonical_name))')
      .in('id', cardIds)
      .eq('published', true)
      .order('created_at', { ascending: false })

    return normalizeList(data)
  }

  const { data } = await supabase
    .from('cards')
    .select('id, title, url, platform, status, published, created_at, card_tags(tags(canonical_name))')
    .eq('published', true)
    .order('created_at', { ascending: false })

  return normalizeList(data)
}

/** 단일 카드 상세. platform + slug(=id)로 조회한다. */
export async function getCardBySlug(platform: string, slug: string): Promise<CardDetail | null> {
  const supabase = getClient()

  const { data } = await supabase
    .from('cards')
    .select(
      'id, title, url, platform, status, published, summary, insights, has_deep, has_til, has_guide, deep_content, til_content, guide_content, created_at, card_tags(tags(canonical_name))',
    )
    .eq('id', slug)
    .eq('platform', platform)
    .eq('published', true)
    .single()

  if (!data) return null

  // Supabase 제네릭 없이 사용하므로 안전한 unknown→타입 캐스트 적용
  const row = data as unknown as RawDetailRow
  const tags = (row.card_tags ?? []).flatMap((ct) =>
    ct.tags ? [ct.tags.canonical_name] : [],
  )

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    platform: row.platform,
    status: row.status,
    published: row.published,
    summary: row.summary ?? null,
    insights: Array.isArray(row.insights) ? (row.insights as string[]) : null,
    has_deep: row.has_deep,
    has_til: row.has_til,
    has_guide: row.has_guide,
    deep_content: row.deep_content,
    til_content: row.til_content,
    guide_content: row.guide_content,
    created_at: row.created_at,
    tags,
  }
}

/** 태그별 카드 리스트. */
export async function getCardsByTag(tag: string): Promise<CardListItem[]> {
  return getPublishedCards(tag)
}

/** generateStaticParams용 [{platform, slug}] 배열. */
export async function getAllPublishedSlugs(): Promise<Array<{ platform: string; slug: string }>> {
  const supabase = getClient()
  const { data } = await supabase
    .from('cards')
    .select('id, platform')
    .eq('published', true)

  return ((data ?? []) as Array<{ id: string; platform: string }>).map((row) => ({
    platform: row.platform,
    slug: row.id,
  }))
}

/** published 카드에 달린 태그 목록 (usage_count 내림차순). */
export async function getAllTags(): Promise<string[]> {
  const supabase = getClient()
  const { data } = await supabase
    .from('tags')
    .select('canonical_name')
    .order('usage_count', { ascending: false })
    .limit(50)

  return ((data ?? []) as Array<{ canonical_name: string }>).map((t) => t.canonical_name)
}

// ─── internal helpers ────────────────────────────────────────────────────────

function normalizeList(data: unknown): CardListItem[] {
  if (!Array.isArray(data)) return []
  return (data as RawRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    platform: row.platform,
    status: row.status,
    published: row.published,
    created_at: row.created_at,
    tags: (row.card_tags ?? []).flatMap((ct) =>
      ct.tags ? [ct.tags.canonical_name] : [],
    ),
  }))
}
