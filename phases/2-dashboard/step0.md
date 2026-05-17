# Step 0: scaffold

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙, 기술 스택 (Next.js 15 App Router, Tailwind, next-themes)
- `docs/DESIGN.md` — §2 Foundations: semantic 토큰 목록, 색상/타이포그래피 값
- `docs/ARCHITECTURE.md` — §1 디렉토리 구조, §8 환경변수
- `tsconfig.base.json` — 공통 TS 설정
- `apps/dashboard/package.json` — 현재 skeleton (dependencies만 업데이트)
- `packages/shared/src/config.ts` — SUPABASE_URL, SUPABASE_ANON_KEY 환경변수명 확인

## 작업

Next.js 15 App Router 기반 dashboard 앱의 기반 파일을 생성한다.

### 수정할 파일

**`apps/dashboard/package.json`**

기존 파일에서 다음을 교체한다:

```json
{
  "name": "@zettlink/dashboard",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev --turbopack --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.49.4",
    "@zettlink/db": "workspace:*",
    "@zettlink/shared": "workspace:*",
    "@zettlink/ui": "workspace:*",
    "next": "^15.0.0",
    "next-themes": "^0.4.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.7",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.1.7",
    "typescript": "^5"
  }
}
```

### 생성할 파일

**`apps/dashboard/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**`apps/dashboard/next.config.ts`**

```typescript
// Next.js 15 dashboard 설정 — turbopack 개발, workspace 패키지 트랜스파일
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@zettlink/ui', '@zettlink/shared', '@zettlink/db'],
}

export default nextConfig
```

**`apps/dashboard/postcss.config.mjs`**

```javascript
// Tailwind CSS 4 PostCSS 설정
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

**`apps/dashboard/app/globals.css`**

DESIGN.md §2.2.2 Semantic Color Tokens를 CSS 변수로 선언한다.
Light 모드 기본, `.dark` 클래스 적용 시 Dark 모드 값으로 교체.

```css
@import "tailwindcss";

@layer base {
  :root {
    /* label */
    --color-label-normal: #171719;
    --color-label-strong: #000000;
    --color-label-neutral: rgba(46, 47, 51, 0.88);
    --color-label-alternative: rgba(46, 47, 51, 0.61);
    --color-label-assistive: rgba(46, 47, 51, 0.28);
    --color-label-disable: rgba(46, 47, 51, 0.16);

    /* background */
    --color-background-normal: #ffffff;
    --color-background-alternative: #f7f7f8;

    /* primary */
    --color-primary-normal: #0066ff;
    --color-primary-strong: #005eeb;
    --color-primary-heavy: #0054d1;

    /* status */
    --color-status-error: #ff4242;
    --color-status-success: #12d589;
    --color-status-caution: #ff7a00;
    --color-status-info: #3385ff;

    /* line */
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

**`apps/dashboard/app/layout.tsx`**

```typescript
// 대시보드 루트 레이아웃 — ThemeProvider, Pretendard 폰트
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'zettlink dashboard',
  description: '지식 관리 도구 관리자 대시보드',
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**`apps/dashboard/app/not-found.tsx`**

```typescript
// 404 페이지
export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다.</p>
    </div>
  )
}
```

## Acceptance Criteria

```bash
# 의존성 설치
cd /path/to/zettlink && pnpm install

# 타입 체크
pnpm --filter @zettlink/dashboard typecheck
# → 에러 없음 (next-env.d.ts 없으면 build 후 체크)

# 빌드 확인
pnpm --filter @zettlink/dashboard build
# → .next 생성, 에러 없음
```

## 금지사항

- Tailwind CSS 3 문법(`tailwind.config.js`, `theme.extend` 방식) 사용 금지. v4는 `postcss.config.mjs` + `@import "tailwindcss"` 방식.
- DESIGN.md에 없는 임의 색상값을 직접 쓰지 마라. 반드시 CSS 변수(`var(--color-*)`)를 사용하라.
- `SUPABASE_SERVICE_ROLE_KEY`에 `NEXT_PUBLIC_` prefix를 붙이지 마라.
- `apps/dashboard`에서 `@supabase/supabase-js`의 `createClient`를 직접 호출하지 마라. `packages/db` 클라이언트만 사용.
