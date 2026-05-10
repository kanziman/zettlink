// 환경변수에서 zettlink 데몬·대시보드의 런타임 설정을 읽고 검증한다.
import { z } from 'zod';

const Schema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TELEGRAM_TOKEN: z.string().min(1),
  TELEGRAM_USER_ID: z.string().regex(/^\d+$/, 'TELEGRAM_USER_ID 는 정수 문자열이어야 한다'),
  GITHUB_TOKEN: z.string().min(1),
  REPO_LOCAL_PATH: z.string().min(1),
  CLOUDFLARE_DEPLOY_HOOK_URL: z.string().url(),
  // YouTube 가 IP 단위 429 를 걸 때 yt-dlp 가 로그인된 브라우저 쿠키로 우회하도록 한다. 미설정 시 yt-dlp 는 익명 호출.
  YTDLP_COOKIES_BROWSER: z.enum(['chrome', 'safari', 'firefox', 'edge', 'brave']).optional(),
});

export interface Config {
  openrouterApiKey: string;
  openrouterModel: string;
  openaiApiKey?: string;
  telegram: { token: string; userId: number };
  githubToken: string;
  repoLocalPath: string;
  cloudflareDeployHookUrl: string;
  ytdlpCookiesBrowser?: 'chrome' | 'safari' | 'firefox' | 'edge' | 'brave';
}

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`환경변수 검증 실패. ${missing}`);
  }
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    openrouterModel: e.OPENROUTER_MODEL,
    openaiApiKey: e.OPENAI_API_KEY,
    telegram: { token: e.TELEGRAM_TOKEN, userId: Number(e.TELEGRAM_USER_ID) },
    githubToken: e.GITHUB_TOKEN,
    repoLocalPath: e.REPO_LOCAL_PATH,
    cloudflareDeployHookUrl: e.CLOUDFLARE_DEPLOY_HOOK_URL,
    ytdlpCookiesBrowser: e.YTDLP_COOKIES_BROWSER,
  };
}
