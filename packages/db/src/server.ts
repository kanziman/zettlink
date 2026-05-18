// 서버 전용 Supabase 클라이언트 팩토리 모듈
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

// worker / bot / server scripts에서 사용 - RLS 우회
export function createServiceClient() {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
  )
}

// dashboard 서버 컴포넌트에서 사용 - session JWT 기반 read-only
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

// dashboard Route Handler / middleware에서 사용 - session refresh 쿠키 쓰기 허용
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
