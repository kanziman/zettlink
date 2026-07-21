// 태그별 카드 목록 정적 페이지
import { notFound } from 'next/navigation'
import { CardRow } from '@zettlink/ui'
import { getAllTags, getCardsByTag } from '../../../lib/cards'

interface PageProps {
  params: Promise<{ tag: string }>
}

export async function generateStaticParams() {
  try {
    const tags = await getAllTags()
    // output:'export'는 빈 배열을 허용하지 않으므로 태그가 없을 때 플레이스홀더 반환
    if (tags.length === 0) return [{ tag: '_placeholder_' }]
    return tags.map((tag) => ({ tag: tag.canonical_name }))
  } catch {
    return [{ tag: '_placeholder_' }]
  }
}

function decodeTagParam(tag: string) {
  try {
    return decodeURIComponent(tag)
  } catch {
    return tag
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { tag } = await params
  const decoded = decodeTagParam(tag)
  return { title: `#${decoded} — zettlink` }
}

export default async function TagPage({ params }: PageProps) {
  const { tag: encodedTag } = await params
  const tag = decodeTagParam(encodedTag)
  const cards = await getCardsByTag(tag)

  if (cards.length === 0) notFound()

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-title3 font-bold text-label-strong m-0">
          #{tag}
        </h1>
        <a
          href="/tags"
          className="text-label1 text-label-alternative no-underline hover:text-primary-normal transition-colors"
        >
          ← 전체 태그
        </a>
      </div>

      <div
        data-pagefind-body
        className="border border-line-normal-normal rounded-xl overflow-hidden"
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
