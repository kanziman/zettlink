'use client'
// Pagefind 정적 검색 UI 컴포넌트 — 빌드 후 생성된 /pagefind/pagefind.js를 동적 로드
import { useEffect, useRef } from 'react'

export function PagefindSearch() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPagefind() {
      try {
        // @ts-expect-error — pagefind.js는 빌드 후 정적 파일로 주입된다
        const { PagefindUI } = await import('/pagefind/pagefind-ui.js')
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
