// vault/ 변경사항을 git commit + push하는 모듈 (backup 채널, 실패 시 soft-fail)
import { execa } from 'execa'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pino from 'pino'

const logger = pino({ level: 'info' })

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../')
const git = (...args: string[]) => execa('git', args, { cwd: ROOT })

export async function commitAndPush(slug: string, platform: string): Promise<void> {
  const vaultPath = `vault/${platform}/${slug}`

  try {
    await git('add', vaultPath)

    const { stdout: diffStat } = await git('diff', '--cached', '--stat')
    if (!diffStat.trim()) return

    await git('commit', '-m', `feat(vault): add ${platform}/${slug}`)

    try {
      await git('push', '--set-upstream', 'origin', 'HEAD')
    } catch {
      await git('pull', '--rebase', '--autostash', 'origin', 'HEAD')
      await git('push', '--set-upstream', 'origin', 'HEAD')
    }
  } catch (err) {
    logger.warn({ err, slug }, 'vault git push failed — skipping')
  }
}
