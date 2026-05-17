// Telegram URL 수신 → jobs 테이블 INSERT 데몬
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

// 기동 전 환경변수 존재 여부 확인 (값은 config에서 관리)
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.fatal('TELEGRAM_BOT_TOKEN missing — blocked')
  process.exit(1)
}
if (!process.env.TELEGRAM_WHITELIST?.trim()) {
  logger.fatal('TELEGRAM_WHITELIST missing — blocked')
  process.exit(1)
}

const { config } = await import('@zettlink/shared')
const { createServiceClient } = await import('@zettlink/db')
const { Telegraf } = await import('telegraf')

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}

const bot = new Telegraf(config.telegram.botToken)
const whitelist = new Set(config.telegram.whitelist.map(String))

bot.on('message', async (ctx) => {
  try {
    const chatId = ctx.chat?.id
    const userId = ctx.from?.id

    // whitelist 검증 — chat_id 또는 from.id 중 하나가 목록에 있어야 함
    const isAllowed =
      (chatId != null && whitelist.has(String(chatId))) ||
      (userId != null && whitelist.has(String(userId)))

    if (!isAllowed) return

    const text = 'text' in ctx.message ? ctx.message.text : null
    if (!text) return

    const msgId = ctx.message.message_id
    const force = text.toLowerCase().includes('+force')
    const rawUrl = extractUrl(text.replace(/\+force/gi, '').trim())

    const supabase = createServiceClient()

    // whitelist 통과 직후 bot.recv 이벤트 기록 — jobs INSERT 전
    await supabase.from('events').insert({
      type: 'bot.recv',
      data: {
        chat_id: chatId,
        msg_id: msgId,
        raw_text: text,
        has_url: !!rawUrl,
      },
    })

    if (!rawUrl) {
      await ctx.reply('URL을 포함한 메시지를 보내주세요.')
      return
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        raw_url: rawUrl,
        status: 'queued',
        telegram_chat: chatId,
        telegram_msg: msgId,
        force,
        next_attempt_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      logger.error({ error }, 'jobs INSERT failed')
      await ctx.reply('❌ 서버 오류, 잠시 후 다시 시도해주세요.')
      return
    }

    logger.info({ jobId: job.id, rawUrl, force }, 'job queued')
    await ctx.reply(`⏳ queued #${job.id}`)
  } catch (err) {
    logger.error({ err }, 'message handler error')
    try {
      await ctx.reply('❌ 서버 오류, 잠시 후 다시 시도해주세요.')
    } catch {
      // reply 실패는 무시
    }
  }
})

bot.launch()
logger.info('Bot started')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
