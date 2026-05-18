'use client'
// 모니터 페이지 자동 갱신 컴포넌트 — N초마다 router.refresh() 호출
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  intervalMs: number
}

export function AutoRefresh({ intervalMs }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
