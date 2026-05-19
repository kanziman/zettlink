// 홈 페이지 카드 리스트 — ?tag= URL param 클라이언트 필터링 (useEffect + window.location)
'use client'

import { useState, useEffect } from 'react'
import type { CardListItem, TagItem } from '../lib/cards'

type Props = {
  cards: CardListItem[]
  tags: TagItem[]
}

export function CardList({ cards, tags }: Props) {
  // 초기값 undefined: 서버 pre-render 시 전체 카드 노출 → Pagefind 인덱싱 가능
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)

  useEffect(() => {
    function readTag() {
      const params = new URLSearchParams(window.location.search)
      setActiveTag(params.get('tag') ?? undefined)
    }
    readTag()
    window.addEventListener('popstate', readTag)
    return () => window.removeEventListener('popstate', readTag)
  }, [])

  function handleTagClick(name: string, e: React.MouseEvent) {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (params.get('tag') === name) {
      params.delete('tag')
    } else {
      params.set('tag', name)
    }
    const next = params.toString() ? `/?${params.toString()}` : '/'
    window.history.pushState({}, '', next)
    setActiveTag(params.get('tag') ?? undefined)
  }

  function handleAllClick(e: React.MouseEvent) {
    e.preventDefault()
    window.history.pushState({}, '', '/')
    setActiveTag(undefined)
  }

  const filtered = activeTag != null
    ? cards.filter((c) => c.tags.includes(activeTag))
    : cards

  return (
    <div>
      {/* 태그 필터 chips — ?tag=xxx URL param 방식 */}
      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
          <a
            href="/"
            onClick={handleAllClick}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              border: '1px solid var(--color-line-strong)',
              background: activeTag == null ? 'var(--color-primary-normal)' : 'transparent',
              color: activeTag == null ? '#fff' : 'var(--color-label-alternative)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            전체
          </a>
          {tags.map((t) => (
            <a
              key={t.canonical_name}
              href={`/?tag=${encodeURIComponent(t.canonical_name)}`}
              onClick={(e) => handleTagClick(t.canonical_name, e)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                border: '1px solid var(--color-line-strong)',
                background: activeTag === t.canonical_name ? 'var(--color-primary-normal)' : 'transparent',
                color: activeTag === t.canonical_name ? '#fff' : 'var(--color-label-alternative)',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {t.canonical_name}
            </a>
          ))}
        </div>
      ) : null}

      {/* 카드 리스트 — data-pagefind-body는 서버 pre-render 시 전체 카드 포함 */}
      <div data-pagefind-body>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--color-label-assistive)', textAlign: 'center', padding: '4rem 0' }}>
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
            {filtered.map((card) => (
              <li key={card.id} style={{ borderBottom: '1px solid var(--color-line-normal)' }}>
                <a
                  href={`/${card.platform}/${card.id}`}
                  style={{ display: 'block', padding: '1.25rem 1rem', textDecoration: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
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
                    <span style={{ fontWeight: 600, color: 'var(--color-label-normal)', fontSize: '1rem' }}>
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
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-label-assistive)', marginLeft: 'auto' }}>
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
