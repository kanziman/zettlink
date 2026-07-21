// 브라우저 전용 Supabase 클라이언트 팩토리 모듈
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database } from './types.gen.js'

// dashboard 클라이언트 컴포넌트에서 사용 - anon key, NEXT_PUBLIC_ 허용
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
