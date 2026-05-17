// URL 처리 작업 큐 폴링·실행 데몬 (pick_next_job RPC 기반 직렬 처리)
import pino from 'pino'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logsDir = join(__dirname, '../../../logs')
mkdirSync(logsDir, { recursive: true })

const today = new Date().toISOString().slice(0, 10)
const logger = pino(
  { level: 'info' },
  pino.destination(join(logsDir, `zettlink-${today}.log`)),
)

const { createServiceClient } = await import('@zettlink/db')
const { canonicalize, titleToSlug, repoToSlug } = await import('@zettlink/shared')
const { backoffMs } = await import('./retry.js')
const { extractYoutube } = await import('./extractors/youtube.js')
const { extractGithub } = await import('./extractors/github.js')
const { summarize, BudgetExceededError } = await import('./llm/summarize.js')
const { normalizeTags } = await import('./llm/tag-normalize.js')
const { writeVault } = await import('./vault/write.js')
const { commitAndPush } = await import('./vault/git.js')
const { botNotify } = await import('./notify.js')

import type { Database } from '@zettlink/db'
import type { YoutubeExtract } from './extractors/youtube.js'
import type { GithubExtract } from './extractors/github.js'
import type { Card } from '@zettlink/shared'

type DbJob = Database['public']['Functions']['pick_next_job']['Returns']

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function markDone(job: DbJob): Promise<void> {
  const db = createServiceClient()
  await db
    .from('jobs')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', job.id)
}

async function markDead(job: DbJob, reason: string): Promise<void> {
  const db = createServiceClient()
  await db
    .from('jobs')
    .update({
      status: 'dead',
      last_error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq('id', job.id)
}

async function markFailed(job: DbJob, err: unknown): Promise<void> {
  const db = createServiceClient()
  // pick_next_job이 이미 attempts를 +1한 상태로 반환
  const attempts = job.attempts
  const isDead = attempts >= job.max_attempts
  const nextAttemptAt = new Date(Date.now() + backoffMs(attempts)).toISOString()

  await db
    .from('jobs')
    .update({
      status: isDead ? 'dead' : 'failed',
      last_error: String(err),
      next_attempt_at: nextAttemptAt,
      finished_at: isDead ? new Date().toISOString() : null,
    })
    .eq('id', job.id)

  logger.warn({ jobId: job.id, attempts, isDead, err: String(err) }, 'job.fail')
}

async function dispatch(job: DbJob): Promise<void> {
  const db = createServiceClient()

  try {
    // 1. URL 정규화
    const canonical = canonicalize(job.raw_url)
    if (!canonical) {
      await db.from('events').insert({
        level: 'error',
        type: 'job.fail',
        job_id: job.id,
        data: { step: 'canonicalize', error: 'unsupported URL' },
      })
      await markDead(job, 'unsupported URL')
      await botNotify(job, '❌ 지원하지 않는 URL입니다.')
      return
    }

    // 2. 기존 카드 존재 여부 확인
    const { data: existingCard } = await db
      .from('cards')
      .select('id, status')
      .eq('platform', canonical.platform)
      .eq('external_id', canonical.externalId)
      .maybeSingle()

    if (existingCard && existingCard.status === 'done' && !job.force) {
      await botNotify(job, `🔗 이미 존재합니다: ${canonical.canonical}`)
      await markDone(job)
      return
    }

    // 3. job.pick 이벤트 기록
    await db.from('events').insert({
      level: 'info',
      type: 'job.pick',
      job_id: job.id,
      data: { platform: canonical.platform, external_id: canonical.externalId },
    })
    logger.info({ jobId: job.id, url: canonical.canonical }, 'job.pick')

    // 4. 플랫폼별 추출
    let extract: YoutubeExtract | GithubExtract
    let cardId: string

    if (canonical.platform === 'youtube') {
      extract = await extractYoutube(canonical.externalId)
      cardId = existingCard?.id ?? (titleToSlug((extract as YoutubeExtract).title) || canonical.externalId)
      await db.from('events').insert({
        level: 'info',
        type: 'extract.youtube',
        job_id: job.id,
        data: {
          duration_s: (extract as YoutubeExtract).durationSec,
          transcript_chars: (extract as YoutubeExtract).transcript.length,
        },
      })
    } else {
      extract = await extractGithub(canonical.externalId)
      cardId = existingCard?.id ?? repoToSlug(canonical.externalId)
      await db.from('events').insert({
        level: 'info',
        type: 'extract.github',
        job_id: job.id,
        data: {
          stars: (extract as GithubExtract).stars,
          language: (extract as GithubExtract).language,
        },
      })
    }

    // 5. 카드 INSERT 또는 processing 상태로 UPDATE
    if (existingCard) {
      await db
        .from('cards')
        .update({ status: 'processing', url: canonical.canonical })
        .eq('id', existingCard.id)
    } else {
      await db.from('cards').insert({
        id: cardId,
        url: canonical.canonical,
        platform: canonical.platform,
        external_id: canonical.externalId,
        status: 'processing',
      })
    }

    // 6. LLM 요약 (checkBudget + llm.call 이벤트는 summarize 내부에서 처리)
    const summary = await summarize(extract, canonical.platform, job.id)

    // 7. 카드 LLM 결과 반영
    await db
      .from('cards')
      .update({
        title: summary.title,
        summary: summary.summary,
        insights: summary.insights as unknown as import('@zettlink/db').Database['public']['Tables']['cards']['Update']['insights'],
        tokens_used: summary.tokensUsed,
        cost_usd: summary.costUsd,
        status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)

    // 8. 태그 정규화 + card_tags 연결
    await normalizeTags(summary.tags, cardId)

    // 9. vault write + git push (실패해도 done 처리)
    try {
      const cardForVault: Card = {
        id: cardId,
        url: canonical.canonical,
        platform: canonical.platform,
        externalId: canonical.externalId,
        title: summary.title,
        summary: summary.summary,
        insights: summary.insights,
        rawMetadata: null,
        status: 'done',
        published: false,
        hasDeep: false,
        hasTil: false,
        hasGuide: false,
        vaultPath: null,
        tokensUsed: summary.tokensUsed,
        costUsd: summary.costUsd,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await writeVault({
        card: cardForVault,
        summary,
        transcript:
          canonical.platform === 'youtube'
            ? (extract as YoutubeExtract).transcript
            : undefined,
        extract:
          canonical.platform === 'github'
            ? (extract as GithubExtract).readme
            : undefined,
      })
      await commitAndPush(cardId, canonical.platform)
    } catch (vaultErr) {
      logger.warn({ vaultErr, cardId }, 'vault write/push failed — continuing')
    }

    // 10. job.done 이벤트 기록 + 완료 처리
    await db.from('events').insert({
      level: 'info',
      type: 'job.done',
      job_id: job.id,
      card_id: cardId,
      data: { slug: cardId },
    })
    await markDone(job)

    // bot notify 실패가 done 처리를 막지 않도록 soft-fail
    botNotify(job, `✅ ${summary.title} (${cardId})`).catch((err) =>
      logger.warn({ err }, 'botNotify failed'),
    )
  } catch (err) {
    logger.error({ jobId: job.id, err }, 'dispatch error')

    // budget 초과: 즉시 dead + bot notify (retry 없음)
    if (err instanceof BudgetExceededError) {
      try {
        await db.from('events').insert({
          level: 'error',
          type: 'job.fail',
          job_id: job.id,
          data: { error: String(err), reason: 'budget_exceeded' },
        })
      } catch { /* ignore */ }
      await markDead(job, String(err))
      botNotify(job, `💰 일일 예산 초과로 작업이 중단되었습니다. (${err.message})`).catch(() => {})
      return
    }

    // job.fail 이벤트 기록
    try {
      await db.from('events').insert({
        level: 'error',
        type: 'job.fail',
        job_id: job.id,
        data: { error: String(err) },
      })
    } catch { /* events INSERT 실패는 무시 */ }

    await markFailed(job, err)

    if (job.attempts >= job.max_attempts) {
      botNotify(job, `❌ 처리 실패: ${String(err).slice(0, 200)}`).catch(() => {/* ignore */})
    }
  }
}

async function processNextJob(): Promise<void> {
  const db = createServiceClient()
  const { data: job, error } = await db.rpc('pick_next_job')

  if (error) {
    logger.error({ error }, 'pick_next_job RPC error')
    return
  }

  if (!job || !job.id) return

  await dispatch(job)
}

// 30분 초과 stuck job을 queued로 복귀 (pollLoop와 별도 interval)
async function reaper(): Promise<void> {
  const db = createServiceClient()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { error } = await db
    .from('jobs')
    .update({ status: 'queued', picked_at: null })
    .eq('status', 'processing')
    .lt('picked_at', cutoff)

  if (error) {
    logger.error({ error }, 'reaper error')
  } else {
    logger.debug({ cutoff }, 'reaper ran')
  }
}

async function pollLoop(): Promise<void> {
  while (true) {
    await processNextJob()
    await sleep(5_000)
  }
}

setInterval(() => {
  reaper().catch((err) => logger.error({ err }, 'reaper unhandled error'))
}, 10 * 60 * 1000)

logger.info('Worker started')
pollLoop().catch((err) => {
  logger.fatal({ err }, 'pollLoop crashed')
  process.exit(1)
})

process.once('SIGINT', () => {
  logger.info('SIGINT received, shutting down')
  process.exit(0)
})
process.once('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down')
  process.exit(0)
})
