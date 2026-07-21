// LLM 호출로 YouTube/GitHub 콘텐츠를 요약·인사이트·태그로 변환하는 모듈
import OpenAI from 'openai'
import { config } from '@zettlink/shared'
import { createServiceClient } from '@zettlink/db'
import type { YoutubeExtract } from '../extractors/youtube.js'
import type { GithubExtract } from '../extractors/github.js'
import { buildPrompt } from './prompts.js'

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export interface SummaryResult {
  title: string
  summary: string
  insights: string[]
  tags: string[]
  englishSlug: string
  tokensUsed: number
  costUsd: number
}

const openai = new OpenAI({
  apiKey: config.openrouter.apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/zettlink',
    'X-Title': 'zettlink',
  },
})

const tools: OpenAI.Chat.ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'save_summary',
    description: '콘텐츠 요약 결과를 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '콘텐츠 제목 (원본 언어)' },
        english_slug: { type: 'string', description: 'URL-safe English slug: 2-5 lowercase words joined by hyphens, summarising the content (e.g. "react-server-components-deep-dive")' },
        summary: { type: 'string', description: '한국어 요약 (3~5문장)' },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description: '핵심 인사이트 (한국어, 3~7개)',
          minItems: 3,
          maxItems: 7,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '영어 소문자 태그 (3~10개)',
          minItems: 3,
          maxItems: 10,
        },
      },
      required: ['title', 'english_slug', 'summary', 'insights', 'tags'],
    },
  },
}]

// Claude Sonnet 4.6 via OpenRouter 가격 추정 (input: $3/MTok, output: $15/MTok)
function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens * 3 + completionTokens * 15) / 1_000_000
}

async function checkBudget(): Promise<void> {
  const db = createServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await db
    .from('events')
    .select('data')
    .eq('type', 'llm.call')
    .gte('ts', todayStart.toISOString())

  const dailySpend = (data ?? []).reduce((sum, row) => {
    return sum + (((row.data as Record<string, unknown>)?.['cost_usd'] as number) ?? 0)
  }, 0)

  if (dailySpend >= config.budget.dailyUsd) {
    throw new BudgetExceededError(`daily budget exceeded: $${dailySpend.toFixed(2)} >= $${config.budget.dailyUsd}`)
  }

  if (dailySpend >= config.budget.dailyUsd * config.budget.alertAtPct / 100) {
    await db.from('events').insert({
      level: 'warn',
      type: 'budget.alert',
      data: { daily_spend: dailySpend, threshold_pct: config.budget.alertAtPct },
    })
  }
}

export async function summarize(
  extract: YoutubeExtract | GithubExtract,
  platform: 'youtube' | 'github',
  jobId: number,
): Promise<SummaryResult> {
  // CRITICAL: LLM 호출 전 비용 가드 체크
  await checkBudget()

  const t0 = Date.now()
  const response = await openai.chat.completions.create({
    model: config.llm.model,
    max_tokens: 2048,
    tools,
    tool_choice: { type: 'function', function: { name: 'save_summary' } },
    messages: [{ role: 'user', content: buildPrompt(extract, platform) }],
  })
  const durationMs = Date.now() - t0

  const toolCall = response.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall) {
    throw new Error('LLM did not call save_summary — unexpected response format')
  }

  const parsed = JSON.parse(toolCall.function.arguments) as {
    title: string
    english_slug: string
    summary: string
    insights: string[]
    tags: string[]
  }

  const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
  const tokensUsed = usage.prompt_tokens + usage.completion_tokens

  // OpenRouter 비용 미반환 → Claude Sonnet 4.6 가격 기준 토큰 추정값
  const costUsd = estimateCostUsd(usage.prompt_tokens, usage.completion_tokens)

  if (tokensUsed > 100_000) {
    const db = createServiceClient()
    await db.from('events').insert({
      level: 'warn',
      type: 'budget.alert',
      data: { job_id: jobId, tokens_used: tokensUsed, reason: 'large token usage for single job' },
    })
  }

  // llm.call 이벤트 기록
  const db = createServiceClient()
  await db.from('events').insert({
    level: 'info',
    type: 'llm.call',
    data: {
      job_id: jobId,
      model: config.llm.model,
      platform,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      duration_ms: durationMs,
    },
  })

  return {
    title: parsed.title,
    summary: parsed.summary,
    insights: parsed.insights,
    tags: parsed.tags,
    englishSlug: parsed.english_slug ?? '',
    tokensUsed,
    costUsd,
  }
}
