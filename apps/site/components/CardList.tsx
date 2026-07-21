// 홈 페이지 카드 그리드 — ?tag= URL param 필터링, B1 태그 칩 + usage_count 표시
'use client'

import { useState, useEffect } from 'react'
import type { CardListItem, TagItem } from '../lib/cards'
import { Card } from './Card'

type Props = {
  cards: CardListItem[]
  tags: TagItem[]
}

export function CardList({ cards, tags }: Props) {
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)
  const [isExpanded, setIsExpanded] = useState(false)

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

  const totalCount = cards.length

  // 필터 칩 공통 스타일
  const chipBase =
    'inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-label2 font-medium transition-colors duration-150 cursor-pointer no-underline'
  const chipInactive = 'bg-fill-normal text-label-alternative hover:bg-fill-strong'
  const chipActive = 'bg-primary-normal/10 text-primary-normal'

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">zettlink — 지식 카드 아카이브</h1>

      {/* 태그 필터 칩 */}
      {tags.length > 0 && (
        <div className="flex items-center gap-3 mb-8">
          <div className="flex flex-wrap gap-2 flex-grow">
            <a
              href="/"
              onClick={handleAllClick}
              className={[chipBase, activeTag == null ? chipActive : chipInactive].join(' ')}
            >
              전체
              <span className="text-label-assistive text-caption1">
                {totalCount}
              </span>
            </a>
            {(isExpanded ? tags : tags.slice(0, 8)).map((t) => {
              const isActive = activeTag === t.canonical_name
              return (
                <a
                  key={t.canonical_name}
                  href={`/?tag=${encodeURIComponent(t.canonical_name)}`}
                  onClick={(e) => handleTagClick(t.canonical_name, e)}
                  className={[chipBase, isActive ? chipActive : chipInactive].join(' ')}
                >
                  <span className={isActive ? 'text-primary-normal/40' : 'text-label-assistive'}>
                    #
                  </span>
                  {t.canonical_name}
                  <span className="text-label-assistive text-caption1">
                    {t.usage_count}
                  </span>
                </a>
              )
            })}
          </div>
          {tags.length > 8 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0 w-11 h-11 rounded-full border border-line-normal-normal flex items-center justify-center text-label-alternative hover:text-primary-normal hover:bg-fill-normal transition-colors cursor-pointer focus:outline-none"
              aria-label={isExpanded ? '태그 목록 접기' : '태그 목록 더보기'}
            >
              <span className="text-body1 font-bold">
                {isExpanded ? '▴' : '▾'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* 카드 그리드 */}
      <div data-pagefind-body>
        {filtered.length === 0 ? (
          <p className="text-label-assistive text-center py-16">
            게시된 노트가 없습니다.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((card) => (
              <li key={card.id}>
                <a href={`/${card.platform}/${card.id}`} className="block no-underline h-full">
                  <Card
                    hoverable
                    platform={card.platform}
                    title={card.title ?? card.id}
                    summary={card.summary ?? undefined}
                    tags={card.tags}
                    date={new Date(card.created_at).toLocaleDateString('ko-KR')}
                    className="h-full"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
