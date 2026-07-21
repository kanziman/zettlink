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
      {/* 히어로 슬로건 영역 */}
      <div className="mb-8 mt-2">
        <h1 className="text-title1 font-extrabold text-label-strong tracking-tight mb-2">
          zettlink
        </h1>
        <p className="text-body1 text-label-neutral max-w-2xl leading-relaxed tracking-tight">
          YouTube 영상과 GitHub 레포지토리의 핵심 요약, 주요 인사이트, 그리고 실용 가이드까지.
          개발자를 위해 정교하게 정제된 1인 지식 아카이브입니다.
        </p>
      </div>

      {/* 태그 필터 칩 */}
      {tags.length > 0 && (
        <div className="relative mb-8">
          <div className="flex flex-nowrap gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
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
            {tags.map((t) => {
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
          {/* 우측 페이딩 그라데이션 */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background-normal-alternative to-transparent" />
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
