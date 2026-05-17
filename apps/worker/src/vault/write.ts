// card 데이터를 vault/.md로 atomic export하는 모듈
import { writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Card } from '@zettlink/shared'
import type { SummaryResult } from '../llm/summarize.js'

export interface VaultWriteInput {
  card: Card
  summary: SummaryResult
  transcript?: string
  extract?: string
}

function buildIndexMd(card: Card, summary: SummaryResult): string {
  const frontmatter = [
    '---',
    `id: ${card.id}`,
    `platform: ${card.platform}`,
    `url: ${card.url}`,
    `title: "${summary.title.replace(/"/g, '\\"')}"`,
    `status: ${card.status}`,
    `published: ${card.published}`,
    `created_at: ${card.createdAt}`,
    '---',
  ].join('\n')

  const body = [
    `# ${summary.title}`,
    '',
    `> ${card.url}`,
    '',
    '## 요약',
    '',
    summary.summary,
    '',
    '## 인사이트',
    '',
    ...summary.insights.map(i => `- ${i}`),
  ].join('\n')

  return frontmatter + '\n\n' + body + '\n'
}

async function atomicWrite(finalPath: string, content: string): Promise<void> {
  const tempPath = finalPath + '.tmp'
  await writeFile(tempPath, content, 'utf-8')
  await rename(tempPath, finalPath)
}

export async function writeVault(input: VaultWriteInput): Promise<string> {
  const { card, summary, transcript, extract } = input

  const vaultRoot = join(process.cwd(), 'vault')
  const dir = join(vaultRoot, card.platform, card.id)
  await mkdir(dir, { recursive: true })

  const finalPath = join(dir, 'index.md')
  await atomicWrite(finalPath, buildIndexMd(card, summary))

  if (transcript) {
    await atomicWrite(join(dir, 'transcript.md'), `# Transcript\n\n${transcript}`)
  }
  if (extract) {
    await atomicWrite(join(dir, 'extract.md'), `# README\n\n${extract}`)
  }

  return finalPath
}
