// zettlink 도메인 공유 타입 — DB 스키마와 1:1 대응 (camelCase)
export type Platform = 'youtube' | 'github'
export type CardStatus = 'pending' | 'processing' | 'done' | 'failed'
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'dead'
export type EventLevel = 'info' | 'warn' | 'error'

export interface Card {
  id: string
  url: string
  platform: Platform
  externalId: string
  title: string | null
  summary: string | null
  insights: string[] | null
  rawMetadata: Record<string, unknown> | null
  status: CardStatus
  published: boolean
  hasDeep: boolean
  hasTil: boolean
  hasGuide: boolean
  vaultPath: string | null
  tokensUsed: number
  costUsd: number
  createdAt: string
  updatedAt: string
}

export interface Job {
  id: number
  rawUrl: string
  canonicalUrl: string | null
  cardId: string | null
  telegramChat: number | null
  telegramMsg: number | null
  force: boolean
  attempts: number
  maxAttempts: number
  status: JobStatus
  lastError: string | null
  pickedAt: string | null
  nextAttemptAt: string
  createdAt: string
  finishedAt: string | null
}

export interface Event {
  id: number
  ts: string
  level: EventLevel
  type: string
  cardId: string | null
  jobId: number | null
  data: Record<string, unknown> | null
}
