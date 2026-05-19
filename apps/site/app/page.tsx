// 공개 사이트 홈 페이지 — published 카드 리스트, 태그 필터
import { getPublishedCards, getAllTags } from '../lib/cards'

export default async function HomePage() {
  const [cards, tags] = await Promise.all([
    getPublishedCards(),
    getAllTags(),
  ])

  return (
    <div>
      {/* 태그 필터 chips — 각 태그 클릭 시 /tags/[tag] 정적 페이지로 이동 */}
      {tags.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '2rem',
          }}
        >
          {tags.map((t) => (
            <a
              key={t}
              href={`/tags/${encodeURIComponent(t)}`}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                border: '1px solid var(--color-line-strong)',
                background: 'transparent',
                color: 'var(--color-label-alternative)',
                textDecoration: 'none',
              }}
            >
              {t}
            </a>
          ))}
        </div>
      ) : null}

      {/* 카드 리스트 */}
      <div data-pagefind-body>
        {cards.length === 0 ? (
          <p
            style={{
              color: 'var(--color-label-assistive)',
              textAlign: 'center',
              padding: '4rem 0',
            }}
          >
            게시된 노트가 없습니다.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              border: '1px solid var(--color-line-normal)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {cards.map((card) => (
              <li
                key={card.id}
                style={{ borderBottom: '1px solid var(--color-line-normal)' }}
              >
                <a
                  href={`/${card.platform}/${card.id}`}
                  style={{
                    display: 'block',
                    padding: '1.25rem 1rem',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        background: 'var(--color-background-alternative)',
                        color: 'var(--color-label-alternative)',
                        flexShrink: 0,
                      }}
                    >
                      {card.platform}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-label-normal)',
                        fontSize: '1rem',
                      }}
                    >
                      {card.title != null ? card.title : card.id}
                    </span>
                  </div>
                  {card.summary != null ? (
                    <p
                      style={{
                        color: 'var(--color-label-alternative)',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        margin: '0.25rem 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.summary}
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.375rem',
                      flexWrap: 'wrap',
                      marginTop: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    {card.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          border: '1px solid var(--color-line-normal)',
                          color: 'var(--color-label-alternative)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-label-assistive)',
                        marginLeft: 'auto',
                      }}
                    >
                      {new Date(card.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
