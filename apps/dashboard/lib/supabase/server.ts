// 서버 컴포넌트 / Route Handler용 Supabase 클라이언트 생성 헬퍼
import { cookies } from 'next/headers'
import { createRouteClient, createServerClient } from '@zettlink/db/server'

// read-only 서버 컴포넌트에서 사용 (쿠키 setAll 불가)
export async function createSupabaseServerClient(): Promise<ReturnType<typeof createServerClient>> {
  const cookieStore = await cookies()
  return createServerClient(cookieStore)
}

// read-write Route Handler에서 세션 갱신이 필요할 때 사용
export async function createSupabaseRouteClient(): Promise<ReturnType<typeof createRouteClient>> {
  const cookieStore = await cookies()
  return createRouteClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options),
      )
    },
  })
}
