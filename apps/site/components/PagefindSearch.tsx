'use client'
// Pagefind 정적 검색 UI 컴포넌트 — 빌드 후 생성된 /pagefind/pagefind.js를 동적 로드
import { useEffect, useRef } from 'react'

export function PagefindSearch() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPagefind() {
      try {
        // webpackIgnore: 빌드 타임 정적 분석을 건너뜀. pagefind.js는 next build 후 주입된다
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const { PagefindUI } = await import(/* webpackIgnore: true */ '/pagefind/pagefind-ui.js')
        if (!cancelled && ref.current) {
          new PagefindUI({
            element: ref.current,
            showImages: false,
            showSubResults: false,
          })
        }
      } catch {
        // 개발 환경(next dev)에서는 pagefind 인덱스가 없으므로 조용히 무시한다
      }
    }

    void loadPagefind()
    return () => {
      cancelled = true
    }
  }, [])

  return <div ref={ref} style={{ maxWidth: '480px' }} />
}
