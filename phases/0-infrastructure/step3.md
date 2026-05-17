# Step 3: shared-config

## 읽어야 할 파일

- `CLAUDE.md` — 기술 스택, CRITICAL 규칙
- `docs/ARCHITECTURE.md` — §8(환경 변수 목록), §2(데이터 모델 — Card/Job/Event 필드)
- `docs/ADR.md` — ADR-010(LLM 비용 가드 budget 설정)
- `packages/shared/src/config.ts` — step 2에서 작성한 minimal 버전 (교체 대상)
- `phases/0-infrastructure/index.json` — step 0, 1, 2 summary

## 작업

`packages/shared`에 환경 변수 검증과 공유 타입을 구현하라.

### 생성/수정할 파일

**`packages/shared/src/config.ts`** (step 2의 minimal 버전을 교체)

```typescript
// 환경 변수 로드 및 검증 — zod 기반, 앱 시작 시 유효하지 않으면 즉시 crash
```

zod 스키마로 아래 모든 변수를 검증하라:

```typescript
const schema = z.object({
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
    serviceRoleKey: z.string().min(1),
  }),
  adminUserIds: z.array(z.string().uuid()),  // ADMIN_USER_IDS 콤마 구분 파싱
  telegram: z.object({
    botToken: z.string().min(1),
    whitelist: z.array(z.string()),           // TELEGRAM_WHITELIST 콤마 구분
  }),
  anthropic: z.object({
    apiKey: z.string().min(1),
  }),
  github: z.object({
    token: z.string().optional(),
  }),
  vercel: z.object({
    deploySiteHook: z.string().url().optional(),
    deployDashboardHook: z.string().url().optional(),
  }),
  budget: z.object({
    dailyUsd: z.number().default(5.0),         // BUDGET_DAILY_USD (env에 없으면 5.0)
    perJobUsd: z.number().default(0.5),        // BUDGET_PER_JOB_USD
    alertAtPct: z.number().default(80),        // BUDGET_ALERT_PCT
  }),
})

export const config = schema.parse({ /* process.env에서 파싱 */ })
export type Config = z.infer<typeof schema>
```

**`packages/shared/src/types.ts`**

```typescript
// zettlink 도메인 공유 타입 — DB 스키마와 1:1 대응
```

아래 인터페이스를 export하라:

```typescript
export type Platform = 'youtube' | 'github'
export type CardStatus = 'pending' | 'processing' | 'done' | 'failed'
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'dead'
export type EventLevel = 'info' | 'warn' | 'error'

export interface Card {
  id: string           // slug (PK)
  url: string          // canonical URL
  platform: Platform
  externalId: string   // YouTube video ID 또는 'owner/repo'
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
```

**`packages/shared/src/index.ts`** (없으면 생성)

```typescript
// packages/shared 공개 API
export { config } from './config.js'
export type { Config } from './config.js'
export type { Card, Job, Event, Platform, CardStatus, JobStatus, EventLevel } from './types.js'
```

**`packages/shared/package.json` 업데이트**

dependencies에 `zod: "^3"` 추가.

## Acceptance Criteria

```bash
pnpm --filter @zettlink/shared build   # 컴파일 에러 없음

# 필수 변수 누락 시 crash하는지 확인 (SUPABASE_URL 없이 import)
node -e "import('@zettlink/shared').then(m => m.config)" 2>&1 | grep -i "ZodError\|invalid\|required" && echo "OK: validation works"
```

## 금지사항

- `process.env`를 config.ts 외의 파일에서 직접 읽지 마라. 모든 앱/패키지는 `config` 객체를 import해야 한다.
- `budget` 기본값(5.0 USD)을 변경하지 마라. 운영자 설정은 .env에서 한다.
- types.ts의 인터페이스 필드명을 DB 컬럼명(snake_case)이 아닌 camelCase로 통일하라. DB 매핑은 queries 레이어에서 담당한다.
