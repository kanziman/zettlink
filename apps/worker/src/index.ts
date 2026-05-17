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
const { canonicalize } = await import('@zettlink/shared')
const { backoffMs } = await import('./retry.js')

import type { Database } from '@zettlink/db'
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
  try {
    const canonical = canonicalize(job.raw_url)
    if (!canonical) {
      await markDead(job, 'unsupported URL')
      logger.warn({ jobId: job.id, url: job.raw_url }, 'unsupported URL — dead')
      return
    }

    logger.info({ jobId: job.id, url: canonical.canonical }, 'job.pick')

    // TODO(step 2): youtube extractor
    // TODO(step 3): github extractor
    // TODO(step 4): llm summarize (비용 가드 포함)
    // TODO(step 5): tag normalize
    // TODO(step 6): vault write (atomic temp+rename)
    // TODO(step 7): vault git push

    await markDone(job)
    logger.info({ jobId: job.id }, 'job.done')
  } catch (err) {
    logger.error({ jobId: job.id, err }, 'dispatch error')
    await markFailed(job, err)
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
