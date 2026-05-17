// 환경 변수 로드 및 검증 — zod 기반, 앱 시작 시 유효하지 않으면 즉시 crash
import { z } from 'zod'

const commaSeparated = (val: string | undefined) =>
  val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []

const schema = z.object({
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
    serviceRoleKey: z.string().min(1),
  }),
  adminUserIds: z.array(z.string().uuid()),
  telegram: z.object({
    botToken: z.string().min(1),
    whitelist: z.array(z.string()),
  }),
  anthropic: z.object({
    apiKey: z.string().optional(),
  }),
  openrouter: z.object({
    apiKey: z.string().min(1),
  }),
  llm: z.object({
    model: z.string().default('anthropic/claude-sonnet-4-6'),
  }),
  github: z.object({
    token: z.string().optional(),
  }),
  vercel: z.object({
    deploySiteHook: z.string().url().optional(),
    deployDashboardHook: z.string().url().optional(),
  }),
  budget: z.object({
    dailyUsd: z.number().default(5.0),
    perJobUsd: z.number().default(0.5),
    alertAtPct: z.number().default(80),
  }),
})

export type Config = z.infer<typeof schema>

const parseNumber = (val: string | undefined, fallback: number): number => {
  if (!val) return fallback
  const n = parseFloat(val)
  return isNaN(n) ? fallback : n
}

export const config: Config = schema.parse({
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  adminUserIds: commaSeparated(process.env.ADMIN_USER_IDS),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    whitelist: commaSeparated(process.env.TELEGRAM_WHITELIST),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || undefined,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
  },
  llm: {
    model: process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-4-6',
  },
  github: {
    token: process.env.GITHUB_TOKEN || undefined,
  },
  vercel: {
    deploySiteHook: process.env.VERCEL_DEPLOY_HOOK_SITE || undefined,
    deployDashboardHook: process.env.VERCEL_DEPLOY_HOOK_DASHBOARD || undefined,
  },
  budget: {
    dailyUsd: parseNumber(process.env.BUDGET_DAILY_USD, 5.0),
    perJobUsd: parseNumber(process.env.BUDGET_PER_JOB_USD, 0.5),
    alertAtPct: parseNumber(process.env.BUDGET_ALERT_PCT, 80),
  },
})
