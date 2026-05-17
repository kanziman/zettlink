# Step 4: llm-summarize

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(LLM 호출 전 비용 가드), 기술 스택
- `docs/ARCHITECTURE.md` — §5(관측성 — events 기록 패턴), §4(비용 가드)
- `docs/ADR.md` — ADR-010(비용 가드), ADR-009(관측성)
- `packages/shared/src/config.ts` — config 스키마 (openrouter 섹션 추가 대상)
- `packages/shared/src/index.ts` — config export 확인
- `packages/db/src/index.ts` — createServiceClient
- `apps/worker/src/extractors/youtube.ts` — YoutubeExtract 타입
- `apps/worker/src/extractors/github.ts` — GithubExtract 타입
- `phases/1-capture/index.json` — step 0~3 summary

## 작업

### 1단계: config 스키마 업데이트

`packages/shared/src/config.ts`의 zod 스키마에 `openrouter` 섹션과 `llm` 섹션을 추가하라.

**추가할 스키마 필드:**

```typescript
openrouter: z.object({
  apiKey: z.string().min(1),           // OPENROUTER_API_KEY
}),
llm: z.object({
  model: z.string().default('anthropic/claude-sonnet-4-6'),  // LLM_MODEL
}),
```

**`process.env` 파싱 부분에 추가:**

```typescript
openrouter: {
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
},
llm: {
  model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-4-6',
},
```

기존 `anthropic` 섹션은 유지하되, worker에서는 openrouter를 사용한다.

**`.env.example` 업데이트** — 아래 2개 키 추가:

```env
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-sonnet-4-6
```

### 2단계: summarize.ts 구현

`apps/worker/src/llm/summarize.ts`를 구현하라. OpenRouter API (OpenAI-compatible) + tool_use 구조 출력.

**인터페이스:**

```typescript
export interface SummaryResult {
  title: string
  summary: string           // 한국어 요약 (3~5문장)
  insights: string[]        // 한국어 인사이트 배열 (3~7개)
  tags: string[]            // 영어 소문자 태그 (3~10개)
  tokensUsed: number
  costUsd: number
}

export async function summarize(
  extract: YoutubeExtract | GithubExtract,
  platform: 'youtube' | 'github',
  jobId: number,
): Promise<SummaryResult>
```

**구현 상세:**

1. **비용 가드 체크 (CRITICAL — LLM 호출 전 반드시)**:

```typescript
async function checkBudget(db: SupabaseClient) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await db
    .from('events')
    .select('data')
    .eq('type', 'llm.call')
    .gte('ts', todayStart.toISOString())

  const dailySpend = (data ?? []).reduce((sum, row) => {
    return sum + ((row.data as any)?.cost_usd ?? 0)
  }, 0)

  if (dailySpend >= config.budget.dailyUsd) {
    throw new Error(`daily budget exceeded: $${dailySpend.toFixed(2)} >= $${config.budget.dailyUsd}`)
  }
  if (dailySpend >= config.budget.dailyUsd * config.budget.alertAtPct / 100) {
    await db.from('events').insert({
      level: 'warn', type: 'budget.alert',
      data: { daily_spend: dailySpend, threshold_pct: config.budget.alertAtPct }
    })
  }
}
```

1. **OpenAI SDK + OpenRouter 설정**:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: config.openrouter.apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/zettlink',
    'X-Title': 'zettlink',
  },
})
```

1. **tool_use 스키마 (OpenAI 형식)**:

```typescript
const tools: OpenAI.Chat.ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'save_summary',
    description: '콘텐츠 요약 결과를 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '콘텐츠 제목 (원본 언어)' },
        summary: { type: 'string', description: '한국어 요약 (3~5문장)' },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description: '핵심 인사이트 (한국어, 3~7개)',
          minItems: 3, maxItems: 7,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '영어 소문자 태그 (3~10개)',
          minItems: 3, maxItems: 10,
        },
      },
      required: ['title', 'summary', 'insights', 'tags'],
    },
  },
}]
```

1. **OpenRouter API 호출**:

```typescript
const t0 = Date.now()
const response = await openai.chat.completions.create({
  model: config.llm.model,
  max_tokens: 2048,
  tools,
  tool_choice: { type: 'function', function: { name: 'save_summary' } },
  messages: [{ role: 'user', content: buildPrompt(extract, platform) }],
})
const durationMs = Date.now() - t0
```

1. **tool_use 결과 파싱**:

```typescript
const toolCall = response.choices[0]?.message?.tool_calls?.[0]
if (!toolCall) {
  throw new Error('LLM did not call save_summary — unexpected response format')
}
const parsed = JSON.parse(toolCall.function.arguments) as {
  title: string; summary: string; insights: string[]; tags: string[]
}
```

1. **토큰 & 비용 집계**:

```typescript
const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
const tokensUsed = usage.prompt_tokens + usage.completion_tokens

// OpenRouter는 모델별로 비용이 다름 → 토큰 수만 기록하고 비용은 0으로 초기화
// 실제 비용은 OpenRouter 대시보드에서 확인
const costUsd = 0
```

1. **per_job 토큰 한도 체크** (비용 대신 토큰 기준):

```typescript
// per_job 토큰 초과 시 경고만 (비용 미지원이므로 hard fail 제외)
if (tokensUsed > 100_000) {
  logger.warn({ tokensUsed, jobId }, 'large token usage for single job')
}
```

**`apps/worker/src/llm/prompts.ts`**:

```typescript
export function buildPrompt(
  extract: YoutubeExtract | GithubExtract,
  platform: 'youtube' | 'github',
): string
```

YouTube 프롬프트:

```text
당신은 기술 콘텐츠 큐레이터입니다.
아래 YouTube 영상의 자막과 메타데이터를 분석해 save_summary 도구를 호출하세요.

제목: {title}
설명: {description.slice(0, 500)}
자막 (일부): {transcript.slice(0, 8000)}
```

GitHub 프롬프트:

```text
당신은 기술 콘텐츠 큐레이터입니다.
아래 GitHub 저장소를 분석해 save_summary 도구를 호출하세요.

이름: {fullName}
설명: {description}
주요 언어: {language}
토픽: {topics.join(', ')}
README: {readme.slice(0, 8000)}
```

**`apps/worker/package.json` 업데이트**:

dependencies에 추가:

```json
"openai": "^4"
```

`@anthropic-ai/sdk`는 worker에서 더 이상 필요하지 않으면 제거.

## Acceptance Criteria

```bash
# config 스키마 확인
grep -r "openrouter\|LLM_MODEL" packages/shared/src/config.ts && echo "config OK"

# .env.example 확인
grep "OPENROUTER_API_KEY\|LLM_MODEL" .env.example && echo "env example OK"

# OpenRouter 사용 확인
grep -r "openrouter.ai\|openai.*baseURL" apps/worker/src/llm/summarize.ts && echo "OpenRouter OK"

# 모델 env 변수 사용 확인
grep -r "config.llm.model" apps/worker/src/llm/summarize.ts && echo "model env OK"

# 비용 가드 존재 확인
grep -r "checkBudget\|dailyUsd" apps/worker/src/llm/summarize.ts && echo "budget guard OK"

# 빌드
pnpm --filter @zettlink/shared build
pnpm --filter @zettlink/worker build
```

## 금지사항

- `@anthropic-ai/sdk`를 worker의 summarize.ts에서 import하지 마라. OpenRouter(openai SDK)만.
- `process.env.OPENROUTER_API_KEY`를 직접 읽지 마라. `config.openrouter.apiKey` 사용.
- `config.llm.model`을 하드코딩하지 마라. env 변수로만 주입.
- `checkBudget`을 LLM 호출 후에 실행하지 마라. 반드시 호출 **전** 체크.
- tool_use 응답이 없을 때 빈 객체를 반환하지 마라. throw해서 재시도 플로우가 작동하도록.
