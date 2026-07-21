// 헤더 검색 UI — Pagefind JS API 동적 로드, 클라이언트 컴포넌트
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // pagefind.js는 next build 후 out/pagefind/에 생성된다.
    // webpackIgnore: 빌드 타임 정적 분석을 건너뜀
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    import(/* webpackIgnore: true */ '/pagefind/pagefind.js')
      .then((pf) => setPagefind(pf as unknown as Pagefind))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!query.trim() || pagefind == null) {
      setResults([])
      setFocusedIndex(-1)
      return
    }

    let cancelled = false
    void pagefind.search(query).then(async ({ results: hits }) => {
      if (cancelled) return
      const loaded = await Promise.all(hits.slice(0, 8).map((h) => h.data()))
      if (!cancelled) {
        setResults(loaded)
        setFocusedIndex(-1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [query, pagefind])

  // 컨테이너 외부로 포커스가 나갔을 때만 닫기
  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        e.preventDefault()
        router.push(results[focusedIndex].url)
        setOpen(false)
        inputRef.current?.blur()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div 
      ref={containerRef} 
      className="relative"
      onBlur={handleBlur}
    >
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
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        aria-controls="search-results"
        aria-label="지식 카드 검색"
        className="h-11 px-4 py-2.5 rounded-lg border border-line-normal bg-background-normal-alternative text-label-normal text-label1 w-32 focus:w-48 sm:w-48 sm:focus:w-64 transition-all duration-200 placeholder:text-label-assistive focus:border-primary-normal focus:outline-none"
      />
      {open && results.length > 0 ? (
        <ul
          id="search-results"
          role="listbox"
          aria-label="검색 결과"
          className="absolute right-0 top-13 bg-background-elevated-normal border border-line-strong rounded-xl py-2 list-none m-0 w-full min-w-[18rem] max-w-[calc(100vw-2rem)] sm:w-[22rem] z-[110] shadow-normal-medium"
        >
          {results.map((r, index) => {
            const isFocused = index === focusedIndex
            return (
              <li 
                key={r.url} 
                role="option" 
                aria-selected={isFocused}
              >
                <a
                  href={r.url}
                  onClick={(e) => {
                    e.preventDefault()
                    router.push(r.url)
                    setOpen(false)
                  }}
                  className={`block px-4 py-2.5 no-underline border-b border-line-normal-normal last:border-b-0 transition-colors duration-150 ${
                    isFocused 
                      ? 'bg-fill-strong text-primary-normal' 
                      : 'hover:bg-fill-normal'
                  }`}
                >
                  <div className="font-semibold text-label2 text-label-strong mb-1">
                    {r.meta.title ?? r.url}
                  </div>
                  <div
                    className="text-caption1 text-label-alternative line-clamp-2"
                    // Pagefind excerpt는 <mark> 태그를 포함한 안전한 HTML이다
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
