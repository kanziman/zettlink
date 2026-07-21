// 공개 사이트 상단 고정 네비게이션 — 다크모드 토글 + 검색 슬롯
'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import { Button } from './Button'
import { Icon } from './Icon'

interface TopNavigationProps {
  searchSlot?: React.ReactNode
}

export function TopNavigation({ searchSlot }: TopNavigationProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <header className="sticky top-0 z-[100] h-14 border-b border-line-normal-normal bg-background-normal-alternative flex items-center">
      <div className="w-full max-w-[1120px] mx-auto px-6 flex items-center justify-between">
        <a
          href="/"
          className="font-bold text-title3 text-label-strong tracking-tight no-underline"
        >
          zettlink
        </a>
        <div className="flex items-center gap-2">
          {searchSlot}
          <Button
            variant="outlined"
            color="assistive"
            size="medium"
            className="h-11"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            leadingContent={<Icon name={isDark ? 'sun' : 'moon'} size={16} />}
          >
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </div>
      </div>
    </header>
  )
}
