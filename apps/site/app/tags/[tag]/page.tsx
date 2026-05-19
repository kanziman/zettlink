// 태그별 카드 목록 정적 페이지
import { notFound } from 'next/navigation'
import { CardRow } from '@zettlink/ui'
import { getAllTags, getCardsByTag } from '../../../lib/cards'

export async function generateStaticParams() {
  const tags = await getAllTags()
  return tags.map((tag) => ({ tag: encodeURIComponent(tag) }))
}

interface PageProps {
  params: Promise<{ tag: string }>
}

export default async function TagPage({ params }: PageProps) {
  const { tag: encodedTag } = await params
  const tag = decodeURIComponent(encodedTag)
  const cards = await getCardsByTag(tag)

  if (cards.length === 0) notFound()

  return (
    <div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '1.5rem',
          color: 'var(--color-label-strong)',
        }}
      >
        #{tag}
      </h1>

      <div
        data-pagefind-body
        style={{
          border: '1px solid var(--color-line-normal)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
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
    </div>
  )
}
