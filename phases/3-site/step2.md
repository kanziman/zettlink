# Step 2: lib-cards

## 읽어야 할 파일

- `docs/ARCHITECTURE.md` — §2 데이터 모델 (cards/tags/card_tags 스키마), §6 패턴 (사이트 데이터 페칭)
- `packages/db/src/types.gen.ts` — Database 타입 (step 0 이후 deep_content 포함)
- `supabase/migrations/0001_init.sql` — RLS 정책 확인 (anon은 published=true cards만 select)
- `supabase/migrations/0002_content_columns.sql` — 추가된 content 컬럼 확인
- `apps/site/app/layout.tsx` — step 1 결과물

## 작업

빌드 타임 Supabase 조회 함수를 구현한다. 이 파일은 서버(빌드) 환경에서만 실행되며 anon 키만 사용한다. site 앱은 `@zettlink/db`를 사용하지 않고 이 파일에서 `@supabase/supabase-js`를 직접 import한다.

### 생성할 파일

**`apps/site/lib/cards.ts`**

```typescript
// 공개 사이트 빌드 타임 Supabase 조회 함수 — anon 키, RLS로 published만 노출
import { createClient } from '@supabase/supabase-js'

// 빌드 환경 전용. 브라우저 번들에 포함되지 않음
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export type CardSummary = {
  id: string
  platform: string
  title: string | null
  summary: string | null
  created_at: string
  tags: string[]
}

export type CardDetail = CardSummary & {
  url: string
  insights: string[] | null
  has_deep: boolean
  has_til: boolean
  has_guide: boolean
  deep_content: string | null
  til_content: string | null
  guide_content: string | null
}

export type TagItem = {
  canonical_name: string
  usage_count: number
}

// published 카드 목록 (최신순, 태그 필터 옵션)
export async function getPublishedCards(tag?: string): Promise<CardSummary[]> {
  if (tag) {
    const { data, error } = await supabase
      .from('card_tags')
      .select(`
        cards!inner(id, platform, title, summary, created_at),
        tags!inner(canonical_name)
      `)
      .eq('tags.canonical_name', tag)
      .eq('cards.published', true)
      .order('cards(created_at)', { ascending: false })
      .limit(100)

    if (error) throw error

    // 태그 조인 결과 평탄화
    const cards = await Promise.all(
      (data ?? []).map(async (row) => {
        const card = row.cards as unknown as { id: string; platform: string; title: string | null; summary: string | null; created_at: string }
        const cardTags = await getCardTagNames(card.id)
        return { ...card, tags: cardTags }
      })
    )
    return cards
  }

  const { data, error } = await supabase
    .from('cards')
    .select('id, platform, title, summary, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const cards = await Promise.all(
    (data ?? []).map(async (card) => {
      const tags = await getCardTagNames(card.id)
      return { ...card, tags }
    })
  )
  return cards
}

// 단일 카드 상세 (platform + slug)
export async function getCardBySlug(platform: string, slug: string): Promise<CardDetail | null> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, platform, url, title, summary, insights, has_deep, has_til, has_guide, deep_content, til_content, guide_content, created_at')
    .eq('platform', platform)
    .eq('id', slug)
    .eq('published', true)
    .single()

  if (error) return null

  const tags = await getCardTagNames(data.id)
  return {
    ...data,
    insights: Array.isArray(data.insights) ? (data.insights as string[]) : null,
    tags,
  }
}

// 태그별 카드 목록
export async function getCardsByTag(tag: string): Promise<CardSummary[]> {
  return getPublishedCards(tag)
}

// published 카드가 가진 모든 태그 목록 (usage_count DESC)
export async function getAllTags(): Promise<TagItem[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('canonical_name, usage_count')
    .order('usage_count', { ascending: false })
    .limit(100)

  if (error) throw error
  return data ?? []
}

// generateStaticParams용 — published 카드의 {platform, slug} 배열
export async function getAllPublishedSlugs(): Promise<Array<{ platform: string; slug: string }>> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, platform')
    .eq('published', true)

  if (error) throw error
  return (data ?? []).map((c) => ({ platform: c.platform, slug: c.id }))
}

// 내부 헬퍼 — 카드 id로 태그 canonical_name 배열 조회
async function getCardTagNames(cardId: string): Promise<string[]> {
  const { data } = await supabase
    .from('card_tags')
    .select('tags(canonical_name)')
    .eq('card_id', cardId)

  return (data ?? [])
    .map((row) => {
      const tag = row.tags as unknown as { canonical_name: string } | null
      return tag?.canonical_name ?? ''
    })
    .filter(Boolean)
}
```

## Acceptance Criteria

```bash
# 타입 체크
pnpm --filter @zettlink/site typecheck
# → 에러 없음

# 빌드 시 lib/cards.ts 임포트 에러 없음
pnpm --filter @zettlink/site build
# → 성공
```

## 금지사항

- `@zettlink/db`, `@zettlink/db/server`, `@zettlink/db/browser`를 import하지 마라. site는 `@supabase/supabase-js`를 직접 사용한다.
- `SUPABASE_SERVICE_ROLE_KEY`를 참조하지 마라. anon 키로 RLS를 신뢰한다.
- `published=false` 카드가 응답에 포함되는 쿼리를 작성하지 마라. 모든 쿼리에 `.eq('published', true)` 조건을 포함한다.
- `output: 'export'` 환경에서 `next/headers`나 `next/cookies`를 import하지 마라. 이 파일은 빌드 타임에 Node.js 환경에서만 실행된다.
