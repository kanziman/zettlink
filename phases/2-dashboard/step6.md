# Step 6: api-routes

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: LLM 호출 전 비용 가드, service_role만 write, NEXT_PUBLIC_ prefix 규칙
- `packages/db/src/server.ts` — createServiceClient (write용), createRouteClient/createServerClient (session JWT read용)
- `packages/db/src/types.gen.ts` — cards, jobs, events Insert 타입
- `packages/shared/src/config.ts` — config.budget.dailyUsd, config.adminUserIds
- `apps/worker/src/llm/prompts.ts` — 프롬프트 빌더 패턴 참고
- `apps/worker/src/vault/write.ts` — writeVault 시그니처 참고
- `apps/dashboard/lib/supabase/server.ts` — createSupabaseRouteClient (세션 갱신 가능)

## 작업

enrich, publish, reprocess 3개 Route Handler를 구현한다.
모든 Route Handler는 `server-auth-actions` 규칙에 따라 세션 검증 + admin 확인을 첫 번째로 수행한다.

### 생성할 파일

**`apps/dashboard/app/api/enrich/route.ts`**

```typescript
// 심화 요약(deep/til/guide) 생성 API — Claude Sonnet 4.6 호출 후 vault write + DB 업데이트
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'
import { createServiceClient } from '@zettlink/db/server'
import { config } from '@zettlink/shared'
import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFile, rename, mkdir } from 'node:fs/promises'

const MODEL = 'claude-sonnet-4-6'
const ROOT = process.cwd()  // Next.js는 프로젝트 루트에서 실행

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

async function notifyTelegram(job: { telegram_chat: number | null; telegram_msg: number | null }, text: string) {
  if (job.telegram_chat === null) return
  await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: job.telegram_chat,
      text,
      reply_to_message_id: job.telegram_msg ?? undefined,
    }),
  }).catch(() => {})
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

  const jobIds = (jobs ?? []).map(job => job.id)
  if (jobIds.length > 0) {
    await writeDb
      .from('jobs')
      .update({ status: 'dead', last_error: message, finished_at: new Date().toISOString() })
      .in('id', jobIds)
  }

  await writeDb.from('events').insert({
    ts: new Date().toISOString(),
    level: 'warn',
    type: 'budget.exceeded',
    card_id: cardId,
    data: { daily_spend: todayCost, daily_cap: config.budget.dailyUsd, job_ids: jobIds },
  })

  await Promise.all((jobs ?? []).map(job =>
    notifyTelegram(job, `💰 일일 예산 초과로 작업이 중단되었습니다. (${message})`)
  ))
}

export async function POST(request: Request) {
  // server-auth-actions: 세션 검증 먼저
  const supabase = await createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  if (!config.adminUserIds.includes(user.id)) return new NextResponse('Forbidden', { status: 403 })

  const body = await request.json() as { id?: string; type?: string }
  const { id, type } = body

  if (!id || !type || !['deep', 'til', 'guide'].includes(type)) {
    return NextResponse.json({ error: 'id and type(deep|til|guide) required' }, { status: 400 })
  }

  const enrichType = type as EnrichType
  // 카드 조회는 session JWT 기반 route client로 수행한다.
  const { data: card } = await supabase.from('cards').select('*').eq('id', id).single()
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  // 이미 생성된 경우
  const alreadyDone =
    (enrichType === 'deep' && card.has_deep) ||
    (enrichType === 'til' && card.has_til) ||
    (enrichType === 'guide' && card.has_guide)
  if (alreadyDone) return NextResponse.json({ error: `${enrichType} already exists` }, { status: 409 })

  // 비용 가드 (CRITICAL)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: costEvents } = await supabase
    .from('events')
    .select('data')
    .eq('type', 'llm.call')
    .gte('ts', todayStart.toISOString())
  const todayCost = (costEvents ?? []).reduce((sum, evt) => {
    return sum + (((evt.data as Record<string, unknown>)?.cost_usd as number) ?? 0)
  }, 0)
  if (todayCost >= config.budget.dailyUsd) {
    const serviceDb = createServiceClient()
    await markBudgetExceeded(supabase, serviceDb, id, todayCost)
    return NextResponse.json({ error: `daily budget exceeded ($${todayCost.toFixed(4)})` }, { status: 429 })
  }

  // vault에서 원문 로드
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
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  const costUsd = (message.usage.input_tokens * 3 + message.usage.output_tokens * 15) / 1_000_000

  // vault atomic write
  if (card.vault_path) {
    const filePath = join(ROOT, card.vault_path, `${enrichType}.md`)
    await atomicWrite(filePath, `# ${enrichType.toUpperCase()}\n\n${resultText}`)
  }

  const serviceDb = createServiceClient()

  // DB 업데이트
  const updateField: Record<EnrichType, string> = { deep: 'has_deep', til: 'has_til', guide: 'has_guide' }
  await serviceDb.from('cards').update({
    [updateField[enrichType]]: true,
    cost_usd: (card.cost_usd ?? 0) + costUsd,
    tokens_used: (card.tokens_used ?? 0) + message.usage.input_tokens + message.usage.output_tokens,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

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
    data: { enrich_type: enrichType, tokens: message.usage.input_tokens + message.usage.output_tokens, cost_usd: costUsd },
  })

  return NextResponse.json({ ok: true, content: resultText })
}
```

**`apps/dashboard/app/api/publish/route.ts`**

```typescript
// 카드 published 상태 토글 API
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'
import { createServiceClient } from '@zettlink/db/server'
import { config } from '@zettlink/shared'

export async function POST(request: Request) {
  // server-auth-actions: 세션 검증 먼저
  const supabase = await createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  if (!config.adminUserIds.includes(user.id)) return new NextResponse('Forbidden', { status: 403 })

  const body = await request.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 조회는 session JWT 기반 route client로 수행한다.
  const { data: card } = await supabase.from('cards').select('published').eq('id', body.id).single()
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  const newPublished = !card.published
  const serviceDb = createServiceClient()
  await serviceDb.from('cards').update({
    published: newPublished,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id)

  return NextResponse.json({ ok: true, published: newPublished })
}
```

**`apps/dashboard/app/api/reprocess/route.ts`**

```typescript
// 카드 재처리 API — 기존 URL로 새 job을 queued 상태로 INSERT
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase/server'
import { createServiceClient } from '@zettlink/db/server'
import { config } from '@zettlink/shared'

export async function POST(request: Request) {
  // server-auth-actions: 세션 검증 먼저
  const supabase = await createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  if (!config.adminUserIds.includes(user.id)) return new NextResponse('Forbidden', { status: 403 })

  const body = await request.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 조회는 session JWT 기반 route client로 수행한다.
  const { data: card } = await supabase.from('cards').select('url').eq('id', body.id).single()
  if (!card) return NextResponse.json({ error: 'card not found' }, { status: 404 })

  const serviceDb = createServiceClient()
  const { data: job } = await serviceDb.from('jobs').insert({
    raw_url: card.url,
    status: 'queued',
    force: true,
    next_attempt_at: new Date().toISOString(),
  }).select('id').single()

  return NextResponse.json({ ok: true, jobId: job?.id })
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/dashboard build
# → 성공

# curl 테스트 (dev 서버 실행 상태에서)
# 1. 인증 없이 POST → 401
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/publish -H "Content-Type: application/json" -d '{"id":"test"}'
# → 401

# 2. admin 세션으로 POST /api/publish → 200, published 반전
# 3. admin 세션으로 POST /api/enrich {id, type:'deep'} → 200, DB has_deep=true
# 4. admin 세션으로 POST /api/reprocess → 200, jobs에 queued row 생성
```

## 금지사항

- `server-auth-actions`: 세션 검증 없이 DB write를 수행하지 마라. 모든 Route Handler의 첫 동작은 `getUser()` + admin 확인.
- enrich route에서 LLM 호출 전 `events` 테이블의 오늘 `type='llm.call'` 행을 합산하는 비용 가드 체크를 반드시 수행하라 (CRITICAL). 카드 테이블의 누적 비용 필드로 대체하지 마라.
- 비용 초과 시 429만 반환하지 마라. 관련 `jobs`를 `dead`로 바꾸고 `budget.exceeded` 이벤트와 Telegram bot 알림을 남겨라.
- `cards`, `events`, `jobs` 조회는 인증된 사용자의 session JWT가 담긴 `createSupabaseRouteClient()`로 수행하라. `createServiceClient()`는 `cards.update`, `jobs.insert/update`, `events.insert` 같은 write 직전에만 생성해 사용하라.
- budget cap은 환경변수를 각 앱에서 직접 파싱하지 말고 `@zettlink/shared`의 `config.budget.dailyUsd`를 사용하라.
- admin whitelist는 환경변수를 각 앱에서 직접 파싱하지 말고 `@zettlink/shared`의 `config.adminUserIds`를 사용하라.
- `ANTHROPIC_API_KEY`를 `NEXT_PUBLIC_` prefix로 노출하지 마라.
- `createServiceClient()`를 클라이언트 번들에 포함되는 코드('use client' 파일)에서 호출하지 마라.
- enrich의 vault write는 반드시 atomic(temp → rename) 패턴을 사용하라.
