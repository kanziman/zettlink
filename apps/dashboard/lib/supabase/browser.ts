// 로그인 페이지 전용 브라우저 Supabase 클라이언트
import { createBrowserClient } from '@zettlink/db/browser'

export function createSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient()
}
