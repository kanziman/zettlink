# Step 1: scaffold

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙, 기술 스택, 파일 첫 줄 한국어 주석 규칙
- `docs/DESIGN.md` — §2.2.2 Semantic Color Tokens (CSS 변수 목록)
- `apps/dashboard/app/globals.css` — 동일한 토큰 CSS 변수 재사용 (복사 기준)
- `apps/dashboard/next.config.ts` — transpilePackages 패턴 참고
- `tsconfig.base.json` — 공통 TS 설정 (extends 기준)
- `apps/site/package.json` — 현재 skeleton 확인

## 작업

Next.js 15 완전 정적(SSG) 사이트의 기반 파일을 생성한다. `output: 'export'`로 빌드 시 `out/` 디렉토리에 정적 HTML을 생성한다.

### 수정할 파일

**`apps/site/package.json`**

```json
{
  "name": "@zettlink/site",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build && pagefind --site out",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.4",
    "@zettlink/ui": "workspace:*",
    "@zettlink/shared": "workspace:*",
    "next": "^15.0.0",
    "next-themes": "^0.4.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.7",
    "@tailwindcss/typography": "^0.5.16",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "pagefind": "^1.3.0",
    "tailwindcss": "^4.1.7",
    "typescript": "^5"
  }
}
```

### 생성할 파일

**`apps/site/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**`apps/site/next.config.ts`**

```typescript
// 공개 사이트 Next.js 설정 — 완전 정적 export, workspace 패키지 트랜스파일
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  transpilePackages: ['@zettlink/ui', '@zettlink/shared'],
}

export default config
```

**`apps/site/postcss.config.mjs`**

```javascript
// Tailwind CSS 4 PostCSS 설정
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

**`apps/site/app/globals.css`**

dashboard의 globals.css와 동일한 semantic 토큰. `@tailwindcss/typography`로 마크다운 산문 스타일 추가.

```css
/* 공개 사이트 전역 스타일 — Wanted Montage semantic token CSS 변수 */
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@layer base {
  :root {
    --color-label-normal: #171719;
    --color-label-strong: #000000;
    --color-label-neutral: rgba(46, 47, 51, 0.88);
    --color-label-alternative: rgba(46, 47, 51, 0.61);
    --color-label-assistive: rgba(46, 47, 51, 0.28);
    --color-label-disable: rgba(46, 47, 51, 0.16);

    --color-background-normal: #ffffff;
    --color-background-alternative: #f7f7f8;

    --color-primary-normal: #0066ff;
    --color-primary-strong: #005eeb;
    --color-primary-heavy: #0054d1;

    --color-status-error: #ff4242;
    --color-status-success: #12d589;
    --color-status-caution: #ff7a00;
    --color-status-info: #3385ff;
    --color-status-dead: #5a5c63;

    --color-line-normal: rgba(112, 115, 124, 0.22);
    --color-line-strong: rgba(112, 115, 124, 0.48);
  }

  .dark {
    --color-label-normal: #f7f7f8;
    --color-label-strong: #ffffff;
    --color-label-neutral: rgba(226, 227, 229, 0.88);
    --color-label-alternative: rgba(226, 227, 229, 0.61);
    --color-label-assistive: rgba(226, 227, 229, 0.28);
    --color-label-disable: rgba(226, 227, 229, 0.16);

    --color-background-normal: #171719;
    --color-background-alternative: #1b1c1e;

    --color-primary-normal: #3385ff;
    --color-primary-strong: #1a75ff;
    --color-primary-heavy: #0066ff;

    --color-status-error: #ff6363;
    --color-status-success: #2fe59a;
    --color-status-caution: #ff9533;
    --color-status-info: #69a5ff;
    --color-status-dead: #8a8d96;

    --color-line-normal: rgba(151, 154, 160, 0.22);
    --color-line-strong: rgba(151, 154, 160, 0.48);
  }

  body {
    background-color: var(--color-background-normal);
    color: var(--color-label-normal);
    font-family: 'Pretendard', sans-serif;
  }
}
```

**`apps/site/app/layout.tsx`**

```typescript
// 공개 사이트 루트 레이아웃 — ThemeProvider, Pretendard 폰트, 상단 nav
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
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

**`apps/site/app/not-found.tsx`**

```typescript
// 404 페이지
export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>404</h1>
      <p style={{ color: 'var(--color-label-alternative)' }}>페이지를 찾을 수 없습니다.</p>
      <a href="/" style={{ color: 'var(--color-primary-normal)', marginTop: '1rem', display: 'inline-block' }}>
        홈으로 돌아가기
      </a>
    </div>
  )
}
```

## Acceptance Criteria

```bash
# 의존성 설치
pnpm install

# 타입 체크 (next-env.d.ts가 없으면 build 후 체크)
pnpm --filter @zettlink/site build
# → out/ 디렉토리 생성, next build 성공

# out/index.html 존재 확인
ls out/index.html
```

## 금지사항

- `output: 'export'`를 제거하거나 `output: 'standalone'`으로 바꾸지 마라. 정적 사이트가 아니면 Pagefind가 동작하지 않는다.
- Tailwind CSS 3 방식(`tailwind.config.js`, `theme.extend`)을 사용하지 마라. v4는 `postcss.config.mjs` + `@import "tailwindcss"` 방식이다.
- DESIGN.md에 없는 임의 색상값을 직접 쓰지 마라. CSS 변수(`var(--color-*)`)만 사용하라.
- `SUPABASE_SERVICE_ROLE_KEY`나 `ADMIN_USER_IDS`를 site의 어떤 파일에도 추가하지 마라.
- `apps/site`에서 `@zettlink/db`를 import하지 마라. site는 `@supabase/supabase-js`의 anon 클라이언트를 `lib/cards.ts`에서만 직접 사용한다.
