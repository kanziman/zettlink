// anon 전용 Supabase 클라이언트 팩토리 — 서버 config 비의존, Node·브라우저 공용
// 공개 사이트(빌드 SSG + 브라우저 CSR)에서 RLS로 published 데이터만 읽는다
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types.gen.js'

// NEXT_PUBLIC_ 키만 사용 → 브라우저 번들 인라인 안전. 서버 전용 config/service_role 미의존.
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
