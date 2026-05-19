'use client'
// 헤더 검색 UI — Pagefind JS API 동적 로드, 클라이언트 컴포넌트
import { useState, useEffect, useRef } from 'react'

type PagefindResult = {
  url: string
  meta: { title?: string }
  excerpt: string
}

type Pagefind = {
  search: (query: string) => Promise<{ results: Array<{ data: () => Promise<PagefindResult> }> }>
}

export function PagefindSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PagefindResult[]>([])
  const [open, setOpen] = useState(false)
  const [pagefind, setPagefind] = useState<Pagefind | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // pagefind.js는 next build 후 out/pagefind/에 생성된다.
    // 개발 서버(next dev)에서는 존재하지 않으므로 import 실패를 조용히 무시한다.
    // webpackIgnore: 빌드 타임 정적 분석을 건너뜀. pagefind.js는 next build 후 주입된다.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    import(/* webpackIgnore: true */ '/pagefind/pagefind.js')
      .then((pf) => setPagefind(pf as unknown as Pagefind))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!query.trim() || pagefind == null) {
      setResults([])
      return
    }

    let cancelled = false
    void pagefind.search(query).then(async ({ results: hits }) => {
      if (cancelled) return
      const loaded = await Promise.all(hits.slice(0, 8).map((h) => h.data()))
      if (!cancelled) setResults(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [query, pagefind])

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="search"
        placeholder="검색…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{
          padding: '0.375rem 0.75rem',
          borderRadius: '6px',
          border: '1px solid var(--color-line-strong)',
          background: 'var(--color-background-alternative)',
          color: 'var(--color-label-normal)',
          fontSize: '0.875rem',
          width: '12rem',
          outline: 'none',
        }}
      />
      {open && results.length > 0 ? (
        <ul
          style={{
            position: 'absolute',
            right: 0,
            top: '2.25rem',
            background: 'var(--color-background-normal)',
            border: '1px solid var(--color-line-strong)',
            borderRadius: '8px',
            padding: '0.5rem 0',
            listStyle: 'none',
            margin: 0,
            width: '22rem',
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {results.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                style={{
                  display: 'block',
                  padding: '0.625rem 1rem',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--color-line-normal)',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--color-label-normal)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {r.meta.title ?? r.url}
                </div>
                <div
                  style={{ fontSize: '0.75rem', color: 'var(--color-label-alternative)' }}
                  // Pagefind excerpt는 <mark> 태그를 포함한 안전한 HTML이다
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
