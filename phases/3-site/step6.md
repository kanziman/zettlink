# Step 6: pagefind

## 읽어야 할 파일

- `apps/site/package.json` — step 1 결과물 (build script, pagefind devDependency 확인)
- `apps/site/app/layout.tsx` — step 1 결과물 (nav 영역에 검색 UI 추가)
- `apps/site/app/page.tsx` — step 3 결과물 (`data-pagefind-body` 속성 확인)
- `apps/site/app/[platform]/[slug]/page.tsx` — step 4 결과물 (`data-pagefind-body`, `data-pagefind-meta="title"` 확인)

## 작업

Pagefind 클라이언트 검색을 통합한다. `next build && pagefind --site out`으로 정적 인덱스를 생성하고, `PagefindSearch` Client Component가 런타임에 `/pagefind/pagefind.js`를 동적으로 로드해 검색 UI를 렌더한다.

### 생성할 파일

**`apps/site/components/PagefindSearch.tsx`**

Pagefind JS API를 사용하는 검색 UI. `@pagefind/default-ui` 대신 직접 pagefind API를 호출하는 경량 구현으로 헤더에 배치한다.

```typescript
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
    // pagefind.js는 빌드 후 out/pagefind/에 생성된다.
    // 개발 서버에서는 존재하지 않으므로 import 실패를 무시한다.
    import('/pagefind/pagefind.js' as never)
      .then((pf) => setPagefind(pf as unknown as Pagefind))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!query.trim() || pagefind == null) {
      setResults([])
      return
    }

    let cancelled = false
    pagefind.search(query).then(async ({ results: hits }) => {
      if (cancelled) return
      const loaded = await Promise.all(hits.slice(0, 8).map((h) => h.data()))
      if (!cancelled) setResults(loaded)
    })
    return () => { cancelled = true }
  }, [query, pagefind])

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="search"
        placeholder="검색…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
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
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-label-normal)', marginBottom: '0.25rem' }}>
                  {r.meta.title ?? r.url}
                </div>
                <div
                  style={{ fontSize: '0.75rem', color: 'var(--color-label-alternative)' }}
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
```

### 수정할 파일

**`apps/site/app/layout.tsx`**

헤더 nav에 `<PagefindSearch />`를 추가한다.

```typescript
// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard 폰트, 상단 nav (Pagefind 검색 포함)
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { PagefindSearch } from '../components/PagefindSearch'
import './globals.css'

export const metadata: Metadata = {
  title: 'zettlink',
  description: '지식 관리 공개 노트',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header
            style={{
              borderBottom: '1px solid var(--color-line-normal)',
              padding: '0 1.5rem',
              height: '3.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <a
              href="/"
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--color-label-strong)',
                textDecoration: 'none',
              }}
            >
              zettlink
            </a>
            <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <a
                href="/tags"
                style={{ fontSize: '0.875rem', color: 'var(--color-label-alternative)' }}
              >
                태그
              </a>
              <PagefindSearch />
            </nav>
          </header>
          <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

## Acceptance Criteria

```bash
# build 후 pagefind 인덱스 생성 확인
pnpm --filter @zettlink/site build
# → out/pagefind/ 디렉토리 생성
# → out/pagefind/pagefind.js 존재

# 로컬 서빙 후 검색 확인
npx serve out -p 3002
# → 검색창에 키워드 입력 시 드롭다운 결과 표시
# → 개발 서버(next dev)에서는 pagefind.js 없으므로 검색창만 표시되고 에러 없음
```

## 금지사항

- `import '/pagefind/pagefind.js'`를 Server Component에서 사용하지 마라. 이 파일은 빌드 후에만 존재하므로 반드시 Client Component의 `useEffect` 내에서 동적 import해야 한다.
- `dangerouslySetInnerHTML`을 excerpt 외 다른 데이터에 사용하지 마라. Pagefind excerpt는 `<mark>` 태그를 포함한 안전한 HTML이다.
- `@pagefind/default-ui` npm 패키지를 의존성에 추가하지 마라. Pagefind CLI가 생성하는 `/pagefind/pagefind.js`를 직접 동적 import한다.
- `next dev` 환경에서 pagefind.js import 실패 시 에러를 throw하지 마라. `.catch(() => undefined)`로 무시한다.
