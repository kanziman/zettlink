import { readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Card } from '@zettlink/shared'
import type { SummaryResult } from '../llm/summarize.js'
import { writeVault } from '../vault/write.js'

function card(): Card {
  return {
    id: 'youtube-card',
    url: 'https://www.youtube.com/watch?v=abc123',
    platform: 'youtube',
    externalId: 'abc123',
    title: 'Original',
    summary: null,
    insights: null,
    rawMetadata: null,
    status: 'done',
    published: false,
    hasDeep: false,
    hasTil: false,
    hasGuide: false,
    vaultPath: null,
    tokensUsed: 0,
    costUsd: 0,
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedAt: '2026-05-17T00:00:00.000Z',
  }
}

const summary: SummaryResult = {
  title: 'AI로 만든 제품이 안 팔리는 이유',
  summary: 'summary',
  insights: ['insight'],
  tags: ['ai'],
  tokensUsed: 10,
  costUsd: 0.01,
}

describe('writeVault', () => {
  it('records description fallback source without truncating transcript content', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'zettlink-vault-test-'))
    const transcript = 'description fallback '.repeat(2_000)

    const indexPath = await writeVault({
      card: card(),
      summary,
      transcript,
      transcriptSource: 'description',
      vaultRoot,
    })

    const index = await readFile(indexPath, 'utf-8')
    const transcriptMd = await readFile(join(vaultRoot, 'youtube', 'youtube-card', 'transcript.md'), 'utf-8')

    expect(index).toContain('content_source: description')
    expect(transcriptMd).toContain('source: description')
    expect(transcriptMd).toContain('description fallback, not downloaded subtitles')
    expect(transcriptMd).toContain(transcript)
  })
})
