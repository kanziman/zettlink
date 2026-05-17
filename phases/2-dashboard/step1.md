# Step 1: auth

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: dashboard 모든 라우트는 middleware에서 admin user_id whitelist 통과, /login·/auth/callback만 예외
- `packages/db/src/client.ts` — createServerClient(cookieStore) 시그니처 확인
- `packages/shared/src/config.ts` — config.adminUserIds 확인
- `docs/ARCHITECTURE.md` — §2 RLS 정책 (authenticated는 전체 select, write는 service_role만)
- `apps/dashboard/app/layout.tsx` — step 0 결과물, import 구조 확인

## 작업

Supabase Auth 기반 인증 흐름과 미들웨어 whitelist를 구현한다.

### 생성할 파일

**`apps/dashboard/lib/supabase/server.ts`**

서버 컴포넌트와 Route Handler에서 사용하는 Supabase 클라이언트 래퍼.

```typescript
// 서버 컴포넌트 / Route Handler용 Supabase 클라이언트 생성 헬퍼
import { cookies } from 'next/headers'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import type { Database } from '@zettlink/db/types'

// read-only: 서버 컴포넌트에서 사용 (쿠키 setAll 불가)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* 서버 컴포넌트는 쿠키 쓰기 불가 */ },
      },
    },
  )
}

// read-write: Route Handler에서 세션 갱신이 필요할 때 사용
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies()
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    },
  )
}
```

**`apps/dashboard/lib/supabase/browser.ts`**

로그인 페이지(Client Component)에서 사용하는 브라우저 클라이언트.

```typescript
// 로그인 페이지 전용 브라우저 Supabase 클라이언트
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@zettlink/db/types'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
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
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!adminIds.includes(user.id)) {
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
import { createSupabaseRouteClient } from '../../lib/supabase/server'

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
- middleware matcher에서 `/login`과 `/auth`를 반드시 제외하라. 미포함 시 로그인 루프 발생.
- `apps/dashboard/lib/supabase/browser.ts` 에서 service_role key를 읽지 마라.
- `createClient` (`@supabase/supabase-js` 직접)를 사용하지 마라. 반드시 `@supabase/ssr` 래퍼를 사용하라.
- `&&` 연산자로 JSX 조건부 렌더링 금지. `error !== null ? <p>...</p> : null` 형태를 사용하라.
