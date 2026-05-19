// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard 폰트, 상단 nav (Pagefind 검색 포함)
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
                style={{ fontSize: '0.875rem', color: 'var(--color-label-alternative)', textDecoration: 'none' }}
              >
                태그
              </a>
              <PagefindSearch />
            </nav>
          </header>
          <main
            style={{
              maxWidth: '56rem',
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
