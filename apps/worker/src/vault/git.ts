// vault/ 변경사항을 git commit + push하는 모듈 (backup 채널, 실패 시 soft-fail)
import { execa } from 'execa'
import pino from 'pino'

const logger = pino({ level: 'info' })

export async function commitAndPush(slug: string, platform: string): Promise<void> {
  const vaultPath = `vault/${platform}/${slug}`

  try {
    await execa('git', ['add', vaultPath])

    const { stdout: diffStat } = await execa('git', ['diff', '--cached', '--stat'])
    if (!diffStat.trim()) return

    await execa('git', ['commit', '-m', `feat(vault): add ${platform}/${slug}`])

    try {
      await execa('git', ['push'])
    } catch {
      await execa('git', ['pull', '--rebase'])
      await execa('git', ['push'])
    }
  } catch (err) {
    logger.warn({ err, slug }, 'vault git push failed — skipping')
  }
}
