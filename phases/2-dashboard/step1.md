# Step 1: auth

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: dashboard 모든 라우트는 middleware에서 admin user_id whitelist 통과, /login·/auth/callback만 예외
- `packages/db/src/client.ts` — 기존 서버/브라우저 혼합 팩토리 구조 확인
- `packages/db/src/server.ts` — 없으면 생성. server/service/route 클라이언트 전용 진입점
- `packages/db/src/browser.ts` — 없으면 생성. 브라우저 클라이언트 전용 진입점
- `packages/db/src/index.ts` — 호환용 export 확인
- `packages/db/package.json` — `@zettlink/db/browser`, `@zettlink/db/server` subpath export 추가
- `packages/shared/src/config.ts` — config.adminUserIds 확인
- `docs/ARCHITECTURE.md` — §2 RLS 정책 (authenticated는 전체 select, write는 service_role만)
- `apps/dashboard/app/layout.tsx` — step 0 결과물, import 구조 확인

## 작업

Supabase Auth 기반 인증 흐름과 미들웨어 whitelist를 구현한다.

### 수정할 파일

**중요: `@zettlink/db` 서버/브라우저 진입점 분리**

현재 `packages/db/src/client.ts`는 모듈 최상위에서 `@zettlink/shared`의 `config`를 import한다. 이 파일에 `createBrowserClient()`를 함께 두고 dashboard Client Component에서 import하면, 브라우저 번들 평가 시점에 `SUPABASE_SERVICE_ROLE_KEY` 검증이 실행되어 로그인 페이지가 crash한다.

반드시 다음 구조로 분리한다.

- 서버 전용: `@zettlink/db/server` → `packages/db/src/server.ts`
- 브라우저 전용: `@zettlink/db/browser` → `packages/db/src/browser.ts`
- Client Component 또는 `apps/dashboard/lib/supabase/browser.ts`는 `@zettlink/db` 루트나 `@zettlink/db/server`를 import하지 않는다.
- `createBrowserClient()`는 `@zettlink/shared/config`를 import하지 않고 `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`를 직접 읽는다.
- `SUPABASE_SERVICE_ROLE_KEY`는 server/service 클라이언트에서만 `@zettlink/shared/config`를 통해 읽는다.

**`packages/db/src/server.ts`**

Route Handler와 middleware에서 세션 갱신 쿠키를 쓸 수 있도록 `createRouteClient(cookieStore)`를 추가한다.
기존 `createServerClient(cookieStore)`는 서버 컴포넌트 read-only 용도로 유지한다.

```typescript
// 서버 전용 Supabase 클라이언트 팩토리 모듈
import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { config } from '@zettlink/shared'
import type { Database } from './types.gen.js'

// next/headers의 ReadonlyRequestCookies와 호환되는 로컬 타입
// packages/db가 Next.js에 직접 의존하지 않도록 인터페이스로 추상화
type ReadonlyCookies = {
  getAll(): Array<{ name: string; value: string }>
}

type CookieOptions = {
  domain?: string
  path?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  sameSite?: 'lax' | 'strict' | 'none' | boolean
  secure?: boolean
}

type WritableCookies = ReadonlyCookies & {
  setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>): void
}

// worker / bot / server scripts에서 사용 — RLS 우회
export function createServiceClient() {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
  )
}

// dashboard 서버 컴포넌트에서 사용 — session JWT 기반 read-only
export function createServerClient(cookieStore: ReadonlyCookies) {
  return createSSRServerClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(_cookiesToSet) {
          // 서버 컴포넌트(read-only)에서는 쿠키 설정 불가.
        },
      },
    },
  )
}

// dashboard Route Handler / middleware에서 사용 — session refresh 쿠키 쓰기 허용
export function createRouteClient(cookieStore: WritableCookies) {
  return createSSRServerClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookieStore.setAll(cookiesToSet)
        },
      },
    },
  )
}
```

**`packages/db/src/browser.ts`**

브라우저 번들에 server-only config가 포함되지 않도록 `@zettlink/shared`를 import하지 않는다.
Next.js Client Component에서 사용되므로 `NEXT_PUBLIC_` 환경변수만 읽는다.

```typescript
// 브라우저 전용 Supabase 클라이언트 팩토리 모듈
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database } from './types.gen.js'

// dashboard 클라이언트 컴포넌트에서 사용 — anon key, NEXT_PUBLIC_ 허용
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createSSRBrowserClient<Database>(
    url,
    anonKey,
  )
}
```

**`packages/db/src/client.ts`**

기존 import 경로와 내부 서버 코드 호환을 위해 re-export 파일로 바꾼다. 새 dashboard 코드에서는 이 파일을 직접 import하지 않는다.

```typescript
// Supabase 클라이언트 팩토리 호환 re-export
export { createServiceClient, createServerClient, createRouteClient } from './server.js'
export { createBrowserClient } from './browser.js'
```

**`packages/db/src/index.ts`**

```typescript
// packages/db 공개 API — client 팩토리 re-export
export { createServiceClient, createServerClient, createRouteClient, createBrowserClient } from './client.js'
export type { Database } from './types.gen.js'
```

**`packages/db/package.json`**

브라우저 코드가 server-only re-export를 평가하지 않도록 subpath export를 추가한다.

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server.ts",
    "./browser": "./src/browser.ts"
  }
}
```

### 생성할 파일

**`apps/dashboard/lib/supabase/server.ts`**

서버 컴포넌트와 Route Handler에서 사용하는 Supabase 클라이언트 래퍼.

```typescript
// 서버 컴포넌트 / Route Handler용 Supabase 클라이언트 생성 헬퍼
import { cookies } from 'next/headers'
import { createRouteClient, createServerClient } from '@zettlink/db/server'

// read-only: 서버 컴포넌트에서 사용 (쿠키 setAll 불가)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(cookieStore)
}

// read-write: Route Handler에서 세션 갱신이 필요할 때 사용
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies()
  return createRouteClient({
    getAll() { return cookieStore.getAll() },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options)
      )
    },
  })
}
```

**`apps/dashboard/lib/supabase/browser.ts`**

로그인 페이지(Client Component)에서 사용하는 브라우저 클라이언트.

```typescript
// 로그인 페이지 전용 브라우저 Supabase 클라이언트
import { createBrowserClient } from '@zettlink/db/browser'

export function createSupabaseBrowserClient() {
  return createBrowserClient()
}
```

**`apps/dashboard/middleware.ts`**

matcher로 `/login`, `/auth`, `/_next`, `/favicon` 경로를 제외한 전체에 적용.
1. 세션 쿠키 갱신 (Supabase SSR 요구사항)
2. 세션 없으면 `/login`으로 리다이렉트
3. 세션 있으면 `user.id`가 `config.adminUserIds`에 있는지 확인
4. 없으면 403 plain text 응답

```typescript
// 세션 검증 + admin user_id whitelist를 적용하는 Next.js 미들웨어
import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@zettlink/db/server'
import { config as appConfig } from '@zettlink/shared'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createRouteClient({
    getAll() { return request.cookies.getAll() },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
      response = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      )
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!appConfig.adminUserIds.includes(user.id)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return response
}

export const config = {
  matcher: ['/((?!login|auth|_next/static|_next/image|favicon.ico).*)'],
}
```

**`apps/dashboard/app/login/page.tsx`**

이메일 + 패스워드 로그인 폼. Client Component.
성공 시 `router.push('/')`, 실패 시 에러 메시지 표시.

```typescript
'use client'
// 이메일/패스워드 로그인 페이지
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase/browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>zettlink</h1>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-line-strong)' }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-line-strong)' }}
        />
        {error !== null ? <p style={{ color: 'var(--color-status-error)', fontSize: '0.875rem' }}>{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: 'var(--color-primary-normal)',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </main>
  )
}
```

**`apps/dashboard/app/auth/callback/route.ts`**

magic link / OAuth 콜백 처리 (현재는 email/password만 쓰지만 향후 대비).

```typescript
// Supabase Auth 콜백 — code를 세션으로 교환하고 / 로 리다이렉트
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseRouteClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

### 환경변수 추가 필요

`NEXT_PUBLIC_SUPABASE_URL` 과 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를 `.env` 에 추가해야 한다.
기존 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 와 같은 값이며 브라우저에 노출 가능한 public 값이다.
`.env.example` 에도 두 값을 추가하라.

## Acceptance Criteria

```bash
# 타입 체크
pnpm --filter @zettlink/dashboard typecheck
# → 에러 없음

# 빌드
pnpm --filter @zettlink/dashboard build
# → 성공

# 수동 확인 (로컬 Supabase 또는 실제 프로젝트 URL 필요)
# 1. 브라우저에서 http://localhost:3001 접속 → /login 리다이렉트 확인
# 2. 잘못된 credentials로 로그인 → 에러 메시지 표시 확인
# 3. 올바른 admin 계정으로 로그인 → / 이동 확인
# 4. 비-admin 계정으로 로그인 → 403 텍스트 확인
```

## 금지사항

- `SUPABASE_SERVICE_ROLE_KEY`를 `middleware.ts` 또는 클라이언트 코드에서 사용하지 마라. 미들웨어는 anon key + session JWT로 동작한다.
- Client Component 또는 `apps/dashboard/lib/supabase/browser.ts`에서 `@zettlink/shared`, `@zettlink/db`, `@zettlink/db/server`, `packages/db/src/client.ts`를 import하지 마라. 반드시 `@zettlink/db/browser`만 import하라.
- middleware matcher에서 `/login`과 `/auth`를 반드시 제외하라. 미포함 시 로그인 루프 발생.
- `apps/dashboard/lib/supabase/browser.ts` 에서 service_role key를 읽지 마라.
- dashboard app 코드에서 `@supabase/ssr` 또는 `@supabase/supabase-js`를 직접 import하지 마라. 서버 코드는 `@zettlink/db/server`, 브라우저 코드는 `@zettlink/db/browser`의 팩토리를 래핑해 사용하라.
- admin whitelist는 환경변수를 각 앱에서 직접 파싱하지 말고 `@zettlink/shared`의 `config.adminUserIds`를 사용하라.
- `&&` 연산자로 JSX 조건부 렌더링 금지. `error !== null ? <p>...</p> : null` 형태를 사용하라.
