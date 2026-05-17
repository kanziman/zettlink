// card 데이터를 vault/.md로 atomic export하는 모듈
import { writeFile, rename, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import type { Card } from '@zettlink/shared'
import type { SummaryResult } from '../llm/summarize.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../')

export interface VaultWriteInput {
  card: Card
  summary: SummaryResult
  transcript?: string
  transcriptSource?: string
  extract?: string
  vaultRoot?: string
}

function buildIndexMd(card: Card, summary: SummaryResult, transcriptSource?: string): string {
  const frontmatter = [
    '---',
    `id: ${card.id}`,
    `platform: ${card.platform}`,
    `url: ${card.url}`,
    `title: "${summary.title.replace(/"/g, '\\"')}"`,
    `status: ${card.status}`,
    `published: ${card.published}`,
    `created_at: ${card.createdAt}`,
    ...(transcriptSource ? [`content_source: ${transcriptSource}`] : []),
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

function buildTranscriptMd(transcript: string, transcriptSource?: string): string {
  const header = transcriptSource
    ? [
        '# Transcript',
        '',
        `source: ${transcriptSource}`,
        ...(transcriptSource === 'description'
          ? ['', '> This file contains YouTube description fallback, not downloaded subtitles.']
          : []),
        '',
      ].join('\n')
    : '# Transcript\n\n'

  return header + transcript
}

async function atomicWrite(finalPath: string, content: string): Promise<void> {
  const tempPath = finalPath + '.tmp'
  await writeFile(tempPath, content, 'utf-8')
  await rename(tempPath, finalPath)
}

export async function writeVault(input: VaultWriteInput): Promise<string> {
  const { card, summary, transcript, transcriptSource, extract } = input

  const vaultRoot = input.vaultRoot ?? join(ROOT, 'vault')
  const dir = join(vaultRoot, card.platform, card.id)
  await mkdir(dir, { recursive: true })

  const finalPath = join(dir, 'index.md')
  await atomicWrite(finalPath, buildIndexMd(card, summary, transcriptSource))

  if (transcript) {
    await atomicWrite(join(dir, 'transcript.md'), buildTranscriptMd(transcript, transcriptSource))
  }
  if (extract) {
    await atomicWrite(join(dir, 'extract.md'), `# README\n\n${extract}`)
  }

  return finalPath
}
