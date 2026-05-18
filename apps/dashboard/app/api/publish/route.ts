// 카드 published 상태 토글 API
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'
import { createServiceClient } from '@zettlink/db/server'
import { config } from '@zettlink/shared'

export async function POST(request: Request) {
  // server-auth-actions: 세션 검증 먼저
  const supabase = await createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (!config.adminUserIds.includes(user.id))
    return new NextResponse('Forbidden', { status: 403 })

  const body = (await request.json()) as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 조회는 session JWT 기반 route client로 수행한다
  const { data: card } = await supabase
    .from('cards')
    .select('published')
    .eq('id', body.id)
    .single()
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  const newPublished = !card.published

  // write는 service client만 사용한다
  const serviceDb = createServiceClient()
  await serviceDb
    .from('cards')
    .update({
      published: newPublished,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)

  return NextResponse.json({ ok: true, published: newPublished })
}
