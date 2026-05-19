// 공개 사이트 홈 — published 카드 전체 리스트 + 태그 필터 링크
import { CardRow } from '@zettlink/ui'
import { getAllTags, getPublishedCards } from '../lib/cards'

export default async function HomePage() {
  const [cards, tags] = await Promise.all([getPublishedCards(), getAllTags()])

  return (
    <div>
      {/* 태그 필터 chip 목록 — 각 태그 클릭 시 /tags/[tag] 정적 페이지로 이동 */}
      {tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.375rem',
            marginBottom: '1.5rem',
          }}
        >
          {tags.map((tag) => (
            <a
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                background: 'var(--color-background-alternative)',
                color: 'var(--color-label-normal)',
                textDecoration: 'none',
                border: '1px solid var(--color-line-normal)',
              }}
            >
              {tag}
            </a>
          ))}
        </div>
      )}

      {/* 카드 리스트 */}
      <div
        data-pagefind-body
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
            아직 발행된 카드가 없습니다.
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
              tags={card.tags}
              createdAt={card.created_at}
              href={`/${card.platform}/${card.id}`}
            />
          ))
        )}
      </div>
    </div>
  )
}
