// 카드 상세 페이지 — 요약·인사이트·태그 표시 + 액션 버튼
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'
import { Badge } from '@zettlink/ui'
import { CardActions } from './CardActions'

type BadgeStatus = Parameters<typeof Badge>[0]['status']

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
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-label-alternative)' }}>
            {card.platform}
          </span>
          <Badge status={card.status as BadgeStatus} />
          {card.published ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-status-success)', fontWeight: 600 }}>
              공개
            </span>
          ) : null}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem', margin: '0 0 0.375rem' }}>
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
        <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8125rem', color: 'var(--color-label-alternative)' }}>
          {createdAt}
        </p>
      </div>

      {/* 태그 */}
      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {tags.map((t) => (
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
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--color-label-alternative)' }}>
            요약
          </h2>
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{card.summary}</p>
        </section>
      ) : null}

      {/* 인사이트 */}
      {Array.isArray(card.insights) && card.insights.length > 0 ? (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--color-label-alternative)' }}>
            인사이트
          </h2>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
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
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-assistive)', fontFamily: 'monospace', margin: 0 }}>
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
