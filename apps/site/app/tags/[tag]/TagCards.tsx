// 태그별 카드 목록 — SSG 초기값 즉시 표시 후 Supabase 재조회로 최신화(CSR)
'use client'

import { CardRow } from '@zettlink/ui'
import { usePublishedCards } from '../../../lib/use-cards'
import type { CardListItem } from '../../../lib/cards'

export function TagCards({ tag, initial }: { tag: string; initial: CardListItem[] }) {
  const { data: cards, error } = usePublishedCards(tag, initial)

  if (error && cards.length === 0) {
    return (
      <p className="text-status-negative text-body1 py-8">
        노트를 불러오지 못했습니다.
      </p>
    )
  }

  if (cards.length === 0) {
    return (
      <p className="text-label-assistive text-body1 py-8">
        이 태그의 게시된 노트가 없습니다.
      </p>
    )
  }

  return (
    <div className="border border-line-normal-normal rounded-xl overflow-hidden">
      {cards.map((card) => (
        <CardRow
          key={card.id}
          slug={card.id}
          title={card.title}
          url={card.url}
          platform={card.platform}
          status={card.status}
          published={card.published}
          tags={card.tags}
          createdAt={card.created_at}
          href={`/${card.platform}/${card.id}`}
        />
      ))}
    </div>
  )
}
