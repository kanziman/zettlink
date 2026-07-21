// 세션 검증 + admin user_id whitelist를 적용하는 Next.js 미들웨어
import { NextResponse, type NextRequest } from 'next/server'
import { createRouteClient } from '@zettlink/db/server'
import { config as appConfig } from '@zettlink/shared'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createRouteClient({
    getAll() {
      return request.cookies.getAll()
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
      response = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
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
