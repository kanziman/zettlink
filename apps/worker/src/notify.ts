// Telegram API를 직접 호출해 사용자에게 알림을 보내는 best-effort 유틸리티
import pino from 'pino'
import { config } from '@zettlink/shared'

const logger = pino({ level: 'info' })

interface JobRef {
  telegram_chat: number | null
  telegram_msg: number | null
}

export async function botNotify(job: JobRef, text: string): Promise<void> {
  if (!job.telegram_chat) return
  try {
    await fetch(
      `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: job.telegram_chat,
          text,
          reply_to_message_id: job.telegram_msg ?? undefined,
        }),
      },
    )
  } catch (err) {
    logger.warn({ err }, 'botNotify failed — continuing')
  }
}
