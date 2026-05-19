// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard, 상단 네비게이션
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
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
        <link
          rel="stylesheet"
          href="/pagefind/pagefind-ui.css"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header
            style={{
              borderBottom: '1px solid var(--color-line-normal)',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <a
              href="/"
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                textDecoration: 'none',
                color: 'var(--color-label-strong)',
              }}
            >
              zettlink
            </a>
            <div style={{ flex: 1 }}>
              <PagefindSearch />
            </div>
          </header>
          <main
            style={{
              maxWidth: '960px',
              margin: '0 auto',
              padding: '2rem 1.5rem',
            }}
          >
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
