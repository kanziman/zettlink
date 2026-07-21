// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard 폰트, TopNavigation
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { TopNavigation } from '../components/TopNavigation'
import { PagefindSearch } from '../components/PagefindSearch'
import './globals.css'

export const metadata: Metadata = {
  title: 'zettlink',
  description: 'YouTube·GitHub 지식 카드 아카이브',
}

export default function RootLayout({ children }: { children: ReactNode }) {
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
          <TopNavigation searchSlot={<PagefindSearch />} />
          <main className="max-w-[1120px] mx-auto px-6 py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
