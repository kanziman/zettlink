// 심화 요약(deep/til/guide) 생성 API — Claude Sonnet 4.6 호출 후 vault write + DB 업데이트
import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'
import { createServiceClient } from '@zettlink/db/server'
import { config } from '@zettlink/shared'

const MODEL = 'claude-sonnet-4-6'
// Next.js Route Handler는 apps/dashboard 디렉토리에서 실행된다
// vault는 monorepo 루트에 있으므로 두 단계 위로 이동한다
const ROOT = join(process.cwd(), '..', '..')

type EnrichType = 'deep' | 'til' | 'guide'

const PROMPTS: Record<EnrichType, (title: string, summary: string, content: string) => string> = {
  deep: (title, summary, content) => `당신은 기술 콘텐츠 분석 전문가입니다.

다음 콘텐츠를 심층 분석하여 한국어로 작성하세요.

제목: ${title}
기존 요약: ${summary}

원문 내용:
${content.slice(0, 12_000)}

다음 항목을 마크다운으로 작성하세요:
## 핵심 개념
## 기술적 상세
## 실용적 적용 방법
## 관련 자료 및 참고사항`,

  til: (title, summary, content) => `당신은 개발자 학습 노트 작성 전문가입니다.

다음 콘텐츠에서 배운 점을 TIL(Today I Learned) 형식으로 한국어로 작성하세요.

제목: ${title}
요약: ${summary}

원문 내용:
${content.slice(0, 8_000)}

TIL 형식 (마크다운):
## 오늘 배운 것
## 왜 중요한가
## 어떻게 활용할 것인가
## 한 줄 요약`,

  guide: (title, summary, content) => `당신은 기술 가이드 작성 전문가입니다.

다음 콘텐츠를 바탕으로 실용적인 한국어 가이드를 작성하세요.

제목: ${title}
요약: ${summary}

원문 내용:
${content.slice(0, 12_000)}

가이드 형식 (마크다운):
## 개요
## 사전 요구사항
## 단계별 가이드
## 주의사항
## 마무리`,
}

async function readVaultContent(vaultPath: string | null, platform: string): Promise<string> {
  if (!vaultPath) return ''
  try {
    const transcriptPath = join(ROOT, vaultPath, 'transcript.md')
    const extractPath = join(ROOT, vaultPath, 'extract.md')
    const targetPath = platform === 'github' ? extractPath : transcriptPath
    return await readFile(targetPath, 'utf-8')
  } catch {
    return ''
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp'
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, filePath)
}

async function notifyTelegram(
  job: { telegram_chat: number | null; telegram_msg: number | null },
  text: string,
) {
  if (job.telegram_chat === null) return
  await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: job.telegram_chat,
        text,
        reply_to_message_id: job.telegram_msg ?? undefined,
      }),
    },
  ).catch(() => {})
}

async function markBudgetExceeded(
  readDb: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  writeDb: ReturnType<typeof createServiceClient>,
  cardId: string,
  todayCost: number,
) {
  const message = `daily budget exceeded: $${todayCost.toFixed(4)} >= $${config.budget.dailyUsd.toFixed(2)}`

  const { data: jobs } = await readDb
    .from('jobs')
    .select('id, telegram_chat, telegram_msg')
    .eq('card_id', cardId)
    .in('status', ['queued', 'processing', 'failed'])
    .order('created_at', { ascending: false })
    .limit(3)

  const jobIds = (jobs ?? []).map((job) => job.id)
  if (jobIds.length > 0) {
    await writeDb
      .from('jobs')
      .update({
        status: 'dead',
        last_error: message,
        finished_at: new Date().toISOString(),
      })
      .in('id', jobIds)
  }

  await writeDb.from('events').insert({
    ts: new Date().toISOString(),
    level: 'warn',
    type: 'budget.exceeded',
    card_id: cardId,
    data: {
      daily_spend: todayCost,
      daily_cap: config.budget.dailyUsd,
      job_ids: jobIds,
    },
  })

  await Promise.all(
    (jobs ?? []).map((job) =>
      notifyTelegram(job, `💰 일일 예산 초과로 작업이 중단되었습니다. (${message})`),
    ),
  )
}

export async function POST(request: Request) {
  // server-auth-actions: 세션 검증 먼저
  const supabase = await createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (!config.adminUserIds.includes(user.id))
    return new NextResponse('Forbidden', { status: 403 })

  const body = (await request.json()) as { id?: string; type?: string }
  const { id, type } = body

  if (!id || !type || !['deep', 'til', 'guide'].includes(type)) {
    return NextResponse.json(
      { error: 'id and type(deep|til|guide) required' },
      { status: 400 },
    )
  }

  const enrichType = type as EnrichType

  // 카드 조회는 session JWT 기반 route client로 수행한다
  const { data: card } = await supabase.from('cards').select('*').eq('id', id).single()
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  // 이미 생성된 경우 409 반환
  const alreadyDone =
    (enrichType === 'deep' && card.has_deep) ||
    (enrichType === 'til' && card.has_til) ||
    (enrichType === 'guide' && card.has_guide)
  if (alreadyDone) {
    return NextResponse.json({ error: `${enrichType} already exists` }, { status: 409 })
  }

  // 비용 가드 (CRITICAL) — LLM 호출 전 오늘 llm.call 이벤트 cost_usd 합산
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: costEvents } = await supabase
    .from('events')
    .select('data')
    .eq('type', 'llm.call')
    .gte('ts', todayStart.toISOString())

  const todayCost = (costEvents ?? []).reduce((sum, evt) => {
    const data = evt.data as Record<string, unknown> | null
    return sum + ((data?.cost_usd as number) ?? 0)
  }, 0)

  if (todayCost >= config.budget.dailyUsd) {
    const serviceDb = createServiceClient()
    await markBudgetExceeded(supabase, serviceDb, id, todayCost)
    return NextResponse.json(
      { error: `daily budget exceeded ($${todayCost.toFixed(4)})` },
      { status: 429 },
    )
  }

  // vault에서 원문 로드 (실패해도 빈 문자열로 진행)
  const content = await readVaultContent(card.vault_path, card.platform)
  const prompt = PROMPTS[enrichType](card.title ?? card.url, card.summary ?? '', content)

  // Claude Sonnet 4.6 호출
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const resultText = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  // 토큰 기반 비용 추정 (Claude Sonnet 4.6: input $3/M, output $15/M)
  const costUsd =
    (message.usage.input_tokens * 3 + message.usage.output_tokens * 15) / 1_000_000

  // vault atomic write (CRITICAL: temp → rename)
  if (card.vault_path) {
    const filePath = join(ROOT, card.vault_path, `${enrichType}.md`)
    await atomicWrite(filePath, `# ${enrichType.toUpperCase()}\n\n${resultText}`)
  }

  const serviceDb = createServiceClient()

  // DB 업데이트 — write는 service client만 사용
  // enrichType별 has_* 필드를 명시적으로 분기한다 (동적 키는 Supabase 타입과 충돌)
  const baseUpdate = {
    cost_usd: (card.cost_usd ?? 0) + costUsd,
    tokens_used:
      (card.tokens_used ?? 0) + message.usage.input_tokens + message.usage.output_tokens,
    updated_at: new Date().toISOString(),
  }
  const enrichUpdate =
    enrichType === 'deep'
      ? { ...baseUpdate, has_deep: true, deep_content: resultText }
      : enrichType === 'til'
        ? { ...baseUpdate, has_til: true, til_content: resultText }
        : { ...baseUpdate, has_guide: true, guide_content: resultText }

  await serviceDb.from('cards').update(enrichUpdate).eq('id', id)

  // LLM 비용 이벤트 INSERT — 비용 가드는 이 이벤트만 합산한다
  await serviceDb.from('events').insert({
    ts: new Date().toISOString(),
    level: 'info',
    type: 'llm.call',
    card_id: id,
    data: {
      model: MODEL,
      operation: 'dashboard.enrich',
      enrich_type: enrichType,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
      cost_usd: costUsd,
    },
  })

  // enrich 완료 이벤트 INSERT
  await serviceDb.from('events').insert({
    ts: new Date().toISOString(),
    level: 'info',
    type: 'enrich.done',
    card_id: id,
    data: {
      enrich_type: enrichType,
      tokens: message.usage.input_tokens + message.usage.output_tokens,
      cost_usd: costUsd,
    },
  })

  return NextResponse.json({ ok: true, content: resultText })
}
