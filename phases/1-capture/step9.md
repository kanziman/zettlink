# Step 9: observability

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(LLM 호출 전 비용 가드)
- `docs/ADR.md` — ADR-009(관측성 — events 테이블 + pino)
- `docs/ARCHITECTURE.md` — §5(관측성 — event type 목록)
- `supabase/migrations/0001_init.sql` — events 테이블 스키마
- `apps/worker/src/index.ts` — dispatch 함수 (events INSERT 연결 위치)
- `apps/worker/src/llm/summarize.ts` — checkBudget, LLM 호출
- `phases/1-capture/index.json` — step 0~8 summary

## 작업

worker 전 단계에 events INSERT를 연결하고, bot notification을 완성하라.

이 step에서 새 파일을 만들기보다 **기존 파일을 연결·완성**하는 작업이 주다.

### 수정할 파일

**`apps/worker/src/index.ts` — dispatch 함수 완성**

step 1에서 skeleton으로 둔 TODO를 실제 단계로 연결:

```typescript
async function dispatch(job: Job) {
  const db = createServiceClient()

  try {
    // 1. canonicalize
    const canonical = canonicalize(job.raw_url)
    if (!canonical) {
      await db.from('events').insert({
        level: 'error', type: 'job.fail',
        job_id: job.id,
        data: { step: 'canonicalize', error: 'unsupported URL' }
      })
      await markDead(job, 'unsupported URL')
      await botNotify(job, '❌ 지원하지 않는 URL입니다.')
      return
    }

    // 2. UPSERT cards
    const slug = canonical.platform === 'youtube'
      ? titleToSlug(canonical.externalId)  // step 9에서 title 없으면 externalId로 임시
      : repoToSlug(canonical.externalId)

    const { data: card, error: upsertErr } = await db
      .from('cards')
      .upsert({
        id: slug,
        url: canonical.canonical,
        platform: canonical.platform,
        external_id: canonical.externalId,
        status: 'processing',
      }, { onConflict: 'platform,external_id', ignoreDuplicates: false })
      .select()
      .single()

    // 이미 존재하고 !force → skip
    if (!job.force && card?.status === 'done') {
      await botNotify(job, `🔗 이미 존재합니다: ${card.url}`)
      await markDone(job)
      return
    }

    await db.from('events').insert({
      level: 'info', type: 'job.pick',
      job_id: job.id, card_id: card?.id,
      data: { platform: canonical.platform, external_id: canonical.externalId }
    })

    // 3. extract
    let extractResult: YoutubeExtract | GithubExtract
    if (canonical.platform === 'youtube') {
      extractResult = await extractYoutube(canonical.externalId)
      await db.from('events').insert({
        level: 'info', type: 'extract.youtube',
        job_id: job.id, card_id: card?.id,
        data: { duration_s: extractResult.durationSec, transcript_chars: extractResult.transcript.length }
      })
    } else {
      extractResult = await extractGithub(canonical.externalId)
      await db.from('events').insert({
        level: 'info', type: 'extract.github',
        job_id: job.id, card_id: card?.id,
        data: { stars: (extractResult as GithubExtract).stars, language: (extractResult as GithubExtract).language }
      })
    }

    // 4. LLM summarize (checkBudget은 summarize 내부에서)
    const summary = await summarize(extractResult, canonical.platform, job.id)
    await db.from('events').insert({
      level: 'info', type: 'llm.call',
      job_id: job.id, card_id: card?.id,
      data: {
        model: 'claude-sonnet-4-6',
        input_tokens: summary.tokensUsed,
        cost_usd: summary.costUsd,
      }
    })

    // 5. cards 업데이트 (title, summary, insights, cost)
    const ytSlug = canonical.platform === 'youtube'
      ? titleToSlug(summary.title)
      : repoToSlug(canonical.externalId)
    await db.from('cards').update({
      id: ytSlug,
      title: summary.title,
      summary: summary.summary,
      insights: summary.insights,
      status: 'done',
      tokens_used: summary.tokensUsed,
      cost_usd: summary.costUsd,
    }).eq('id', card?.id ?? slug)

    // 6. tag normalize
    await normalizeTags(summary.tags, ytSlug)

    // 7. vault write + git push (선택, 실패해도 done 처리)
    try {
      const vaultPath = await writeVault({
        card: { ...card, id: ytSlug } as Card,
        summary,
        transcript: canonical.platform === 'youtube' ? (extractResult as YoutubeExtract).transcript : undefined,
        extract: canonical.platform === 'github' ? (extractResult as GithubExtract).readme : undefined,
      })
      await commitAndPush(ytSlug, canonical.platform)
    } catch (vaultErr) {
      logger.warn({ vaultErr, slug: ytSlug }, 'vault write/push failed — continuing')
    }

    // 8. job done
    await db.from('events').insert({
      level: 'info', type: 'job.done',
      job_id: job.id, card_id: ytSlug,
      data: { slug: ytSlug }
    })
    await markDone(job)
    await botNotify(job, `✅ ${summary.title} (${ytSlug})`)

  } catch (err) {
    await db.from('events').insert({
      level: 'error', type: 'job.fail',
      job_id: job.id,
      data: { error: String(err) }
    })
    await markFailed(job, err)
    if (job.attempts >= job.max_attempts) {
      await botNotify(job, `❌ 처리 실패: ${String(err).slice(0, 200)}`)
    }
  }
}
```

**`apps/bot/src/index.ts` — botNotify 함수 추가**

worker가 bot telegram 메시지를 보낼 방법이 필요하다. bot과 worker가 같은 Mac에서 실행되므로 **Telegram API를 직접 호출**:

```typescript
// apps/worker/src/notify.ts
export async function botNotify(job: { telegram_chat: number | null; telegram_msg: number | null }, text: string) {
  if (!job.telegram_chat) return
  const token = config.telegram.botToken
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: job.telegram_chat,
      text,
      reply_to_message_id: job.telegram_msg ?? undefined,
    }),
  })
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# 7종 event type 모두 존재 확인
for TYPE in bot.recv job.pick extract.youtube extract.github llm.call job.done job.fail; do
  grep -r "$TYPE" apps/bot/src/ apps/worker/src/ && echo "$TYPE OK" || echo "$TYPE MISSING"
done

# budget guard가 summarize 내부에 있는지 확인
grep -r "checkBudget\|dailyUsd" apps/worker/src/llm/summarize.ts && echo "budget guard OK"

# bot notify 확인
grep -r "botNotify\|sendMessage" apps/worker/src/ && echo "notify OK"

# 전체 빌드 & 테스트
pnpm install
pnpm --filter @zettlink/shared test
pnpm --filter @zettlink/worker test
pnpm --filter @zettlink/bot build
pnpm --filter @zettlink/worker build
```

## 금지사항

- events INSERT를 생략하는 단계가 있으면 안 된다. `bot.recv` / `job.pick` / `llm.call` / `job.done` / `job.fail` 5종은 반드시. `bot.recv`는 bot(step 0)에서, 나머지는 worker에서 INSERT한다.
- vault 실패로 카드 done 처리를 막지 마라. vault는 옵션이다.
- bot notify 실패로 job markDone을 막지 마라. notify는 best-effort.
