// 환경변수에서 zettlink 데몬·대시보드의 런타임 설정을 읽고 검증한다.
import { z } from 'zod';

const Schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_USER_ID: z.string().regex(/^\d+$/, 'TELEGRAM_USER_ID 는 정수 문자열이어야 한다'),
  GITHUB_TOKEN: z.string().min(1),
  REPO_LOCAL_PATH: z.string().min(1),
  CLOUDFLARE_DEPLOY_HOOK_URL: z.string().url(),
});

export interface Config {
  anthropicApiKey: string;
  openaiApiKey?: string;
  telegram: { botToken: string; userId: number };
  githubToken: string;
  repoLocalPath: string;
  cloudflareDeployHookUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`환경변수 검증 실패. ${missing}`);
  }
  const e = parsed.data;
  return {
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    openaiApiKey: e.OPENAI_API_KEY,
    telegram: { botToken: e.TELEGRAM_BOT_TOKEN, userId: Number(e.TELEGRAM_USER_ID) },
    githubToken: e.GITHUB_TOKEN,
    repoLocalPath: e.REPO_LOCAL_PATH,
    cloudflareDeployHookUrl: e.CLOUDFLARE_DEPLOY_HOOK_URL,
  };
}
