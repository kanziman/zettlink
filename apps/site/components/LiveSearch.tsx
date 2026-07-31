// 헤더 검색 — Supabase 실시간 조회(CSR). 재빌드 없이 새/수정 카드도 즉시 검색된다.
'use client'

import { useState, useEffect, useMemo, useId } from 'react'
import { createAnonClient } from '@zettlink/db/anon'

type SearchHit = { id: string; platform: string; title: string | null; summary: string | null }

export function LiveSearch() {
  const client = useMemo(() => createAnonClient(), [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()

  useEffect(() => {
    // PostgREST or() 필터 문법을 깨거나 주입되지 않도록 특수문자 제거
    const q = query.replace(/[,%()*\\]/g, ' ').trim()
    if (!q) {
      setResults([])
      setActiveIndex(-1)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const { data } = await client
          .from('cards')
          .select('id, platform, title, summary')
          .eq('published', true)
          .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(8)
        if (!cancelled) {
          setResults((data as SearchHit[] | null) ?? [])
          setActiveIndex(-1)
        }
      })()
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, client])

  function go(hit: SearchHit) {
    window.location.assign(`/${hit.platform}/${hit.id}/`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      go(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showResults = open && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        role="combobox"
        aria-label="카드 검색"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        placeholder="검색…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={onKeyDown}
        style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          border: '1px solid var(--color-line-strong)',
          background: 'var(--color-background-alternative)',
          color: 'var(--color-label-normal)',
          fontSize: '0.875rem',
          width: 'min(12rem, 40vw)',
        }}
      />
      {showResults ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            right: 0,
            top: '2.5rem',
            background: 'var(--color-background-normal)',
            border: '1px solid var(--color-line-strong)',
            borderRadius: '8px',
            padding: '0.5rem 0',
            listStyle: 'none',
            margin: 0,
            width: 'min(22rem, calc(100vw - 2rem))',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {results.map((hit, i) => (
            <li
              key={`${hit.platform}/${hit.id}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
            >
              <a
                href={`/${hit.platform}/${hit.id}/`}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: 'block',
                  padding: '0.625rem 1rem',
                  textDecoration: 'none',
                  background: i === activeIndex ? 'var(--color-background-alternative)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--color-label-normal)',
                    marginBottom: hit.summary ? '0.25rem' : 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hit.title ?? hit.id}
                </div>
                {hit.summary ? (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-label-alternative)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hit.summary}
                  </div>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
