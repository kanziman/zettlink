// Supabase 클라이언트 3종을 용도에 따라 분리 생성하는 팩토리 모듈
import { createClient } from '@supabase/supabase-js'
import {
  createServerClient as createSSRServerClient,
  createBrowserClient as createSSRBrowserClient,
} from '@supabase/ssr'
import { config } from '@zettlink/shared'
import type { Database } from './types.gen.js'

// next/headers의 ReadonlyRequestCookies와 호환되는 로컬 타입
// packages/db가 Next.js에 직접 의존하지 않도록 인터페이스로 추상화
type ReadonlyCookies = {
  getAll(): Array<{ name: string; value: string }>
}

// worker / bot / server scripts에서 사용 — RLS 우회
export function createServiceClient() {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
  )
}

// dashboard 서버 컴포넌트 / Route Handler에서 사용 — session JWT 기반
// 사용: createServerClient(await cookies())  (next/headers)
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
          // 세션 갱신이 필요한 Route Handler는 별도 클라이언트 생성 권장.
        },
      },
    },
  )
}

// dashboard 클라이언트 컴포넌트에서 사용 — anon key, NEXT_PUBLIC_ 허용
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
  )
}
