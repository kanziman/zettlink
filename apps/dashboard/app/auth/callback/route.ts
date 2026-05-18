// Supabase Auth 콜백에서 code를 세션으로 교환하고 / 로 리다이렉트
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
