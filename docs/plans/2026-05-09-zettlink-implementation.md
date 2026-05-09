# zettlink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL. Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** YouTube/GitHub URL을 Telegram으로 캡처하면 자동으로 요약·태그·인사이트를 생성하고, 로컬 대시보드에서 심화/TIL/가이드를 수동으로 만들고, 발행 토글로 공개 블로그에 노출하는 1인 지식 관리 도구를 구현한다.

**Architecture.** TypeScript/pnpm 모노레포. `packages/core/` 공유 로직 + `apps/daemon/` Telegram 데몬 + `apps/dashboard/` Next.js 로컬 대시보드 + `apps/blog/` Astro 공개 사이트. 단일 public repo (`owner/zettlink`)에 vault 폴더 + Astro 소스를 합치고, 모든 변경은 `simple-git`으로 commit+push. Cloudflare Pages는 자동 빌드를 끄고 deploy hook으로 수동 트리거한다.

**Tech Stack.** Node 22 LTS, TypeScript strict, pnpm workspace, vitest, Telegraf, yt-dlp (subprocess), `@octokit/rest`, `@anthropic-ai/sdk` (Sonnet 4.6 + prompt caching), `simple-git`, Zod, gray-matter, Next.js 15 App Router, Astro + Pagefind, Tailwind v4 (DESIGN.md 토큰 매핑).

**언어 규약.**
- 본문/요약/주석은 한국어. 산출물도 한국어. 원문(transcript/extract)은 영어 보존.
- 모든 새 소스 파일은 첫 줄에 한국어 1-line 헤더 주석을 둔다. (`// 사용자 인증 상태를 관리하는 ...` 형식)
- Korean output에서 문장 종결자는 `.`, `?`, `!` 만 사용 — `:`로 문장을 끝맺지 않는다.

**디자인 토큰.** DESIGN.md 의 frontmatter (Wanted Montage). 대시보드와 블로그 모두 같은 토큰을 사용한다. Tailwind v4 `@theme`에 매핑.

---

## File Structure

```
zettlink/
├── package.json                 # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .nvmrc                       # 22
├── .env.example
├── .gitignore
├── README.md
├── PLAN.md                       # 기존 — 변경 안 함
├── checklist.md                  # 기존 — Phase 별 진행 체크
├── context-notes.md              # 기존 — 신규 결정 추가 시 append-only
├── DESIGN.md                     # 기존
├── CONTEXT.md                    # 기존
├── docs/
│   ├── adr/0001-two-level-publish-flags.md
│   ├── agents/...
│   ├── design/local-dashboard-ui-ux.md
│   └── plans/2026-05-09-zettlink-implementation.md   # 이 파일
├── vault/                        # 카드 폴더 루트 (첫 카드 생성 시 자동)
│   └── sources/
│       ├── youtube/{date}-{slug}/index.md, transcript.md, ...
│       └── github/{date}-{slug}/index.md, extract.md, ...
├── packages/
│   └── core/
│       ├── src/
│       │   ├── config.ts                # 환경변수 검증
│       │   ├── frontmatter.ts           # 타입 + parse/serialize
│       │   ├── slug.ts                  # URL → slug
│       │   ├── url.ts                   # 정규화 + 플랫폼 감지
│       │   ├── tokens.ts                # 토큰 근사치 + truncation
│       │   ├── tags.ts                  # vocab + 빈도 집계
│       │   ├── llm.ts                   # Anthropic 래퍼 + Zod
│       │   ├── git.ts                   # simple-git 래퍼
│       │   ├── vault.ts                 # 카드 폴더 스캔/쓰기
│       │   ├── prompts/                 # system/user 프롬프트 텍스트
│       │   │   ├── auto-summary.ts
│       │   │   ├── deep.ts
│       │   │   ├── til.ts
│       │   │   └── guide.ts
│       │   └── index.ts                 # public API
│       ├── tests/
│       │   ├── slug.test.ts
│       │   ├── url.test.ts
│       │   ├── tokens.test.ts
│       │   ├── frontmatter.test.ts
│       │   ├── vault.test.ts
│       │   ├── tags.test.ts
│       │   └── llm.test.ts
│       ├── package.json
│       └── tsconfig.json
└── apps/
    ├── daemon/
    │   ├── src/
    │   │   ├── main.ts                  # 엔트리 (Telegraf start)
    │   │   ├── handler.ts               # 메시지 → URL → 라우팅
    │   │   ├── extractors/
    │   │   │   ├── youtube.ts
    │   │   │   ├── youtube-vtt.ts       # VTT 파서
    │   │   │   ├── youtube-whisper.ts
    │   │   │   └── github.ts
    │   │   ├── pipeline.ts              # 추출 → LLM → 파일 → push
    │   │   ├── reply.ts                 # Telegram 답장 헬퍼
    │   │   └── flags.ts                 # +force / +whisper 파싱
    │   ├── tests/
    │   │   ├── flags.test.ts
    │   │   ├── youtube-vtt.test.ts
    │   │   ├── handler.test.ts
    │   │   └── pipeline.test.ts
    │   ├── fixtures/
    │   │   ├── sample-auto.vtt
    │   │   └── sample-manual.vtt
    │   └── package.json
    ├── dashboard/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                 # Review Board
    │   │   ├── cards/[slug]/page.tsx   # Card Detail
    │   │   ├── cards/[slug]/make/page.tsx  # Focused Make Room
    │   │   └── api/
    │   │       ├── reviewed/route.ts
    │   │       ├── publish/route.ts
    │   │       └── generate/route.ts
    │   ├── lib/
    │   │   ├── board.ts                 # 컬럼 우선순위 계산
    │   │   ├── filter.ts                # 검색 + 필터
    │   │   └── guards.ts                # production build 차단
    │   ├── components/
    │   │   ├── BoardColumn.tsx
    │   │   ├── CardChip.tsx
    │   │   ├── ScopeToggle.tsx
    │   │   ├── FilterBar.tsx
    │   │   ├── CardDetailPanel.tsx
    │   │   └── MakeRoomPanel.tsx
    │   ├── tests/
    │   │   ├── board.test.ts
    │   │   ├── filter.test.ts
    │   │   └── guards.test.ts
    │   ├── tailwind.config.ts           # DESIGN.md 토큰 매핑
    │   ├── app/globals.css              # @theme + Wanted Sans
    │   └── package.json
    └── blog/
        ├── src/
        │   ├── content.config.ts        # Astro content collection
        │   ├── pages/
        │   │   ├── index.astro          # 카드 리스트
        │   │   ├── cards/[slug].astro
        │   │   └── tags/[tag].astro
        │   └── components/
        ├── astro.config.mjs
        ├── tests/published-filter.test.ts
        └── package.json
```

**파일 책임 원칙.**
- `packages/core/` 는 외부 SDK·subprocess 호출 없는 순수 로직 (parser, validator, prompt) + 한 겹 래퍼만. 주입 가능한 의존성으로 testability 확보.
- 외부 호출(Telegram, yt-dlp, Anthropic, octokit, git)은 `apps/daemon/` 혹은 dashboard API route에서. core는 호출 가능한 함수만 제공.
- dashboard의 `lib/`는 server-only 헬퍼 (RSC + API route에서 import). 컴포넌트는 표시 전담.
- blog는 빌드 타임 정적 변환만. dashboard 의존성 없음.

---

## Frontmatter 스키마 (Day 1 확정)

`index.md` (카드 요약본):

```yaml
---
url: https://www.youtube.com/watch?v=abc123
platform: youtube                 # youtube | github
slug: how-claude-code-uses-tools
captured_at: 2026-05-09T12:34:56Z
title: "How Claude Code uses tools"
summary_one_line: "Claude Code의 tool 호출 모델과 권한 구조."
tags: [claude, agents, productivity]
status: extracted                 # extracted | summarized | failed
reviewed: false                   # 사용자 검토 완료 여부 (대시보드 토글)
published: false                  # 카드 요약본 발행 (요약본만 공개)
note: ""                          # Telegram 메시지의 URL 외 텍스트 (B3)
generated:                        # 산출물 존재 추적
  deep: false
  til: false
  guide: false
llm:
  model: claude-sonnet-4-6
  truncated: false
youtube:                          # platform=youtube 일 때만
  video_id: abc123
  channel: "Anthropic"
  duration_sec: 723
  thumbnail: https://i.ytimg.com/vi/abc123/maxresdefault.jpg
  subtitle_source: auto           # auto | manual | whisper | none
github:                           # platform=github 일 때만
  owner: anthropics
  repo: claude-code
  stars: 12345
  primary_language: TypeScript
  topics: [agents, llm]
---
```

`deep.md` / `til.md` / `guide.md` (산출물 — 각자 독립 발행):

```yaml
---
generated_at: 2026-05-09T13:00:00Z
published: false                  # 산출물 개별 발행 (ADR 0001)
llm:
  model: claude-sonnet-4-6
---
```

**`note` 보안.** 빌드 시 blog는 `note`를 무조건 제외 (사용자가 비공개 메모를 적었을 가능성).
**컬럼 정합성.** `published` 또는 산출물 `published` 중 하나라도 true → `Published`. 그 외에는 우선순위 (Phase 3에서 코드로 명세).

---

## Phase 0 — 모노레포 셋업

이 단계는 logic-light boilerplate라 step 단위 테스트 없이 묶어서 진행한다. 단, 각 task 끝에서 빌드/타입체크가 통과하는지 확인.

### Task 0.1: pnpm workspace 초기화

**Files.**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Modify: 없음

- [ ] **Step 1: `.nvmrc` 작성**

```
22
```

- [ ] **Step 2: `package.json` (workspace root)**

```json
{
  "name": "zettlink",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "daemon": "pnpm --filter @zettlink/daemon start",
    "dashboard": "pnpm --filter @zettlink/dashboard dev",
    "blog": "pnpm --filter @zettlink/blog dev",
    "blog:build": "pnpm --filter @zettlink/blog build",
    "deploy": "node scripts/deploy.mjs",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 3: `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 4: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM"]
  }
}
```

- [ ] **Step 5: `.gitignore`**

```
node_modules
dist
.env
.env.local
.next
.astro
.cache
.DS_Store
vault/                # 로컬 vault 경로(REPO_LOCAL_PATH)는 별도 repo
```

- [ ] **Step 6: `.env.example`**

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_USER_ID=
GITHUB_TOKEN=
REPO_LOCAL_PATH=/absolute/path/to/zettlink-vault-checkout
CLOUDFLARE_DEPLOY_HOOK_URL=
```

- [ ] **Step 7: 빌드 확인 + 커밋**

```bash
pnpm install
git add package.json pnpm-workspace.yaml .nvmrc tsconfig.base.json .gitignore .env.example
git commit -m "chore: pnpm workspace 모노레포 초기화"
```

Expected. `pnpm install` 이 0개 dep 으로 통과.

### Task 0.2: 단일 public vault repo 준비 (수동 절차 + 스크립트 1개)

**Files.**
- Create: `scripts/deploy.mjs`

이 task의 1~3 step은 사용자가 수동으로 한 번 하는 인프라 셋업이다. plan 실행자(에이전트)는 사용자에게 명시적으로 요청한 뒤 step 4 부터 진행.

- [ ] **Step 1 (사용자):** GitHub에 `<owner>/zettlink` public repo 생성, 빈 main 브랜치 push.
- [ ] **Step 2 (사용자):** 로컬 어딘가에 `git clone` 후 `REPO_LOCAL_PATH` 에 절대 경로 기록.
- [ ] **Step 3 (사용자):** Cloudflare Pages 에서 위 repo 연결 → Build 설정 = "Pause deployments" 체크 → Deploy hook 발급 → URL 을 `CLOUDFLARE_DEPLOY_HOOK_URL` 에 기록.
- [ ] **Step 4: 배포 트리거 스크립트**

```js
// scripts/deploy.mjs
// Cloudflare Pages deploy hook을 POST로 트리거하는 한 줄짜리 수동 배포 스크립트.
import process from 'node:process';

const url = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;
if (!url) {
  console.error('CLOUDFLARE_DEPLOY_HOOK_URL 미설정. .env 확인.');
  process.exit(1);
}
const res = await fetch(url, { method: 'POST' });
if (!res.ok) {
  console.error(`배포 트리거 실패. status=${res.status}`);
  process.exit(1);
}
console.log('배포 트리거 성공. Cloudflare Pages 대시보드에서 진행 상황 확인.');
```

- [ ] **Step 5: 커밋**

```bash
git add scripts/deploy.mjs
git commit -m "chore: pnpm deploy 스크립트 (Cloudflare deploy hook)"
```

---

## Phase 1 — packages/core (공유 패키지)

다른 앱이 모두 의존하는 핵심. 외부 호출 없는 순수 로직 위주라 strict TDD.

### Task 1.1: 패키지 골격 + vitest 셋업

**Files.**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`

- [ ] **Step 1: `packages/core/package.json`**

```json
{
  "name": "@zettlink/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "gray-matter": "^4.0.3",
    "simple-git": "^3.25.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src" },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: `vitest.config.ts`**

```ts
// 공유 패키지 단위 테스트 설정.
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: false, environment: 'node' } });
```

- [ ] **Step 4: 빈 `src/index.ts`**

```ts
// 공유 패키지의 public re-export 진입점. 모듈을 추가할 때마다 여기서 export 한다.
export {};
```

- [ ] **Step 5: install + 커밋**

```bash
pnpm install
git add packages/core
git commit -m "chore(core): @zettlink/core 패키지 골격 + vitest"
```

### Task 1.2: `config.ts` — 환경변수 검증 (TDD)

**Files.**
- Create: `packages/core/src/config.ts`, `packages/core/tests/config.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// packages/core/tests/config.test.ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const baseEnv = {
  ANTHROPIC_API_KEY: 'sk-ant-x',
  TELEGRAM_BOT_TOKEN: 'token',
  TELEGRAM_USER_ID: '12345',
  GITHUB_TOKEN: 'ghp_x',
  REPO_LOCAL_PATH: '/tmp/zettlink',
  CLOUDFLARE_DEPLOY_HOOK_URL: 'https://api.cloudflare.com/x',
};

describe('loadConfig', () => {
  it('필수 키가 모두 있으면 정상 객체를 반환한다', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.telegram.userId).toBe(12345);
    expect(cfg.openaiApiKey).toBeUndefined();
  });

  it('필수 키가 빠지면 throw 한다', () => {
    const env = { ...baseEnv, TELEGRAM_BOT_TOKEN: '' };
    expect(() => loadConfig(env)).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('TELEGRAM_USER_ID가 정수가 아니면 throw 한다', () => {
    const env = { ...baseEnv, TELEGRAM_USER_ID: 'abc' };
    expect(() => loadConfig(env)).toThrow(/TELEGRAM_USER_ID/);
  });

  it('OPENAI_API_KEY는 선택값이며 없으면 undefined 다', () => {
    expect(loadConfig(baseEnv).openaiApiKey).toBeUndefined();
    expect(loadConfig({ ...baseEnv, OPENAI_API_KEY: 'sk-x' }).openaiApiKey).toBe('sk-x');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run. `pnpm --filter @zettlink/core test`
Expected. FAIL — `loadConfig` 미구현.

- [ ] **Step 3: 최소 구현**

```ts
// packages/core/src/config.ts
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
```

- [ ] **Step 4: 통과 확인**

Run. `pnpm --filter @zettlink/core test`
Expected. PASS — 4개 테스트 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/config.ts packages/core/tests/config.test.ts
git commit -m "feat(core): config 환경변수 검증 (Zod)"
```

### Task 1.3: `url.ts` — URL 정규화 + 플랫폼 감지 (TDD)

**Files.**
- Create: `packages/core/src/url.ts`, `packages/core/tests/url.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// packages/core/tests/url.test.ts
import { describe, it, expect } from 'vitest';
import { detectPlatform, normalizeUrl } from '../src/url.js';

describe('detectPlatform', () => {
  it('youtube.com/watch URL은 youtube 다', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
  });
  it('youtu.be 단축 URL도 youtube 다', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
  });
  it('github.com/owner/repo 는 github 다', () => {
    expect(detectPlatform('https://github.com/anthropics/claude-code')).toBe('github');
  });
  it('지원 안 하는 URL은 null 이다', () => {
    expect(detectPlatform('https://example.com/x')).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('youtube watch URL은 video_id 표준 형태로 정규화', () => {
    const u = normalizeUrl('https://www.youtube.com/watch?v=abc123&t=42');
    expect(u).toEqual({ platform: 'youtube', videoId: 'abc123', canonical: 'https://www.youtube.com/watch?v=abc123' });
  });
  it('youtu.be 단축 URL도 video_id 표준 형태로', () => {
    const u = normalizeUrl('https://youtu.be/abc123?si=foo');
    expect(u).toEqual({ platform: 'youtube', videoId: 'abc123', canonical: 'https://www.youtube.com/watch?v=abc123' });
  });
  it('github URL은 owner/repo 로 정규화 (트레일링 슬래시·서브패스 제거)', () => {
    const u = normalizeUrl('https://github.com/anthropics/claude-code/blob/main/README.md');
    expect(u).toEqual({ platform: 'github', owner: 'anthropics', repo: 'claude-code', canonical: 'https://github.com/anthropics/claude-code' });
  });
  it('미지원 URL은 null 이다', () => {
    expect(normalizeUrl('https://example.com/')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run. `pnpm --filter @zettlink/core test url`
Expected. FAIL.

- [ ] **Step 3: 구현**

```ts
// packages/core/src/url.ts
// URL 의 플랫폼을 감지하고 중복 검사용 표준 형태로 정규화한다.
export type Platform = 'youtube' | 'github';

export type NormalizedUrl =
  | { platform: 'youtube'; videoId: string; canonical: string }
  | { platform: 'github'; owner: string; repo: string; canonical: string };

const YT_LONG = /^https?:\/\/(www\.)?youtube\.com\/watch\?/;
const YT_SHORT = /^https?:\/\/youtu\.be\//;
const GH = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/;

export function detectPlatform(url: string): Platform | null {
  if (YT_LONG.test(url) || YT_SHORT.test(url)) return 'youtube';
  if (GH.test(url)) return 'github';
  return null;
}

export function normalizeUrl(url: string): NormalizedUrl | null {
  const platform = detectPlatform(url);
  if (platform === 'youtube') {
    let videoId: string | null = null;
    if (YT_LONG.test(url)) {
      videoId = new URL(url).searchParams.get('v');
    } else {
      const m = url.match(/youtu\.be\/([^?#/]+)/);
      videoId = m?.[1] ?? null;
    }
    if (!videoId) return null;
    return { platform: 'youtube', videoId, canonical: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (platform === 'github') {
    const m = url.match(GH);
    if (!m) return null;
    const [, owner, repo] = m;
    return { platform: 'github', owner: owner!, repo: repo!, canonical: `https://github.com/${owner}/${repo}` };
  }
  return null;
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
pnpm --filter @zettlink/core test url
git add packages/core/src/url.ts packages/core/tests/url.test.ts
git commit -m "feat(core): URL 정규화 + 플랫폼 감지"
```

### Task 1.4: `slug.ts` — slug 생성 (TDD)

**Files.**
- Create: `packages/core/src/slug.ts`, `packages/core/tests/slug.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/slug.test.ts
import { describe, it, expect } from 'vitest';
import { youtubeTitleSlug, githubSlug, datedFolder } from '../src/slug.js';

describe('youtubeTitleSlug', () => {
  it('영어 제목을 소문자 + 하이픈으로 변환한다', () => {
    expect(youtubeTitleSlug('How Claude Code Uses Tools')).toBe('how-claude-code-uses-tools');
  });
  it('특수문자는 제거하고 단어 사이만 하이픈으로 묶는다', () => {
    expect(youtubeTitleSlug('AI / Agents: 2026 outlook!')).toBe('ai-agents-2026-outlook');
  });
  it('한글이 섞이면 영문 부분만 남긴다 (LLM 변환 위치는 호출자)', () => {
    expect(youtubeTitleSlug('Claude Code 한국어 시연')).toBe('claude-code');
  });
  it('60자를 초과하면 60자로 자르고 끝의 하이픈을 제거한다', () => {
    const long = 'a'.repeat(70);
    expect(youtubeTitleSlug(long).length).toBeLessThanOrEqual(60);
  });
  it('빈 입력은 fallback-slug 를 반환한다', () => {
    expect(youtubeTitleSlug('')).toBe('untitled');
  });
});

describe('githubSlug', () => {
  it('owner/repo 를 owner-repo 로 변환한다', () => {
    expect(githubSlug('anthropics', 'claude-code')).toBe('anthropics-claude-code');
  });
  it('repo 안의 점·언더바도 그대로 유지한다', () => {
    expect(githubSlug('foo', 'bar.baz_qux')).toBe('foo-bar.baz_qux');
  });
});

describe('datedFolder', () => {
  it('YYYY-MM-DD-{slug} 형태로 만든다', () => {
    expect(datedFolder('2026-05-09', 'hello')).toBe('2026-05-09-hello');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run. `pnpm --filter @zettlink/core test slug`
Expected. FAIL.

- [ ] **Step 3: 구현**

```ts
// packages/core/src/slug.ts
// 카드 폴더명에 사용할 영문 slug 를 만든다. 한글 변환 라이브러리는 의도적으로 사용하지 않는다.
export function youtubeTitleSlug(title: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]+/g, ' ')   // 비ASCII 제거 (한글 등)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return ascii || 'untitled';
}

export function githubSlug(owner: string, repo: string): string {
  return `${owner.toLowerCase()}-${repo.toLowerCase()}`;
}

export function datedFolder(dateYmd: string, slug: string): string {
  return `${dateYmd}-${slug}`;
}
```

- [ ] **Step 4: 통과 + 커밋**

```bash
pnpm --filter @zettlink/core test slug
git add packages/core/src/slug.ts packages/core/tests/slug.test.ts
git commit -m "feat(core): slug 생성기 (YouTube 제목 / GitHub owner-repo)"
```

### Task 1.5: `tokens.ts` — 토큰 근사치 + truncation (TDD)

**Files.**
- Create: `packages/core/src/tokens.ts`, `packages/core/tests/tokens.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { approxTokens, headTailTruncate } from '../src/tokens.js';

describe('approxTokens', () => {
  it('text.length / 4 의 ceil 값이다', () => {
    expect(approxTokens('a'.repeat(8))).toBe(2);
    expect(approxTokens('a'.repeat(9))).toBe(3);
    expect(approxTokens('')).toBe(0);
  });
});

describe('headTailTruncate', () => {
  it('limit 이하면 원문을 그대로 반환하고 truncated=false', () => {
    const r = headTailTruncate('hello world', 100);
    expect(r).toEqual({ text: 'hello world', truncated: false });
  });
  it('limit 초과면 head + sep + tail 형태로 자르고 truncated=true', () => {
    const text = 'a'.repeat(40000);   // ~10000 토큰
    const r = headTailTruncate(text, 6000);   // 토큰 단위 임계
    expect(r.truncated).toBe(true);
    expect(r.text).toContain('...[truncated]...');
    expect(approxTokens(r.text)).toBeLessThanOrEqual(6000 + 10);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run. `pnpm --filter @zettlink/core test tokens`
Expected. FAIL.

- [ ] **Step 3: 구현**

```ts
// packages/core/src/tokens.ts
// 토큰을 글자 수로 근사하고, transcript 가 너무 길 때 head + tail 만 남기는 유틸.
const SEP = '\n\n...[truncated]...\n\n';
const TOKENS_PER_CHAR = 1 / 4;

export function approxTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

export function headTailTruncate(text: string, tokenLimit: number): { text: string; truncated: boolean } {
  if (approxTokens(text) <= tokenLimit) return { text, truncated: false };
  const halfTokens = Math.floor((tokenLimit - approxTokens(SEP)) / 2);
  const halfChars = halfTokens * 4;
  const head = text.slice(0, halfChars);
  const tail = text.slice(-halfChars);
  return { text: head + SEP + tail, truncated: true };
}
```

- [ ] **Step 4: 통과 + 커밋**

```bash
pnpm --filter @zettlink/core test tokens
git add packages/core/src/tokens.ts packages/core/tests/tokens.test.ts
git commit -m "feat(core): 토큰 근사치 + head/tail truncation"
```

### Task 1.6: `frontmatter.ts` — 타입 + parse/serialize (TDD)

**Files.**
- Create: `packages/core/src/frontmatter.ts`, `packages/core/tests/frontmatter.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/frontmatter.test.ts
import { describe, it, expect } from 'vitest';
import { parseIndex, serializeIndex, type IndexFrontmatter } from '../src/frontmatter.js';

const sample: IndexFrontmatter = {
  url: 'https://www.youtube.com/watch?v=abc',
  platform: 'youtube',
  slug: 'how-claude-code-uses-tools',
  captured_at: '2026-05-09T12:00:00Z',
  title: 'How Claude Code Uses Tools',
  summary_one_line: 'Tool calling 모델 정리.',
  tags: ['claude', 'agents'],
  status: 'summarized',
  reviewed: false,
  published: false,
  note: '',
  generated: { deep: false, til: false, guide: false },
  llm: { model: 'claude-sonnet-4-6', truncated: false },
  youtube: {
    video_id: 'abc',
    channel: 'Anthropic',
    duration_sec: 120,
    thumbnail: 'https://i.ytimg.com/vi/abc/maxres.jpg',
    subtitle_source: 'auto',
  },
};

describe('serialize/parse round trip', () => {
  it('serialize → parse 후 동일한 객체가 복원된다', () => {
    const md = serializeIndex(sample, '본문 요약 텍스트');
    const { frontmatter, body } = parseIndex(md);
    expect(frontmatter).toEqual(sample);
    expect(body.trim()).toBe('본문 요약 텍스트');
  });

  it('platform=github 카드는 youtube 키를 포함하지 않는다', () => {
    const gh: IndexFrontmatter = {
      ...sample,
      platform: 'github',
      youtube: undefined,
      github: { owner: 'a', repo: 'b', stars: 10, primary_language: 'TS', topics: ['x'] },
    };
    const md = serializeIndex(gh, '');
    expect(md).not.toMatch(/^youtube:/m);
    expect(md).toMatch(/^github:/m);
  });

  it('알 수 없는 키가 있으면 throw 한다', () => {
    const md = '---\nplatform: weird\n---\n';
    expect(() => parseIndex(md)).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run. `pnpm --filter @zettlink/core test frontmatter`
Expected. FAIL.

- [ ] **Step 3: 구현**

```ts
// packages/core/src/frontmatter.ts
// 카드(`index.md`) 의 frontmatter 타입과 parse/serialize 헬퍼. Zod 로 스키마를 강제한다.
import matter from 'gray-matter';
import { z } from 'zod';

const YoutubeMeta = z.object({
  video_id: z.string(),
  channel: z.string(),
  duration_sec: z.number().int(),
  thumbnail: z.string().url(),
  subtitle_source: z.enum(['auto', 'manual', 'whisper', 'none']),
});
const GithubMeta = z.object({
  owner: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  primary_language: z.string(),
  topics: z.array(z.string()),
});

const IndexSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['youtube', 'github']),
  slug: z.string().min(1),
  captured_at: z.string().datetime(),
  title: z.string(),
  summary_one_line: z.string(),
  tags: z.array(z.string()),
  status: z.enum(['extracted', 'summarized', 'failed']),
  reviewed: z.boolean(),
  published: z.boolean(),
  note: z.string().default(''),
  generated: z.object({ deep: z.boolean(), til: z.boolean(), guide: z.boolean() }),
  llm: z.object({ model: z.string(), truncated: z.boolean() }),
  youtube: YoutubeMeta.optional(),
  github: GithubMeta.optional(),
});

export type IndexFrontmatter = z.infer<typeof IndexSchema>;

export function parseIndex(markdown: string): { frontmatter: IndexFrontmatter; body: string } {
  const { data, content } = matter(markdown);
  const parsed = IndexSchema.parse(data);
  return { frontmatter: parsed, body: content };
}

export function serializeIndex(fm: IndexFrontmatter, body: string): string {
  IndexSchema.parse(fm);
  const cleaned: Record<string, unknown> = { ...fm };
  if (fm.platform === 'youtube') delete cleaned.github;
  if (fm.platform === 'github') delete cleaned.youtube;
  return matter.stringify(body, cleaned);
}

// 산출물(`deep.md` / `til.md` / `guide.md`) 의 frontmatter — ADR 0001 의 2-레벨 발행 플래그.
export const ArtifactSchema = z.object({
  generated_at: z.string().datetime(),
  published: z.boolean(),
  llm: z.object({ model: z.string() }),
});
export type ArtifactFrontmatter = z.infer<typeof ArtifactSchema>;

export function parseArtifact(markdown: string): { frontmatter: ArtifactFrontmatter; body: string } {
  const { data, content } = matter(markdown);
  return { frontmatter: ArtifactSchema.parse(data), body: content };
}
export function serializeArtifact(fm: ArtifactFrontmatter, body: string): string {
  ArtifactSchema.parse(fm);
  return matter.stringify(body, fm);
}
```

- [ ] **Step 4: 통과 + 커밋**

```bash
pnpm --filter @zettlink/core test frontmatter
git add packages/core/src/frontmatter.ts packages/core/tests/frontmatter.test.ts
git commit -m "feat(core): index/artifact frontmatter 스키마 + Zod 검증"
```

### Task 1.7: `tags.ts` — 시드 vocab + 빈도 집계 (TDD)

**Files.**
- Create: `packages/core/src/tags.ts`, `packages/core/tests/tags.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/tags.test.ts
import { describe, it, expect } from 'vitest';
import { SEED_VOCAB, computeTagFrequency, formatTagHints } from '../src/tags.js';

describe('SEED_VOCAB', () => {
  it('초기 5개 시드 태그를 포함한다', () => {
    expect(SEED_VOCAB).toEqual(['ai', 'agents', 'claude', 'codex', 'productivity']);
  });
});

describe('computeTagFrequency', () => {
  it('카드 frontmatter 배열에서 태그 빈도를 집계한다', () => {
    const cards = [{ tags: ['ai', 'claude'] }, { tags: ['ai', 'agents'] }];
    expect(computeTagFrequency(cards)).toEqual({ ai: 2, claude: 1, agents: 1 });
  });
});

describe('formatTagHints', () => {
  it('빈도 내림차순으로 시드 + 기존 태그를 합쳐 system prompt 문자열을 만든다', () => {
    const hint = formatTagHints({ ai: 5, agents: 3 });
    expect(hint).toContain('ai (5)');
    expect(hint).toContain('agents (3)');
    expect(hint).toContain('claude');   // seed 도 포함
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현 → 통과 → 커밋**

```ts
// packages/core/src/tags.ts
// 태그 vocabulary 의 시드와 기존 vault 태그 빈도 집계, LLM system prompt 주입용 포맷터.
export const SEED_VOCAB = ['ai', 'agents', 'claude', 'codex', 'productivity'] as const;

export function computeTagFrequency(cards: Array<{ tags: string[] }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) for (const t of c.tags) out[t] = (out[t] ?? 0) + 1;
  return out;
}

export function formatTagHints(frequency: Record<string, number>): string {
  const merged: Record<string, number> = { ...frequency };
  for (const s of SEED_VOCAB) merged[s] ??= 0;
  const sorted = Object.entries(merged).sort((a, b) => b[1] - a[1]);
  const lines = sorted.map(([t, n]) => `- ${t} (${n})`);
  return `기존 vault 에서 사용된 태그 (괄호 안은 빈도)\n${lines.join('\n')}\n\n새 태그가 필요한 경우에만 추가하라.`;
}
```

```bash
pnpm --filter @zettlink/core test tags
git add packages/core/src/tags.ts packages/core/tests/tags.test.ts
git commit -m "feat(core): 태그 시드 vocab + 빈도 집계"
```

### Task 1.8: `vault.ts` — 카드 폴더 스캔 + 쓰기 (TDD, tmp dir 사용)

**Files.**
- Create: `packages/core/src/vault.ts`, `packages/core/tests/vault.test.ts`

핵심. dashboard 가 카드 리스트를 빌드할 때 사용하는 함수. 테스트에서는 `node:fs/promises` + `os.tmpdir()` 로 임시 vault 를 만들어 검증.

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/vault.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCards, cardFolderExists, writeCard, readCard } from '../src/vault.js';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'zettlink-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const baseFm = {
  url: 'https://www.youtube.com/watch?v=abc',
  platform: 'youtube' as const,
  slug: 'sample',
  captured_at: '2026-05-09T12:00:00Z',
  title: 't',
  summary_one_line: 's',
  tags: ['ai'],
  status: 'summarized' as const,
  reviewed: false,
  published: false,
  note: '',
  generated: { deep: false, til: false, guide: false },
  llm: { model: 'claude-sonnet-4-6', truncated: false },
  youtube: {
    video_id: 'abc',
    channel: 'C',
    duration_sec: 60,
    thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
    subtitle_source: 'auto' as const,
  },
};

describe('vault', () => {
  it('writeCard 후 cardFolderExists 가 true 이고 readCard 가 같은 frontmatter 를 돌려준다', async () => {
    await writeCard(root, baseFm, '본문');
    expect(await cardFolderExists(root, 'youtube', 'sample', '2026-05-09')).toBe(true);
    const got = await readCard(root, 'youtube', '2026-05-09-sample');
    expect(got.frontmatter.slug).toBe('sample');
  });

  it('listCards 는 모든 플랫폼 폴더의 index.md 를 카드로 반환한다', async () => {
    await writeCard(root, baseFm, '');
    await writeCard(root, { ...baseFm, slug: 'second' }, '');
    const cards = await listCards(root);
    expect(cards).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현 → 통과 → 커밋**

```ts
// packages/core/src/vault.ts
// 카드 폴더(`vault/sources/{platform}/{date}-{slug}/`) 스캔·읽기·쓰기.
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { type IndexFrontmatter, parseIndex, serializeIndex } from './frontmatter.js';

const SOURCES = 'sources';

function ymd(iso: string): string { return iso.slice(0, 10); }
function folderName(fm: IndexFrontmatter): string { return `${ymd(fm.captured_at)}-${fm.slug}`; }
function cardDir(root: string, platform: string, folder: string): string {
  return join(root, SOURCES, platform, folder);
}

export async function cardFolderExists(root: string, platform: string, slug: string, date?: string): Promise<boolean> {
  // 빠른 경로. date 가 있으면 정확 경로, 없으면 platform 디렉토리에서 -{slug} suffix 탐색.
  if (date) return existsSync(cardDir(root, platform, `${date}-${slug}`));
  const dir = join(root, SOURCES, platform);
  if (!existsSync(dir)) return false;
  const entries = await readdir(dir);
  return entries.some((e) => e.endsWith(`-${slug}`));
}

export async function writeCard(root: string, fm: IndexFrontmatter, body: string): Promise<string> {
  const folder = folderName(fm);
  const dir = cardDir(root, fm.platform, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.md'), serializeIndex(fm, body), 'utf8');
  return dir;
}

export async function readCard(root: string, platform: string, folder: string): Promise<{ frontmatter: IndexFrontmatter; body: string; dir: string }> {
  const dir = cardDir(root, platform, folder);
  const md = await readFile(join(dir, 'index.md'), 'utf8');
  const { frontmatter, body } = parseIndex(md);
  return { frontmatter, body, dir };
}

export async function listCards(root: string): Promise<Array<{ frontmatter: IndexFrontmatter; dir: string }>> {
  const out: Array<{ frontmatter: IndexFrontmatter; dir: string }> = [];
  const sourcesDir = join(root, SOURCES);
  if (!existsSync(sourcesDir)) return out;
  for (const platform of await readdir(sourcesDir)) {
    const platformDir = join(sourcesDir, platform);
    for (const folder of await readdir(platformDir)) {
      const indexPath = join(platformDir, folder, 'index.md');
      if (!existsSync(indexPath)) continue;
      const md = await readFile(indexPath, 'utf8');
      try {
        const { frontmatter } = parseIndex(md);
        out.push({ frontmatter, dir: join(platformDir, folder) });
      } catch {
        // malformed card 는 스킵 — 대시보드에서 별도 표시.
      }
    }
  }
  return out;
}
```

```bash
pnpm --filter @zettlink/core test vault
git add packages/core/src/vault.ts packages/core/tests/vault.test.ts
git commit -m "feat(core): vault 폴더 스캔/읽기/쓰기"
```

### Task 1.9: `git.ts` — simple-git 래퍼 (mock TDD)

**Files.**
- Create: `packages/core/src/git.ts`, `packages/core/tests/git.test.ts`

- [ ] **Step 1: 실패 테스트 (`simple-git` mock)**

```ts
// packages/core/tests/git.test.ts
import { describe, it, expect, vi } from 'vitest';
import { commitAndPushWithRetry } from '../src/git.js';

describe('commitAndPushWithRetry', () => {
  it('첫 push 성공 시 1번만 호출한다', async () => {
    const git = { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) };
    await commitAndPushWithRetry(git as any, ['a.md'], 'm');
    expect(git.push).toHaveBeenCalledTimes(1);
  });

  it('push 실패 시 5초 간격(테스트는 0ms)으로 2회 재시도한 후 throw 한다', async () => {
    const git = {
      add: vi.fn().mockResolvedValue({}),
      commit: vi.fn().mockResolvedValue({}),
      push: vi.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(commitAndPushWithRetry(git as any, ['a.md'], 'm', { delayMs: 0 })).rejects.toThrow();
    expect(git.push).toHaveBeenCalledTimes(3);   // 첫 시도 + 재시도 2번
  });

  it('재시도 중 성공하면 throw 하지 않는다', async () => {
    const push = vi.fn().mockRejectedValueOnce(new Error('first')).mockResolvedValue({});
    const git = { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push };
    await commitAndPushWithRetry(git as any, ['a.md'], 'm', { delayMs: 0 });
    expect(push).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2 → 4: 실패 확인, 구현, 통과 + 커밋**

```ts
// packages/core/src/git.ts
// REPO_LOCAL_PATH 의 단일 repo 에 카드를 commit + push 한다. 실패 시 in-memory 2 회 재시도.
import simpleGit, { type SimpleGit } from 'simple-git';

export function openRepo(path: string): SimpleGit { return simpleGit(path); }

export async function commitAndPushWithRetry(
  git: SimpleGit,
  files: string[],
  message: string,
  options: { delayMs?: number } = {},
): Promise<void> {
  await git.add(files);
  await git.commit(message);
  const delay = options.delayMs ?? 5000;
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try { await git.push(); return; } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`git push 3 회 시도 실패. ${(lastErr as Error)?.message ?? lastErr}`);
}
```

```bash
pnpm --filter @zettlink/core test git
git add packages/core/src/git.ts packages/core/tests/git.test.ts
git commit -m "feat(core): commit + push 재시도 헬퍼"
```

### Task 1.10: `llm.ts` — Anthropic 래퍼 (Sonnet 4.6 + prompt caching)

**Files.**
- Create: `packages/core/src/llm.ts`, `packages/core/src/prompts/auto-summary.ts`, `packages/core/tests/llm.test.ts`

claude-api 스킬의 캐싱 가이드를 따른다. system block 에 `cache_control: { type: 'ephemeral' }` 을 둔다. SDK 모킹으로 테스트.

- [ ] **Step 1: 실패 테스트**

```ts
// packages/core/tests/llm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runAutoSummary, AutoSummaryResultSchema } from '../src/llm.js';

describe('runAutoSummary', () => {
  it('Anthropic 응답을 Zod 로 검증해 정상 객체를 돌려준다', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            title: 'T', slug: 't', summary_one_line: 'S', summary_body: 'B',
            insights: ['i1'], tags: ['ai'],
          }) }],
        }),
      },
    };
    const r = await runAutoSummary(fakeClient as any, {
      transcript: 'hello',
      tagHints: '',
      truncated: false,
      modelId: 'claude-sonnet-4-6',
    });
    expect(AutoSummaryResultSchema.parse(r)).toBeTruthy();
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
  });

  it('JSON parse 실패 시 1회 재시도한 후 throw 한다', async () => {
    const create = vi.fn().mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'still not' }] });
    const fakeClient = { messages: { create } };
    await expect(runAutoSummary(fakeClient as any, {
      transcript: 'hello', tagHints: '', truncated: false, modelId: 'claude-sonnet-4-6',
    })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2 → 4: 실패 확인, 구현, 통과 + 커밋**

```ts
// packages/core/src/prompts/auto-summary.ts
// 자동 요약 단계 system / user 프롬프트. system 은 cacheable 한 정적 콘텐츠.
export const AUTO_SUMMARY_SYSTEM = `당신은 한국어 지식 요약 전문가다. 영어 원문을 읽고 한국어 요약본·인사이트·태그를 생성한다.

규칙.
- 출력은 반드시 유효한 JSON 한 덩어리만. 다른 텍스트는 포함하지 않는다.
- 요약본 본문은 4 ~ 8 단락, 각 단락 2 ~ 4 문장.
- 인사이트는 3 ~ 6 개, 한 문장씩.
- 태그는 영문 소문자 + 하이픈, 카드당 3 ~ 7 개, 한국어 금지.
- slug 는 영문 소문자 + 하이픈, 60 자 이하, 의미 기반 영문 변환.
- 한국어 문장은 마침표·물음표·느낌표로 끝낸다. 콜론으로 끝맺지 않는다.

출력 스키마.
{
  "title": string,
  "slug": string,
  "summary_one_line": string,
  "summary_body": string (markdown),
  "insights": string[],
  "tags": string[]
}`;

export function buildAutoSummaryUser(input: { transcript: string; tagHints: string; truncated: boolean }): string {
  return `${input.tagHints}\n\n원문 (truncated=${input.truncated}).\n\n<<<\n${input.transcript}\n>>>`;
}
```

```ts
// packages/core/src/llm.ts
// Anthropic Sonnet 4.6 호출 래퍼. system block 에 prompt caching 을 적용하고, JSON 출력을 Zod 로 검증한다.
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { AUTO_SUMMARY_SYSTEM, buildAutoSummaryUser } from './prompts/auto-summary.js';

export const AutoSummaryResultSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary_one_line: z.string().min(1),
  summary_body: z.string().min(1),
  insights: z.array(z.string()).min(1),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(10),
});
export type AutoSummaryResult = z.infer<typeof AutoSummaryResultSchema>;

interface RunInput {
  transcript: string;
  tagHints: string;
  truncated: boolean;
  modelId: string;
}

function extractText(resp: Anthropic.Message): string {
  for (const block of resp.content) if (block.type === 'text') return block.text;
  throw new Error('Anthropic 응답에 text 블록이 없다');
}

export async function runAutoSummary(client: Anthropic, input: RunInput): Promise<AutoSummaryResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await client.messages.create({
      model: input.modelId,
      max_tokens: 4096,
      system: [{ type: 'text', text: AUTO_SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildAutoSummaryUser(input) }],
    });
    const text = extractText(resp);
    try {
      return AutoSummaryResultSchema.parse(JSON.parse(text));
    } catch (e) {
      if (attempt === 1) throw new Error(`자동 요약 LLM 출력 검증 실패. ${(e as Error).message}`);
    }
  }
  throw new Error('unreachable');
}
```

```bash
pnpm --filter @zettlink/core test llm
git add packages/core/src/llm.ts packages/core/src/prompts packages/core/tests/llm.test.ts
git commit -m "feat(core): Anthropic 래퍼 + 자동 요약 프롬프트 + Zod 검증"
```

### Task 1.11: `index.ts` re-export + 통합 typecheck

- [ ] **Step 1: index.ts 갱신**

```ts
// packages/core/src/index.ts
// 공유 패키지의 public re-export 진입점.
export * from './config.js';
export * from './url.js';
export * from './slug.js';
export * from './tokens.js';
export * from './frontmatter.js';
export * from './tags.js';
export * from './vault.js';
export * from './git.js';
export * from './llm.js';
```

- [ ] **Step 2: 전체 타입체크 + 테스트**

```bash
pnpm --filter @zettlink/core typecheck
pnpm --filter @zettlink/core test
```

Expected. 타입체크 무경고, 테스트 전부 PASS.

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/index.ts
git commit -m "chore(core): public API re-export 정리"
```

---

## Phase 2 — apps/daemon

Telegram 캡처를 받아 vault 를 채우는 데몬. Phase 1 의 core 만 의존.

### Task 2.1: 패키지 골격 + main.ts 진입점

**Files.**
- Create: `apps/daemon/package.json`, `apps/daemon/tsconfig.json`, `apps/daemon/src/main.ts`, `apps/daemon/vitest.config.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@zettlink/daemon",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@zettlink/core": "workspace:*",
    "@anthropic-ai/sdk": "^0.30.0",
    "@octokit/rest": "^21.0.0",
    "execa": "^9.4.0",
    "openai": "^4.60.0",
    "telegraf": "^4.16.0",
    "simple-git": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src" },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: 빈 main.ts**

```ts
// apps/daemon/src/main.ts
// Telegram 데몬의 부트스트랩. 환경변수 검증 후 Telegraf long polling 을 시작한다.
import { loadConfig } from '@zettlink/core';

const cfg = loadConfig(process.env);
console.log(`[daemon] 시작. user_id=${cfg.telegram.userId}`);
```

- [ ] **Step 4: install + 실행 확인**

```bash
pnpm install
ANTHROPIC_API_KEY=x TELEGRAM_BOT_TOKEN=x TELEGRAM_USER_ID=1 GITHUB_TOKEN=x REPO_LOCAL_PATH=/tmp CLOUDFLARE_DEPLOY_HOOK_URL=https://x.example.com pnpm --filter @zettlink/daemon start
```

Expected. `[daemon] 시작. user_id=1` 출력.

- [ ] **Step 5: 커밋**

```bash
git add apps/daemon
git commit -m "chore(daemon): 패키지 골격 + main.ts 환경변수 검증"
```

### Task 2.2: `flags.ts` — `+force` / `+whisper` 파싱 (TDD)

**Files.**
- Create: `apps/daemon/src/flags.ts`, `apps/daemon/tests/flags.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// apps/daemon/tests/flags.test.ts
import { describe, it, expect } from 'vitest';
import { parseMessage } from '../src/flags.js';

describe('parseMessage', () => {
  it('첫 URL과 플래그, 나머지 텍스트(=note)를 분리한다', () => {
    const r = parseMessage('https://youtu.be/abc +whisper 메모 텍스트');
    expect(r.url).toBe('https://youtu.be/abc');
    expect(r.flags).toEqual({ force: false, whisper: true });
    expect(r.note).toBe('메모 텍스트');
  });

  it('플래그가 없으면 모두 false 다', () => {
    const r = parseMessage('https://github.com/a/b');
    expect(r.flags).toEqual({ force: false, whisper: false });
  });

  it('URL 이 없으면 url=null 이다', () => {
    expect(parseMessage('그냥 메모').url).toBeNull();
  });

  it('+force +whisper 둘 다 인식한다', () => {
    const r = parseMessage('https://github.com/a/b +force +whisper');
    expect(r.flags).toEqual({ force: true, whisper: true });
  });
});
```

- [ ] **Step 2 → 4: 구현 + 통과 + 커밋**

```ts
// apps/daemon/src/flags.ts
// Telegram 메시지에서 첫 URL · 플래그 · 부가 메모를 분리한다.
const URL_RE = /https?:\/\/[^\s]+/;

export interface ParsedMessage {
  url: string | null;
  flags: { force: boolean; whisper: boolean };
  note: string;
}

export function parseMessage(text: string): ParsedMessage {
  const urlMatch = text.match(URL_RE);
  const url = urlMatch?.[0] ?? null;
  const force = /\+force\b/.test(text);
  const whisper = /\+whisper\b/.test(text);
  let note = text;
  if (url) note = note.replace(url, '');
  note = note.replace(/\+force\b/g, '').replace(/\+whisper\b/g, '').trim().replace(/\s+/g, ' ');
  return { url, flags: { force, whisper }, note };
}
```

```bash
pnpm --filter @zettlink/daemon test flags
git add apps/daemon/src/flags.ts apps/daemon/tests/flags.test.ts
git commit -m "feat(daemon): 메시지 파서 (+force / +whisper / note)"
```

### Task 2.3: `youtube-vtt.ts` — VTT 파서 (TDD, fixture)

**Files.**
- Create: `apps/daemon/fixtures/sample-auto.vtt`, `apps/daemon/fixtures/sample-manual.vtt`, `apps/daemon/src/extractors/youtube-vtt.ts`, `apps/daemon/tests/youtube-vtt.test.ts`

- [ ] **Step 1: fixture 작성**

```vtt
# apps/daemon/fixtures/sample-auto.vtt
WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000
hello world

00:00:02.000 --> 00:00:04.000
hello world

00:00:04.000 --> 00:00:06.000
this is a test

00:00:06.000 --> 00:00:08.000
hello world
```

(인접 dedup 결과는 `hello world / this is a test / hello world` 순서로 보존되어야 한다 — 멀리 떨어진 동일 문구는 그대로.)

- [ ] **Step 2: 실패 테스트**

```ts
// apps/daemon/tests/youtube-vtt.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vttToMarkdown } from '../src/extractors/youtube-vtt.js';

const auto = readFileSync(join(__dirname, '..', 'fixtures', 'sample-auto.vtt'), 'utf8');

describe('vttToMarkdown', () => {
  it('헤더와 타임스탬프를 제거한다', () => {
    const md = vttToMarkdown(auto);
    expect(md).not.toContain('WEBVTT');
    expect(md).not.toMatch(/\d{2}:\d{2}/);
  });

  it('인접 중복만 제거하고 멀리 떨어진 동일 문구는 보존한다', () => {
    const md = vttToMarkdown(auto);
    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toEqual(['hello world', 'this is a test', 'hello world']);
  });
});
```

- [ ] **Step 3 → 5: 구현 + 통과 + 커밋**

```ts
// apps/daemon/src/extractors/youtube-vtt.ts
// yt-dlp 가 받아온 VTT 자막을 transcript.md 에 들어갈 평문으로 변환한다.
const TIMESTAMP_RE = /\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/;
const HEADER_RE = /^(WEBVTT|Kind:|Language:|NOTE\b)/;

export function vttToMarkdown(vtt: string): string {
  const raw = vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !HEADER_RE.test(l) && !TIMESTAMP_RE.test(l));
  // 인접 dedup. 짧은 단어 반복 패턴(like "Yes", "OK") 은 멀리 떨어지면 살리되, 큐가 그대로 다음 줄에 반복되면 제거.
  const deduped = raw.filter((l, i) => l !== raw[i - 1]);
  return deduped.join('\n');
}
```

```bash
pnpm --filter @zettlink/daemon test youtube-vtt
git add apps/daemon/fixtures apps/daemon/src/extractors/youtube-vtt.ts apps/daemon/tests/youtube-vtt.test.ts
git commit -m "feat(daemon): VTT → 마크다운 변환 + 인접 dedup"
```

### Task 2.4: `youtube.ts` — yt-dlp subprocess 래퍼

**Files.**
- Create: `apps/daemon/src/extractors/youtube.ts`

이 파일은 외부 바이너리에 강하게 의존한다. 통합 테스트는 CI 에서 항상 통과시키기 어려워, 단위 테스트는 `execa` 를 mock 하는 형태로 1개만 작성한다. nominal path 는 `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs en,ko --sub-format vtt --print-json` 호출 + JSON 메타파싱 + VTT 파일 발견.

- [ ] **Step 1: 테스트 작성 (mock)**

```ts
// apps/daemon/tests/youtube.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { extractYoutube } from '../src/extractors/youtube.js';

describe('extractYoutube', () => {
  beforeEach(() => { (execa as any).mockReset(); });

  it('manual 자막이 있으면 subtitle_source=manual', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    const vttPath = join(dir, 'video.en.vtt');
    await writeFile(vttPath, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n', 'utf8');
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({
        id: 'abc', title: 'T', channel: 'C', duration: 60,
        thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
        requested_subtitles: { en: { filepath: vttPath } },
      }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.video_id).toBe('abc');
    expect(r.meta.subtitle_source).toBe('manual');
    expect(r.transcript).toContain('hello');
  });

  it('자막이 전혀 없으면 subtitle_source=none + 빈 transcript', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yt-'));
    (execa as any).mockResolvedValue({
      stdout: JSON.stringify({ id: 'abc', title: 'T', channel: 'C', duration: 60, thumbnail: 'x' }),
    });
    const r = await extractYoutube('https://youtu.be/abc', dir);
    expect(r.meta.subtitle_source).toBe('none');
    expect(r.transcript).toBe('');
  });

  it('yt-dlp PATH 누락 시 식별 가능한 에러를 던진다', async () => {
    (execa as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(extractYoutube('https://youtu.be/abc', '/tmp')).rejects.toThrow(/yt-dlp/);
  });
});
```

- [ ] **Step 2 → 4: 구현 + 통과 + 커밋**

```ts
// apps/daemon/src/extractors/youtube.ts
// yt-dlp 를 subprocess 로 호출해 VTT 자막 + 메타데이터를 받아 transcript.md 형식으로 정리한다.
import { execa } from 'execa';
import { readFile } from 'node:fs/promises';
import { vttToMarkdown } from './youtube-vtt.js';

export interface YoutubeMeta {
  video_id: string;
  channel: string;
  title: string;
  duration_sec: number;
  thumbnail: string;
  subtitle_source: 'auto' | 'manual' | 'whisper' | 'none';
}

export interface YoutubeExtraction {
  meta: YoutubeMeta;
  transcript: string;
}

export async function extractYoutube(url: string, workDir: string): Promise<YoutubeExtraction> {
  let stdout: string;
  try {
    const result = await execa('yt-dlp', [
      '--skip-download',
      '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,ko',
      '--sub-format', 'vtt',
      '--print-json',
      '--output', `${workDir}/%(id)s.%(ext)s`,
      url,
    ]);
    stdout = result.stdout;
  } catch (e: any) {
    if (e?.code === 'ENOENT') throw new Error('yt-dlp 가 PATH 에 없다. brew install yt-dlp');
    throw new Error(`yt-dlp 실행 실패. ${e?.message ?? e}`);
  }
  const meta = JSON.parse(stdout);
  const subs = meta.requested_subtitles ?? {};
  let source: YoutubeMeta['subtitle_source'] = 'none';
  let transcript = '';
  // 우선순위. manual > auto.
  for (const lang of ['en', 'ko']) {
    const entry = subs[lang];
    if (!entry?.filepath) continue;
    const isAuto = entry.ext?.includes('auto') || entry.url?.includes('auto');
    source = isAuto ? 'auto' : 'manual';
    const vtt = await readFile(entry.filepath, 'utf8');
    transcript = vttToMarkdown(vtt);
    break;
  }
  return {
    meta: {
      video_id: meta.id,
      channel: meta.channel ?? meta.uploader ?? '',
      title: meta.title ?? '',
      duration_sec: meta.duration ?? 0,
      thumbnail: meta.thumbnail ?? '',
      subtitle_source: source,
    },
    transcript,
  };
}
```

```bash
pnpm --filter @zettlink/daemon test youtube
git add apps/daemon/src/extractors/youtube.ts apps/daemon/tests/youtube.test.ts
git commit -m "feat(daemon): yt-dlp 추출기 + 자막 우선순위 (manual > auto > none)"
```

### Task 2.5: `youtube-whisper.ts` — `+whisper` 옵트인 폴백

**Files.**
- Create: `apps/daemon/src/extractors/youtube-whisper.ts`

자막이 `none` 이고 사용자가 `+whisper` 를 명시했을 때만 호출. yt-dlp 로 mp3 다운로드 → OpenAI `whisper-1`. 단위 테스트 1개 (OpenAI mock).

- [ ] **Step 1 → 5: 테스트 + 구현 + 커밋 (`youtube.test.ts` 와 같은 구조로 OpenAI client mock).** 본 task 의 코드는 분량 절약 위해 핵심 시그니처만:

```ts
// apps/daemon/src/extractors/youtube-whisper.ts
// 자막이 없는 영상에 한해 OpenAI whisper-1 로 음성을 텍스트로 받는다. +whisper 명시 시에만 호출된다.
import { execa } from 'execa';
import { createReadStream } from 'node:fs';
import OpenAI from 'openai';

export async function whisperTranscribe(url: string, workDir: string, openai: OpenAI): Promise<string> {
  await execa('yt-dlp', ['-x', '--audio-format', 'mp3', '-o', `${workDir}/audio.%(ext)s`, url]);
  const r = await openai.audio.transcriptions.create({
    file: createReadStream(`${workDir}/audio.mp3`),
    model: 'whisper-1',
  });
  return r.text;
}
```

테스트는 `execa` + OpenAI 둘 다 mock. 통과 후 커밋.

```bash
git commit -m "feat(daemon): whisper-1 폴백 (+whisper 옵트인)"
```

### Task 2.6: `github.ts` — octokit 추출 (TDD, mock)

**Files.**
- Create: `apps/daemon/src/extractors/github.ts`, `apps/daemon/tests/github.test.ts`

**B-깊이 정의 재확인.** README + depth-2 디렉토리 트리 + 핵심 파일 5~10 개 (entry point + 주요 모듈). entry point 는 `package.json` 의 `main`, `pyproject.toml` 의 entry, 혹은 README 에 등장하는 첫 path.

- [ ] **Step 1: 테스트 (octokit mock)**

```ts
// apps/daemon/tests/github.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractGithub } from '../src/extractors/github.js';

describe('extractGithub', () => {
  it('README + 디렉토리 트리(depth 2) + 메타데이터를 수집한다', async () => {
    const fakeOctokit = {
      repos: {
        get: vi.fn().mockResolvedValue({ data: { stargazers_count: 100, language: 'TypeScript', topics: ['agents'] } }),
        getReadme: vi.fn().mockResolvedValue({ data: { content: Buffer.from('# Hello').toString('base64') } }),
        getContent: vi.fn()
          .mockResolvedValueOnce({ data: [{ type: 'dir', path: 'src' }, { type: 'file', path: 'README.md' }] })
          .mockResolvedValueOnce({ data: [{ type: 'file', path: 'src/index.ts' }] }),
      },
    };
    const r = await extractGithub(fakeOctokit as any, 'a', 'b');
    expect(r.meta).toEqual({ owner: 'a', repo: 'b', stars: 100, primary_language: 'TypeScript', topics: ['agents'] });
    expect(r.extract).toContain('# Hello');
    expect(r.extract).toContain('src/');
    expect(r.extract).toContain('src/index.ts');
  });
});
```

- [ ] **Step 2 → 4: 구현 + 통과 + 커밋**

```ts
// apps/daemon/src/extractors/github.ts
// octokit 으로 README + depth-2 디렉토리 트리 + 메타데이터를 받아 extract.md 본문을 만든다.
import type { Octokit } from '@octokit/rest';

export interface GithubMeta {
  owner: string; repo: string; stars: number; primary_language: string; topics: string[];
}

export async function extractGithub(octokit: Octokit, owner: string, repo: string): Promise<{ meta: GithubMeta; extract: string }> {
  const repoInfo = await octokit.repos.get({ owner, repo });
  const readme = await octokit.repos.getReadme({ owner, repo });
  const readmeText = Buffer.from((readme.data as any).content, 'base64').toString('utf8');

  const root = await octokit.repos.getContent({ owner, repo, path: '' });
  const lines: string[] = ['# 디렉토리 트리 (depth 2)', ''];
  for (const entry of root.data as Array<{ type: string; path: string }>) {
    if (entry.type === 'dir') {
      lines.push(`${entry.path}/`);
      const sub = await octokit.repos.getContent({ owner, repo, path: entry.path });
      for (const c of sub.data as Array<{ path: string }>) lines.push(`  ${c.path}`);
    } else {
      lines.push(entry.path);
    }
  }
  return {
    meta: {
      owner, repo,
      stars: repoInfo.data.stargazers_count ?? 0,
      primary_language: repoInfo.data.language ?? '',
      topics: repoInfo.data.topics ?? [],
    },
    extract: `# README\n\n${readmeText}\n\n${lines.join('\n')}\n`,
  };
}
```

```bash
pnpm --filter @zettlink/daemon test github
git add apps/daemon/src/extractors/github.ts apps/daemon/tests/github.test.ts
git commit -m "feat(daemon): GitHub 추출기 (README + depth-2 트리 + 메타)"
```

### Task 2.7: `pipeline.ts` — 추출 → LLM → 파일 → push (통합 테스트)

**Files.**
- Create: `apps/daemon/src/pipeline.ts`, `apps/daemon/tests/pipeline.test.ts`

`pipeline.ts` 는 한 URL 의 전체 처리를 직렬로 실행한다. 의존성을 주입 받아 mock 가능.

- [ ] **Step 1: 테스트 (full mock)**

```ts
// apps/daemon/tests/pipeline.test.ts
// 시나리오. youtube URL 처리 → vault 카드 생성 → git push.
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processUrl } from '../src/pipeline.js';

describe('processUrl', () => {
  it('YouTube 카드 생성 + git push 성공 시 status=summarized 로 끝난다', async () => {
    const repoLocalPath = await mkdtemp(join(tmpdir(), 'vault-'));
    const deps = {
      extractYoutube: vi.fn().mockResolvedValue({
        meta: { video_id: 'abc', channel: 'C', title: 'How Claude Uses Tools', duration_sec: 60, thumbnail: 'https://x/y.jpg', subtitle_source: 'auto' },
        transcript: 'hello world',
      }),
      runAutoSummary: vi.fn().mockResolvedValue({
        title: 'How Claude Uses Tools', slug: 'how-claude-uses-tools',
        summary_one_line: '한 줄.', summary_body: '본문.',
        insights: ['i1'], tags: ['claude'],
      }),
      git: { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) },
      now: () => new Date('2026-05-09T12:00:00Z'),
      tagFrequency: {},
    };
    const r = await processUrl({ url: 'https://youtu.be/abc', flags: { force: false, whisper: false }, note: '' }, { ...deps, repoLocalPath } as any);
    expect(r.kind).toBe('ok');
    const indexMd = await readFile(join(repoLocalPath, 'sources', 'youtube', '2026-05-09-how-claude-uses-tools', 'index.md'), 'utf8');
    expect(indexMd).toContain('status: summarized');
    expect(deps.git.push).toHaveBeenCalledOnce();
  });

  it('LLM 실패 시 transcript 만 commit 하고 status=failed 로 둔다', async () => {
    // 동일한 셋업이지만 runAutoSummary 가 throw.
    // 결과. 카드 폴더는 만들되 index.md.status === 'failed', summary_body 는 placeholder.
  });

  it('중복 URL + force=false 면 duplicate 결과 + 파일 변경 없음', async () => { /* ... */ });
});
```

- [ ] **Step 2 → 4: 구현 + 통과 + 커밋**

```ts
// apps/daemon/src/pipeline.ts
// URL 한 건의 캡처 → 추출 → LLM → 파일 생성 → git push 까지를 직렬로 실행한다.
import {
  normalizeUrl, type IndexFrontmatter,
  cardFolderExists, writeCard, listCards, commitAndPushWithRetry,
  computeTagFrequency, formatTagHints, headTailTruncate,
  youtubeTitleSlug, githubSlug, datedFolder,
} from '@zettlink/core';
import type { SimpleGit } from 'simple-git';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParsedMessage } from './flags.js';

interface Deps {
  repoLocalPath: string;
  extractYoutube: (url: string, workDir: string) => Promise<{ meta: any; transcript: string }>;
  extractGithub: (owner: string, repo: string) => Promise<{ meta: any; extract: string }>;
  whisperTranscribe?: (url: string, workDir: string) => Promise<string>;
  runAutoSummary: (input: { transcript: string; tagHints: string; truncated: boolean; modelId: string }) => Promise<{
    title: string; slug: string; summary_one_line: string; summary_body: string; insights: string[]; tags: string[];
  }>;
  git: SimpleGit;
  now: () => Date;
  modelId: string;
}

export type PipelineResult =
  | { kind: 'ok'; cardDir: string; cardSlug: string }
  | { kind: 'duplicate'; existingSlug: string }
  | { kind: 'unsupported' }
  | { kind: 'failed'; reason: string; cardDir?: string };

export async function processUrl(msg: ParsedMessage, deps: Deps): Promise<PipelineResult> {
  if (!msg.url) return { kind: 'unsupported' };
  const norm = normalizeUrl(msg.url);
  if (!norm) return { kind: 'unsupported' };

  const date = deps.now().toISOString().slice(0, 10);
  const provisionalSlug = norm.platform === 'youtube'
    ? `youtube-${(norm as any).videoId}`            // 임시. LLM 으로 제목 받은 뒤 교체
    : githubSlug((norm as any).owner, (norm as any).repo);

  // 중복 체크. youtube 는 LLM 결과 슬러그가 다를 수 있어 video_id 기반 보조 인덱스도 검사.
  if (!msg.flags.force) {
    if (await cardFolderExists(deps.repoLocalPath, norm.platform, provisionalSlug)) {
      return { kind: 'duplicate', existingSlug: provisionalSlug };
    }
    if (norm.platform === 'youtube') {
      const cards = await listCards(deps.repoLocalPath);
      const dup = cards.find((c) => c.frontmatter.youtube?.video_id === (norm as any).videoId);
      if (dup) return { kind: 'duplicate', existingSlug: dup.frontmatter.slug };
    }
  }

  // 1) 추출.
  let transcript = '';
  let platformMeta: any;
  if (norm.platform === 'youtube') {
    const yt = await deps.extractYoutube(msg.url, deps.repoLocalPath + '/.tmp');
    platformMeta = yt.meta;
    transcript = yt.transcript;
    if (!transcript && msg.flags.whisper && deps.whisperTranscribe) {
      transcript = await deps.whisperTranscribe(msg.url, deps.repoLocalPath + '/.tmp');
      platformMeta.subtitle_source = 'whisper';
    }
  } else {
    const gh = await deps.extractGithub((norm as any).owner, (norm as any).repo);
    platformMeta = gh.meta;
    transcript = gh.extract;
  }

  // 2) LLM 자동 요약.
  const cards = await listCards(deps.repoLocalPath);
  const tagHints = formatTagHints(computeTagFrequency(cards.map((c) => c.frontmatter)));
  const { text: trimmed, truncated } = headTailTruncate(transcript, 6000);

  let llmResult: Awaited<ReturnType<Deps['runAutoSummary']>> | null = null;
  let llmError: Error | null = null;
  try {
    llmResult = await deps.runAutoSummary({ transcript: trimmed, tagHints, truncated, modelId: deps.modelId });
  } catch (e) { llmError = e as Error; }

  // 3) 파일 작성.
  const slug = llmResult?.slug ?? provisionalSlug;
  const fm: IndexFrontmatter = {
    url: norm.canonical,
    platform: norm.platform,
    slug,
    captured_at: deps.now().toISOString(),
    title: llmResult?.title ?? (platformMeta.title ?? slug),
    summary_one_line: llmResult?.summary_one_line ?? '(요약 실패)',
    tags: llmResult?.tags ?? [],
    status: llmResult ? 'summarized' : 'failed',
    reviewed: false,
    published: false,
    note: msg.note,
    generated: { deep: false, til: false, guide: false },
    llm: { model: deps.modelId, truncated },
    youtube: norm.platform === 'youtube' ? platformMeta : undefined,
    github: norm.platform === 'github' ? platformMeta : undefined,
  };
  const body = llmResult ? `${fm.summary_one_line}\n\n${llmResult.summary_body}\n\n## 인사이트\n${llmResult.insights.map((i) => `- ${i}`).join('\n')}\n` : '## 요약 실패\n자동 요약을 생성하지 못했다. transcript.md / extract.md 는 이미 저장되어 있다.\n';

  const cardDir = await writeCard(deps.repoLocalPath, fm, body);
  const sourceFile = norm.platform === 'youtube' ? 'transcript.md' : 'extract.md';
  await writeFile(join(cardDir, sourceFile), transcript, 'utf8');

  // 4) git push.
  await commitAndPushWithRetry(deps.git, [`sources/${norm.platform}/${datedFolder(date, slug)}/`], `add ${slug}`);

  return llmResult
    ? { kind: 'ok', cardDir, cardSlug: slug }
    : { kind: 'failed', reason: llmError?.message ?? 'unknown', cardDir };
}
```

```bash
pnpm --filter @zettlink/daemon test pipeline
git add apps/daemon/src/pipeline.ts apps/daemon/tests/pipeline.test.ts
git commit -m "feat(daemon): URL 처리 파이프라인 (직렬, 추출 → LLM → 파일 → push)"
```

### Task 2.8: `handler.ts` + `main.ts` — Telegraf 화이트리스트 + reaction + reply

**Files.**
- Create: `apps/daemon/src/handler.ts`, `apps/daemon/src/reply.ts`
- Modify: `apps/daemon/src/main.ts`

핵심 동작.
- 메시지 도착 시 보낸 user_id 가 whitelist 가 아니면 무시.
- 시작 reaction 👀, 처리 결과에 따라 답장.
- Telegraf 핸들러를 `async + await` 로 직렬화 (D7).
- 처리 전체에 10 분 타임아웃 (F2).

- [ ] **Step 1: handler 단위 테스트** (Telegraf context mock).

```ts
// apps/daemon/tests/handler.test.ts
// whitelist 분기 + reaction + reply 호출을 검증. processUrl 은 mock.
import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/handler.js';

const baseCtx = (text: string, userId: number) => ({
  message: { text, from: { id: userId } },
  react: vi.fn().mockResolvedValue(undefined),
  reply: vi.fn().mockResolvedValue(undefined),
});

describe('handleMessage', () => {
  it('whitelist 가 아니면 무시 (reply / react / processUrl 모두 호출 안 함)', async () => {
    const ctx = baseCtx('https://youtu.be/x', 999);
    const processUrl = vi.fn();
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl } as any);
    expect(processUrl).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('지원하지 않는 URL 이면 안내 답장', async () => {
    const ctx = baseCtx('https://example.com', 1);
    const processUrl = vi.fn().mockResolvedValue({ kind: 'unsupported' });
    await handleMessage(ctx as any, { allowedUserId: 1, processUrl } as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('지원하지 않는 URL'));
  });

  it('성공 시 vault 경로 + 비공개 안내', async () => { /* ... */ });
  it('중복 시 ⚠️ 메시지', async () => { /* ... */ });
  it('실패 시 ❌ + 사유', async () => { /* ... */ });
});
```

- [ ] **Step 2 → 4: 구현 + 통과**

```ts
// apps/daemon/src/handler.ts
// Telegram 메시지를 받아 whitelist 검증 → URL 파싱 → pipeline 호출 → 답장. 처리 전체에 10 분 타임아웃.
import type { Context } from 'telegraf';
import { parseMessage } from './flags.js';
import type { processUrl as ProcessUrl } from './pipeline.js';

const TEN_MIN_MS = 10 * 60 * 1000;

export async function handleMessage(
  ctx: Context,
  deps: { allowedUserId: number; processUrl: typeof ProcessUrl; pipelineDeps: Parameters<typeof ProcessUrl>[1] },
): Promise<void> {
  const text = (ctx.message as any)?.text ?? '';
  const fromId = (ctx.message as any)?.from?.id;
  if (fromId !== deps.allowedUserId) return;

  await (ctx as any).react?.('👀').catch(() => {});

  const parsed = parseMessage(text);
  if (!parsed.url) {
    await ctx.reply('❌ URL 이 없다. YouTube 또는 GitHub URL 을 보내주세요.');
    return;
  }
  try {
    const result = await Promise.race([
      deps.processUrl(parsed, deps.pipelineDeps),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('10 분 타임아웃')), TEN_MIN_MS)),
    ]);
    if (result.kind === 'ok') await ctx.reply(`✅ 카드 생성. \`${result.cardDir}\`. 비공개. Publish 버튼으로 공개.`);
    else if (result.kind === 'duplicate') await ctx.reply(`⚠️ 이미 처리된 URL. \`${result.existingSlug}\`. 재처리하려면 +force 를 붙여 다시 보내주세요.`);
    else if (result.kind === 'unsupported') await ctx.reply('❌ 지원하지 않는 URL 입니다. YouTube 또는 GitHub URL 을 보내주세요.');
    else await ctx.reply(`❌ 처리 실패. ${result.reason}. 부분 결과는 \`${result.cardDir ?? '없음'}\` 에 남아 있다.`);
  } catch (e) {
    await ctx.reply(`❌ ${(e as Error).message}`);
  }
}
```

```ts
// apps/daemon/src/main.ts (덮어쓰기)
// Telegram 데몬의 부트스트랩.
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import { loadConfig, openRepo, runAutoSummary as runAutoSummaryCore } from '@zettlink/core';
import { handleMessage } from './handler.js';
import { processUrl } from './pipeline.js';
import { extractYoutube } from './extractors/youtube.js';
import { extractGithub } from './extractors/github.js';
import { whisperTranscribe } from './extractors/youtube-whisper.js';

const cfg = loadConfig(process.env);
const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey });
const openai = cfg.openaiApiKey ? new OpenAI({ apiKey: cfg.openaiApiKey }) : undefined;
const octokit = new Octokit({ auth: cfg.githubToken });
const git = openRepo(cfg.repoLocalPath);

const pipelineDeps = {
  repoLocalPath: cfg.repoLocalPath,
  extractYoutube,
  extractGithub: (owner: string, repo: string) => extractGithub(octokit, owner, repo),
  whisperTranscribe: openai ? (url: string, workDir: string) => whisperTranscribe(url, workDir, openai) : undefined,
  runAutoSummary: (input: any) => runAutoSummaryCore(anthropic, input),
  git,
  now: () => new Date(),
  modelId: 'claude-sonnet-4-6',
};

const bot = new Telegraf(cfg.telegram.botToken);
bot.on('message', async (ctx) => {
  await handleMessage(ctx, { allowedUserId: cfg.telegram.userId, processUrl, pipelineDeps });
});
bot.launch();
console.log(`[daemon] Telegram long polling 시작.`);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

- [ ] **Step 5: 커밋**

```bash
pnpm --filter @zettlink/daemon test handler
pnpm --filter @zettlink/daemon typecheck
git add apps/daemon/src/handler.ts apps/daemon/src/main.ts apps/daemon/tests/handler.test.ts
git commit -m "feat(daemon): Telegraf 핸들러 + 화이트리스트 + 10분 타임아웃 + 답장"
```

### Task 2.9: 데몬 수동 동작 확인 (smoke test)

이 task 는 자동화된 step 이 아니라 사용자가 수동으로 검증하는 절차다.

- [ ] **Step 1.** `.env` 작성 (실제 토큰).
- [ ] **Step 2.** `brew install yt-dlp` 가 되어 있는지 확인.
- [ ] **Step 3.** `pnpm daemon` 으로 실행, Telegram 봇에 짧은 YouTube URL 전송.
- [ ] **Step 4.** 답장이 5 분 안에 오고, vault repo 에 카드 폴더가 생성되었는지 확인.
- [ ] **Step 5.** 두 번째로 같은 URL 전송 → ⚠️ 답장 확인.
- [ ] **Step 6.** GitHub URL 전송 → 카드 생성 확인.

**여기까지가 Phase 1 + 2. 이 시점에서 자동 캡처는 동작한다. 이후 Phase 3 / 4 는 카드를 발전시키고 발행하는 부분.**

---

## Phase 3 — apps/dashboard (Next.js, 로컬 dev only)

`docs/design/local-dashboard-ui-ux.md` 의 IA 를 그대로 구현. DESIGN.md 의 토큰을 Tailwind v4 `@theme` 로 매핑.

### Task 3.1: Next.js 15 셋업 + DESIGN.md 토큰 매핑

**Files.**
- Create: `apps/dashboard/package.json`, `apps/dashboard/tsconfig.json`, `apps/dashboard/next.config.mjs`, `apps/dashboard/app/layout.tsx`, `apps/dashboard/app/page.tsx`, `apps/dashboard/app/globals.css`, `apps/dashboard/postcss.config.mjs`

- [ ] **Step 1: package.json**

```json
{
  "name": "@zettlink/dashboard",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "node lib/guards/check-env.mjs && next build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@zettlink/core": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.7.0",
    "vitest": "^2.0.0",
    "typescript": "^5.6.0",
    "postcss": "^8.4.0"
  }
}
```

- [ ] **Step 2: globals.css — DESIGN.md 토큰 → Tailwind v4 @theme 매핑**

```css
/* apps/dashboard/app/globals.css */
/* DESIGN.md 의 Wanted Montage 토큰을 Tailwind v4 @theme 로 노출한다. */
@import "tailwindcss";

@theme {
  --color-primary: #0066FF;
  --color-primary-strong: #005EEB;
  --color-primary-heavy: #0054D1;
  --color-bg: #FFFFFF;
  --color-bg-alt: #F7F7F8;
  --color-bg-elevated: #FFFFFF;
  --color-label-normal: #171719;
  --color-label-strong: #000000;
  --color-label-neutral: rgba(23, 23, 25, 0.88);
  --color-label-alternative: rgba(55, 56, 60, 0.61);
  --color-label-assistive: rgba(55, 56, 60, 0.28);
  --color-label-disable: rgba(55, 56, 60, 0.16);
  --color-line-normal: rgba(112, 115, 124, 0.22);
  --color-line-solid: #E1E2E4;
  --color-status-positive: #00C853;
  --color-status-cautionary: #FF9100;
  --color-status-negative: #FF3B30;
  --color-inverse-bg: #1B1C1E;
  --color-inverse-label: #F7F7F8;

  --font-sans: 'Wanted Sans', 'Pretendard', system-ui, sans-serif;

  --text-display-lg: 48px;
  --text-headline-lg: 32px;
  --text-headline-md: 24px;
  --text-body-lg: 18px;
  --text-body-md: 16px;
  --text-body-sm: 14px;
  --text-label-md: 14px;
  --text-label-sm: 12px;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}

html { font-family: var(--font-sans); }
body { background: var(--color-bg-alt); color: var(--color-label-normal); }
```

- [ ] **Step 3: layout.tsx**

```tsx
// apps/dashboard/app/layout.tsx
// 대시보드 루트 레이아웃. Wanted Sans 폰트와 토큰을 적용한다.
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'zettlink dashboard' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@latest/packages/wanted-sans/fonts/webfonts/variable/complete/WantedSansVariable.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: 빈 page.tsx**

```tsx
// apps/dashboard/app/page.tsx
// Review Board 진입점. Phase 3 후속 task 에서 채운다.
export default function ReviewBoardPage() {
  return <main className="p-6"><h1 className="text-2xl font-bold">Review Board (placeholder)</h1></main>;
}
```

- [ ] **Step 5: tsconfig + next config + postcss config + 빌드 차단 가드 placeholder**

```json
// apps/dashboard/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "preserve", "plugins": [{ "name": "next" }], "rootDir": "." },
  "include": ["app/**/*", "components/**/*", "lib/**/*", "tests/**/*", "next-env.d.ts"]
}
```

```js
// apps/dashboard/next.config.mjs
// 대시보드는 로컬 dev 전용. production build 차단은 lib/guards/check-env.mjs 에서 한다.
export default { reactStrictMode: true };
```

```js
// apps/dashboard/postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```js
// apps/dashboard/lib/guards/check-env.mjs
// production 환경에서의 dashboard 빌드를 차단한다 (의도하지 않은 외부 노출 방지).
import process from 'node:process';
if (process.env.ALLOW_PROD_DASHBOARD_BUILD !== '1') {
  console.error('zettlink dashboard 는 dev 전용. ALLOW_PROD_DASHBOARD_BUILD=1 가 명시되지 않으면 빌드를 거부한다.');
  process.exit(1);
}
console.log('production dashboard build 명시 허용. 계속 진행.');
```

- [ ] **Step 6: install + dev 확인 + 커밋**

```bash
pnpm install
pnpm --filter @zettlink/dashboard dev
# 다른 터미널에서 http://localhost:3000 → "Review Board (placeholder)" 표시 확인 후 종료.
git add apps/dashboard
git commit -m "chore(dashboard): Next.js 15 + Tailwind v4 셋업 + DESIGN.md 토큰"
```

### Task 3.2: `lib/board.ts` — Kanban 컬럼 우선순위 (TDD, **핵심 비즈니스 로직**)

`local-dashboard-ui-ux.md` 의 "Board Column Rules" 를 그대로 코드화.

**Files.**
- Create: `apps/dashboard/lib/board.ts`, `apps/dashboard/tests/board.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// apps/dashboard/tests/board.test.ts
import { describe, it, expect } from 'vitest';
import { computeColumn, type CardSnapshot, type BoardColumn } from '../lib/board.js';

const base: CardSnapshot = {
  reviewed: false,
  index_published: false,
  artifacts: { deep: { exists: false, published: false }, til: { exists: false, published: false }, guide: { exists: false, published: false } },
};

describe('computeColumn', () => {
  it('index.md published=true → Published', () => {
    expect(computeColumn({ ...base, index_published: true })).toBe<BoardColumn>('Published');
  });
  it('어떤 산출물이라도 published=true 면 Published', () => {
    expect(computeColumn({ ...base, artifacts: { ...base.artifacts, deep: { exists: true, published: true } } })).toBe<BoardColumn>('Published');
  });
  it('reviewed=false → Needs review', () => {
    expect(computeColumn(base)).toBe<BoardColumn>('Needs review');
  });
  it('reviewed=true 이고 til.md 가 존재 → TIL ready', () => {
    expect(computeColumn({ ...base, reviewed: true, artifacts: { ...base.artifacts, til: { exists: true, published: false } } })).toBe<BoardColumn>('TIL ready');
  });
  it('reviewed=true 이고 til 없고 deep 만 존재 → Deep done', () => {
    expect(computeColumn({ ...base, reviewed: true, artifacts: { ...base.artifacts, deep: { exists: true, published: false } } })).toBe<BoardColumn>('Deep done');
  });
  it('reviewed=true 이고 산출물 없음 / published 없음 → null (Active 보드에서 숨김)', () => {
    expect(computeColumn({ ...base, reviewed: true })).toBeNull();
  });
  it('guide.md 만 있어도 TIL ready 가 아니다 (til 만 컬럼을 결정)', () => {
    expect(computeColumn({ ...base, reviewed: true, artifacts: { ...base.artifacts, guide: { exists: true, published: false } } })).toBeNull();
  });
});
```

- [ ] **Step 2 → 4: 구현 + 통과 + 커밋**

```ts
// apps/dashboard/lib/board.ts
// Review Board 컬럼을 frontmatter + 산출물 파일 존재 여부로 결정한다. local-dashboard-ui-ux.md 의 우선순위를 그대로 따른다.
export type BoardColumn = 'Published' | 'Needs review' | 'TIL ready' | 'Deep done';

export interface ArtifactSnapshot { exists: boolean; published: boolean }
export interface CardSnapshot {
  reviewed: boolean;
  index_published: boolean;
  artifacts: { deep: ArtifactSnapshot; til: ArtifactSnapshot; guide: ArtifactSnapshot };
}

export function computeColumn(card: CardSnapshot): BoardColumn | null {
  if (card.index_published || card.artifacts.deep.published || card.artifacts.til.published || card.artifacts.guide.published) return 'Published';
  if (!card.reviewed) return 'Needs review';
  if (card.artifacts.til.exists) return 'TIL ready';
  if (card.artifacts.deep.exists) return 'Deep done';
  return null;
}

export const ALL_COLUMNS: BoardColumn[] = ['Needs review', 'Deep done', 'TIL ready', 'Published'];
```

```bash
pnpm --filter @zettlink/dashboard test board
git add apps/dashboard/lib/board.ts apps/dashboard/tests/board.test.ts
git commit -m "feat(dashboard): Kanban 컬럼 우선순위 계산"
```

### Task 3.3: `lib/scan.ts` — 카드 + 산출물 파일 동시 스캔

**Files.**
- Create: `apps/dashboard/lib/scan.ts`, `apps/dashboard/tests/scan.test.ts`

`@zettlink/core` 의 `listCards` 위에 산출물 파일 존재/published 여부를 추가로 읽어 `CardSnapshot` 으로 변환.

- [ ] **Step 1 → 5: 표준 TDD 사이클.** 핵심 시그니처:

```ts
// apps/dashboard/lib/scan.ts
// vault 의 카드 폴더를 스캔해 frontmatter + 산출물 파일 상태를 합친 스냅샷을 만든다.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listCards, parseArtifact, type IndexFrontmatter } from '@zettlink/core';
import type { CardSnapshot } from './board.js';

export interface CardRow {
  frontmatter: IndexFrontmatter;
  dir: string;
  snapshot: CardSnapshot;
}

function readArtifact(dir: string, file: string) {
  const path = join(dir, file);
  if (!existsSync(path)) return { exists: false, published: false };
  try {
    const { frontmatter } = parseArtifact(readFileSync(path, 'utf8'));
    return { exists: true, published: frontmatter.published };
  } catch { return { exists: true, published: false }; }
}

export async function scanVault(root: string): Promise<CardRow[]> {
  const cards = await listCards(root);
  return cards.map(({ frontmatter, dir }) => ({
    frontmatter,
    dir,
    snapshot: {
      reviewed: frontmatter.reviewed,
      index_published: frontmatter.published,
      artifacts: {
        deep: readArtifact(dir, 'deep.md'),
        til: readArtifact(dir, 'til.md'),
        guide: readArtifact(dir, 'guide.md'),
      },
    },
  }));
}
```

테스트는 임시 vault 에 fixture 카드 + 산출물 파일을 만들어 검증.

```bash
git commit -m "feat(dashboard): vault 스캔 (frontmatter + 산출물 published 합산)"
```

### Task 3.4: `lib/filter.ts` — 검색 + 필터 (TDD)

`local-dashboard-ui-ux.md` 의 필터.
- 플랫폼.
- 태그.
- 발행 상태 (`Published` / `Not published`).
- 산출물 존재 (`has deep` / `has til` / `has guide` / `none`).
- 텍스트 검색 (title / summary_one_line / tags 매칭).

scope 는 `Active` (컬럼 매칭) 또는 `All cards` (reviewed + 산출물·발행 없음 카드까지).

- [ ] **Step 1 → 5: 표준 TDD 사이클.**

```ts
// apps/dashboard/lib/filter.ts
// Review Board 의 검색·필터·스코프 로직. 모두 메모리 안에서 처리한다 (카드 수 < 1000 가정).
import type { CardRow } from './scan.js';
import { computeColumn } from './board.js';

export interface FilterState {
  scope: 'active' | 'all';
  q: string;
  platform: 'all' | 'youtube' | 'github';
  tags: string[];
  publish: 'all' | 'published' | 'not_published';
  artifact: 'all' | 'deep' | 'til' | 'guide' | 'none';
}

export const EMPTY_FILTER: FilterState = { scope: 'active', q: '', platform: 'all', tags: [], publish: 'all', artifact: 'all' };

export function applyFilter(rows: CardRow[], f: FilterState): CardRow[] {
  return rows.filter((r) => {
    if (f.scope === 'active' && computeColumn(r.snapshot) === null) return false;
    if (f.platform !== 'all' && r.frontmatter.platform !== f.platform) return false;
    if (f.tags.length > 0 && !f.tags.every((t) => r.frontmatter.tags.includes(t))) return false;
    if (f.publish === 'published' && computeColumn(r.snapshot) !== 'Published') return false;
    if (f.publish === 'not_published' && computeColumn(r.snapshot) === 'Published') return false;
    if (f.artifact === 'deep' && !r.snapshot.artifacts.deep.exists) return false;
    if (f.artifact === 'til' && !r.snapshot.artifacts.til.exists) return false;
    if (f.artifact === 'guide' && !r.snapshot.artifacts.guide.exists) return false;
    if (f.artifact === 'none' && (r.snapshot.artifacts.deep.exists || r.snapshot.artifacts.til.exists || r.snapshot.artifacts.guide.exists)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${r.frontmatter.title} ${r.frontmatter.summary_one_line} ${r.frontmatter.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
```

테스트. `scope=active` 가 reviewed + 산출물 없는 카드를 빼는지, 태그 AND 매칭인지, 검색이 title / summary / tags 모두 커버하는지.

```bash
git commit -m "feat(dashboard): Review Board 검색·필터·스코프"
```

### Task 3.5: Review Board UI — 컬럼 4개 + 카드 칩 + 헤더

**Files.**
- Create: `apps/dashboard/components/BoardColumn.tsx`, `apps/dashboard/components/CardChip.tsx`, `apps/dashboard/components/ScopeToggle.tsx`, `apps/dashboard/components/FilterBar.tsx`
- Modify: `apps/dashboard/app/page.tsx`

UI 가이드.
- 헤더는 `Active` / `All cards` 토글 + 검색 input + 필터 dropdown.
- 4 개 컬럼은 가로 grid (`md:grid-cols-4`). 컬럼 헤더에는 컬럼명 + 카드 수.
- 카드 칩은 insight-first. 첫 줄. 플랫폼 배지 + 캡처 날짜 + 태그 chip 1~2 개. 둘째 줄. 제목. 셋째 줄. 가장 강한 인사이트 1 개 (frontmatter `summary_one_line` 우선, insights 가 본문에 있으면 첫 인사이트).
- DESIGN.md 토큰 사용. 카드 chip 은 `bg-bg-elevated` + `border border-line-solid` + `rounded-md` + `shadow-sm`.

- [ ] **Step 1: CardChip.tsx**

```tsx
// apps/dashboard/components/CardChip.tsx
// Review Board 의 단일 카드 칩. 플랫폼 배지 + 제목 + 한 줄 요약 + 태그 1~2 개를 보인다.
import Link from 'next/link';
import type { CardRow } from '../lib/scan.js';

export function CardChip({ row }: { row: CardRow }) {
  const fm = row.frontmatter;
  return (
    <Link href={`/cards/${encodeURIComponent(fm.slug)}`}
      className="block rounded-md border border-[var(--color-line-solid)] bg-white p-3 shadow-sm hover:border-[var(--color-primary)] transition">
      <div className="flex items-center justify-between text-xs text-[var(--color-label-alternative)]">
        <span className="rounded-full bg-[var(--color-bg-alt)] px-2 py-0.5 font-medium">{fm.platform}</span>
        <span>{fm.captured_at.slice(0, 10)}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-[var(--color-label-strong)] line-clamp-2">{fm.title}</h3>
      <p className="mt-1 text-sm text-[var(--color-label-neutral)] line-clamp-2">{fm.summary_one_line}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {fm.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-full bg-[var(--color-bg-alt)] px-2 py-0.5 text-xs text-[var(--color-label-alternative)]">#{t}</span>
        ))}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: BoardColumn.tsx**

```tsx
// apps/dashboard/components/BoardColumn.tsx
// Kanban 컬럼 한 칸. 컬럼명 + 카드 수 + CardChip 리스트.
import type { BoardColumn as Col } from '../lib/board.js';
import type { CardRow } from '../lib/scan.js';
import { CardChip } from './CardChip.js';

export function BoardColumn({ column, rows }: { column: Col; rows: CardRow[] }) {
  return (
    <section className="flex min-w-[280px] flex-1 flex-col rounded-lg bg-[var(--color-bg-alt)] p-3">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-label-strong)]">{column}</h2>
        <span className="text-xs text-[var(--color-label-alternative)]">{rows.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {rows.map((r) => <CardChip key={r.frontmatter.slug} row={r} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: ScopeToggle / FilterBar (요약).**

```tsx
// apps/dashboard/components/ScopeToggle.tsx
// `Active` / `All cards` 스코프를 토글하는 segmented control.
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
export function ScopeToggle() {
  const sp = useSearchParams();
  const router = useRouter();
  const scope = sp.get('scope') ?? 'active';
  const set = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set('scope', v);
    router.replace(`/?${next.toString()}`);
  };
  return (
    <div className="inline-flex rounded-md border border-[var(--color-line-solid)] bg-white p-0.5">
      {(['active', 'all'] as const).map((v) => (
        <button key={v} onClick={() => set(v)}
          className={`px-3 py-1 text-sm rounded-sm ${scope === v ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-label-neutral)]'}`}>
          {v === 'active' ? 'Active' : 'All cards'}
        </button>
      ))}
    </div>
  );
}
```

`FilterBar.tsx` 는 동일 패턴으로 platform / publish / artifact / 검색 input 4 개를 URL search params 로 양방향 바인딩.

- [ ] **Step 4: app/page.tsx — Review Board 본체**

```tsx
// apps/dashboard/app/page.tsx
// Review Board (대시보드 진입). vault 를 RSC 에서 스캔해 4 개 컬럼 + 검색·필터 결과를 그린다.
import { ALL_COLUMNS, computeColumn } from '../lib/board.js';
import { applyFilter, EMPTY_FILTER, type FilterState } from '../lib/filter.js';
import { scanVault } from '../lib/scan.js';
import { BoardColumn } from '../components/BoardColumn.js';
import { ScopeToggle } from '../components/ScopeToggle.js';
import { FilterBar } from '../components/FilterBar.js';

function paramsToFilter(sp: URLSearchParams): FilterState {
  return {
    ...EMPTY_FILTER,
    scope: (sp.get('scope') as any) ?? 'active',
    q: sp.get('q') ?? '',
    platform: (sp.get('platform') as any) ?? 'all',
    tags: sp.get('tags')?.split(',').filter(Boolean) ?? [],
    publish: (sp.get('publish') as any) ?? 'all',
    artifact: (sp.get('artifact') as any) ?? 'all',
  };
}

export default async function ReviewBoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : v ? [[k, v] as [string, string]] : []));
  const filter = paramsToFilter(sp);
  const rows = applyFilter(await scanVault(process.env.REPO_LOCAL_PATH!), filter);
  const grouped = Object.fromEntries(ALL_COLUMNS.map((c) => [c, [] as typeof rows])) as Record<string, typeof rows>;
  for (const r of rows) {
    const col = computeColumn(r.snapshot);
    if (col) grouped[col]!.push(r);
  }
  return (
    <main className="mx-auto max-w-screen-2xl p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Review Board</h1>
        <ScopeToggle />
        <FilterBar />
      </header>
      <div className="flex gap-3 overflow-x-auto">
        {ALL_COLUMNS.map((c) => <BoardColumn key={c} column={c} rows={grouped[c]!} />)}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: dev 모드에서 fixture vault 로 시각 확인 + 커밋**

```bash
REPO_LOCAL_PATH=/path/to/test-vault pnpm --filter @zettlink/dashboard dev
# 브라우저로 4 개 컬럼이 그려지는지 확인.
git add apps/dashboard/components apps/dashboard/app/page.tsx
git commit -m "feat(dashboard): Review Board UI (4 컬럼 + 칩 + 스코프 + 필터)"
```

### Task 3.6: Card Detail (`/cards/[slug]`) — 요약본 + reviewed/publish 토글

**Files.**
- Create: `apps/dashboard/app/cards/[slug]/page.tsx`, `apps/dashboard/components/CardDetailPanel.tsx`, `apps/dashboard/app/api/reviewed/route.ts`, `apps/dashboard/app/api/publish/route.ts`

`local-dashboard-ui-ux.md` 의 "Card Detail" 명세를 그대로 구현.

콘텐츠.
- 제목.
- 한 줄 요약.
- 본문 요약 (`react-markdown`).
- 인사이트 리스트.
- 태그.
- 플랫폼 메타.
- 소스 링크 / 임베드 (YouTube 는 `<iframe>`, GitHub 는 외부 링크).
- 접힘 가능한 transcript / extract.

이 화면이 소유한 액션은 두 가지다.
- `Mark as reviewed` 토글 (`reviewed` frontmatter 변경).
- `Publish summary` 토글 (`published` frontmatter 변경).

산출물 생성 / 산출물 publish 는 여기에 두지 않는다.

핵심 로직 (서버).
- API route 가 vault 의 `index.md` 를 읽고 frontmatter 만 갱신, 다시 직렬화, `commitAndPushWithRetry` 호출.
- 호출이 성공한 후에만 dashboard 가 redirect/refetch (낙관적 업데이트 금지 — `local-dashboard-ui-ux.md` 명시).

- [ ] **Step 1: API route 두 개**

```ts
// apps/dashboard/app/api/reviewed/route.ts
// 카드의 reviewed frontmatter 토글 + git push.
import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseIndex, serializeIndex, openRepo, commitAndPushWithRetry } from '@zettlink/core';

export async function POST(req: Request) {
  const { dir, value } = await req.json();
  const path = join(dir, 'index.md');
  const md = readFileSync(path, 'utf8');
  const { frontmatter, body } = parseIndex(md);
  frontmatter.reviewed = Boolean(value);
  writeFileSync(path, serializeIndex(frontmatter, body), 'utf8');
  const git = openRepo(process.env.REPO_LOCAL_PATH!);
  await commitAndPushWithRetry(git, [path], `mark reviewed=${value} ${frontmatter.slug}`);
  return NextResponse.json({ ok: true });
}
```

```ts
// apps/dashboard/app/api/publish/route.ts
// 카드 요약본(index.md) 또는 산출물(deep/til/guide) 의 published 를 토글한다 (ADR 0001 의 2-레벨 발행).
import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseIndex, serializeIndex, parseArtifact, serializeArtifact, openRepo, commitAndPushWithRetry } from '@zettlink/core';

export async function POST(req: Request) {
  const { dir, target, value } = await req.json() as { dir: string; target: 'index' | 'deep' | 'til' | 'guide'; value: boolean };
  const filename = target === 'index' ? 'index.md' : `${target}.md`;
  const path = join(dir, filename);
  if (!existsSync(path)) return NextResponse.json({ ok: false, reason: 'file not found' }, { status: 404 });
  const md = readFileSync(path, 'utf8');
  if (target === 'index') {
    const { frontmatter, body } = parseIndex(md);
    frontmatter.published = value;
    writeFileSync(path, serializeIndex(frontmatter, body), 'utf8');
  } else {
    const { frontmatter, body } = parseArtifact(md);
    frontmatter.published = value;
    writeFileSync(path, serializeArtifact(frontmatter, body), 'utf8');
  }
  const git = openRepo(process.env.REPO_LOCAL_PATH!);
  await commitAndPushWithRetry(git, [path], `publish ${target}=${value} ${dir.split('/').pop()}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: CardDetailPanel.tsx (client component)**

핵심. 두 개의 toggle. 호출 실패 시 이전 상태 유지 + 에러 메시지 표시 (`local-dashboard-ui-ux.md` 의 비낙관적 업데이트 정책).

```tsx
// apps/dashboard/components/CardDetailPanel.tsx
// Card Detail 화면의 클라이언트 패널. reviewed / publish summary 토글을 비낙관적으로 처리한다.
'use client';
import { useState } from 'react';

export function CardDetailPanel({ dir, initialReviewed, initialPublished }: { dir: string; initialReviewed: boolean; initialPublished: boolean }) {
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [published, setPublished] = useState(initialPublished);
  const [error, setError] = useState<string | null>(null);

  async function toggle(kind: 'reviewed' | 'publish', value: boolean) {
    setError(null);
    const prev = kind === 'reviewed' ? reviewed : published;
    const url = kind === 'reviewed' ? '/api/reviewed' : '/api/publish';
    const body = kind === 'reviewed' ? { dir, value } : { dir, target: 'index', value };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { setError(`${kind} 토글 실패. 상태 유지.`); return; }
    if (kind === 'reviewed') setReviewed(value); else setPublished(value);
    void prev;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => toggle('reviewed', !reviewed)}
        className={`rounded-md px-3 py-1.5 text-sm border ${reviewed ? 'bg-[var(--color-status-positive)] text-white border-transparent' : 'border-[var(--color-line-solid)]'}`}>
        {reviewed ? '✓ Reviewed' : 'Mark as reviewed'}
      </button>
      <button onClick={() => toggle('publish', !published)}
        className={`rounded-md px-3 py-1.5 text-sm border ${published ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-line-solid)]'}`}>
        {published ? '✓ Summary published' : 'Publish summary'}
      </button>
      {error && <span className="text-sm text-[var(--color-status-negative)]">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: page.tsx**

```tsx
// apps/dashboard/app/cards/[slug]/page.tsx
// Card Detail 화면. 요약본 본문 + 메타 + reviewed/publish 토글 + 접힘 transcript.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { scanVault } from '../../../lib/scan.js';
import { CardDetailPanel } from '../../../components/CardDetailPanel.js';

export default async function CardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await scanVault(process.env.REPO_LOCAL_PATH!);
  const row = rows.find((r) => r.frontmatter.slug === decodeURIComponent(slug));
  if (!row) return <main className="p-6">카드를 찾을 수 없다.</main>;
  const fm = row.frontmatter;
  const indexBody = readFileSync(join(row.dir, 'index.md'), 'utf8').split('---').slice(2).join('---').trim();
  const sourceFile = fm.platform === 'youtube' ? 'transcript.md' : 'extract.md';
  const sourcePath = join(row.dir, sourceFile);
  const sourceText = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-[var(--color-primary)]">← Review Board</Link>
      <h1 className="mt-3 text-3xl font-bold">{fm.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-label-alternative)]">{fm.platform} · {fm.captured_at.slice(0, 10)}</p>
      <p className="mt-4 text-lg text-[var(--color-label-neutral)]">{fm.summary_one_line}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {fm.tags.map((t) => <span key={t} className="rounded-full bg-[var(--color-bg-alt)] px-2 py-0.5 text-xs">#{t}</span>)}
      </div>
      <div className="mt-6"><CardDetailPanel dir={row.dir} initialReviewed={fm.reviewed} initialPublished={fm.published} /></div>
      <div className="mt-3"><Link href={`/cards/${encodeURIComponent(fm.slug)}/make`} className="text-sm text-[var(--color-primary)]">→ Focused Make Room</Link></div>

      {fm.platform === 'youtube' && fm.youtube && (
        <iframe className="mt-6 aspect-video w-full" src={`https://www.youtube.com/embed/${fm.youtube.video_id}`} allowFullScreen />
      )}
      {fm.platform === 'github' && fm.github && (
        <a href={fm.url} className="mt-6 inline-block text-[var(--color-primary)]" target="_blank" rel="noreferrer">{fm.url}</a>
      )}

      <article className="prose prose-neutral mt-8 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{indexBody}</ReactMarkdown>
      </article>

      <details className="mt-8 rounded-md border border-[var(--color-line-solid)] p-4">
        <summary className="cursor-pointer text-sm font-medium">{sourceFile} 펼치기</summary>
        <pre className="mt-3 max-h-[60vh] overflow-auto text-xs whitespace-pre-wrap">{sourceText}</pre>
      </details>
    </main>
  );
}
```

- [ ] **Step 4: 동작 확인 + 커밋**

```bash
pnpm --filter @zettlink/dashboard dev
# 카드 클릭 → 디테일 페이지 → reviewed 토글 → 컬럼 이동 확인.
git add apps/dashboard/app/cards apps/dashboard/components/CardDetailPanel.tsx apps/dashboard/app/api
git commit -m "feat(dashboard): Card Detail + reviewed/publish summary 토글 (비낙관적)"
```

### Task 3.7: Focused Make Room — 산출물 생성 + 미리보기 + 산출물 publish

**Files.**
- Create: `apps/dashboard/app/cards/[slug]/make/page.tsx`, `apps/dashboard/components/MakeRoomPanel.tsx`, `apps/dashboard/app/api/generate/route.ts`, `packages/core/src/prompts/deep.ts`, `packages/core/src/prompts/til.ts`, `packages/core/src/prompts/guide.ts`

3 개 산출물 모두 동일 패턴.
1. 버튼 클릭.
2. 파일이 있으면 read-only 미리보기.
3. 없으면 LLM 호출 → 파일 생성 (실패 시 부분 파일 작성 금지) → 미리보기 + 발행 토글.

- [ ] **Step 1: 프롬프트 3개 (요약).**

```ts
// packages/core/src/prompts/deep.ts
// 심화 산출물 system 프롬프트. 타임라인/섹션 단위 분해 + 비판적 검토를 요구한다.
export const DEEP_SYSTEM = `당신은 한국어 비판적 분석가다. ...`;
export const DEEP_USER = (transcript: string) => `## 원문\n${transcript}\n\n## 요청\n위 원문을 ...`;
```

`til.ts` 와 `guide.ts` 도 같은 패턴이며 CONTEXT.md 의 정의를 따른다.

- [ ] **Step 2: API route**

```ts
// apps/dashboard/app/api/generate/route.ts
// 산출물(deep / til / guide) 을 LLM 으로 생성하고 카드 폴더에 파일을 만든다. 실패 시 부분 파일을 만들지 않는다.
import { NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { openRepo, commitAndPushWithRetry, serializeArtifact } from '@zettlink/core';
import { DEEP_SYSTEM, DEEP_USER } from '@zettlink/core/dist/prompts/deep.js';
// (til / guide 동일 import)

const PROMPTS = { deep: { sys: DEEP_SYSTEM, user: DEEP_USER }, /* til, guide */ } as const;

export async function POST(req: Request) {
  const { dir, kind } = await req.json() as { dir: string; kind: 'deep' | 'til' | 'guide' };
  const filename = `${kind}.md`;
  const path = join(dir, filename);
  if (existsSync(path)) return NextResponse.json({ ok: true, alreadyExists: true });

  const sourceFile = existsSync(join(dir, 'transcript.md')) ? 'transcript.md' : 'extract.md';
  const transcript = readFileSync(join(dir, sourceFile), 'utf8');
  const cfg = PROMPTS[kind];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 8192,
    system: [{ type: 'text', text: cfg.sys, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: cfg.user(transcript) }],
  });
  const block = resp.content.find((b) => b.type === 'text');
  if (!block) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 502 });

  const md = serializeArtifact({ generated_at: new Date().toISOString(), published: false, llm: { model: 'claude-sonnet-4-6' } }, (block as any).text);
  writeFileSync(path, md, 'utf8');

  const git = openRepo(process.env.REPO_LOCAL_PATH!);
  await commitAndPushWithRetry(git, [path], `add ${kind} ${dir.split('/').pop()}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: MakeRoomPanel.tsx (client)**

```tsx
// apps/dashboard/components/MakeRoomPanel.tsx
// Focused Make Room 의 3 버튼 + 미리보기 + 개별 publish 토글. 실패 시 retry.
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Kind = 'deep' | 'til' | 'guide';
type Status = { exists: boolean; published: boolean; body?: string };

export function MakeRoomPanel({ dir, initial }: { dir: string; initial: Record<Kind, Status> }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function generate(kind: Kind) {
    setError(null);
    const r = await fetch('/api/generate', { method: 'POST', body: JSON.stringify({ dir, kind }) });
    if (!r.ok) { setError(`${kind} 생성 실패.`); return; }
    location.reload();
  }
  async function togglePublish(kind: Kind) {
    const target = state[kind];
    const r = await fetch('/api/publish', { method: 'POST', body: JSON.stringify({ dir, target: kind, value: !target.published }) });
    if (!r.ok) { setError(`${kind} 발행 토글 실패.`); return; }
    setState((s) => ({ ...s, [kind]: { ...s[kind], published: !target.published } }));
  }

  return (
    <div className="space-y-6">
      {(['deep', 'til', 'guide'] as Kind[]).map((kind) => {
        const s = state[kind];
        return (
          <section key={kind} className="rounded-lg border border-[var(--color-line-solid)] bg-white p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold capitalize">{kind}</h3>
              {s.exists ? (
                <button onClick={() => togglePublish(kind)} className={`rounded-md px-3 py-1 text-sm border ${s.published ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-line-solid)]'}`}>
                  {s.published ? '✓ Published' : 'Publish'}
                </button>
              ) : (
                <button onClick={() => generate(kind)} className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-sm text-white">Generate</button>
              )}
            </header>
            {s.exists && s.body && (
              <article className="prose prose-neutral mt-3 max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
              </article>
            )}
          </section>
        );
      })}
      {error && <p className="text-sm text-[var(--color-status-negative)]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: page.tsx**

```tsx
// apps/dashboard/app/cards/[slug]/make/page.tsx
// Focused Make Room. 카드 제목·태그·요약 + Deep/TIL/Guide 3 박스.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArtifact } from '@zettlink/core';
import { scanVault } from '../../../../lib/scan.js';
import { MakeRoomPanel } from '../../../../components/MakeRoomPanel.js';

function readArtifact(dir: string, kind: 'deep' | 'til' | 'guide') {
  const path = join(dir, `${kind}.md`);
  if (!existsSync(path)) return { exists: false, published: false };
  const { frontmatter, body } = parseArtifact(readFileSync(path, 'utf8'));
  return { exists: true, published: frontmatter.published, body };
}

export default async function MakeRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await scanVault(process.env.REPO_LOCAL_PATH!);
  const row = rows.find((r) => r.frontmatter.slug === decodeURIComponent(slug));
  if (!row) return <main className="p-6">카드를 찾을 수 없다.</main>;
  const fm = row.frontmatter;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">{fm.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-label-alternative)]">{fm.platform} · {fm.tags.join(' · ')}</p>
      <p className="mt-4 text-base text-[var(--color-label-neutral)]">{fm.summary_one_line}</p>
      <hr className="my-6 border-[var(--color-line-solid)]" />
      <MakeRoomPanel dir={row.dir} initial={{
        deep: readArtifact(row.dir, 'deep'),
        til: readArtifact(row.dir, 'til'),
        guide: readArtifact(row.dir, 'guide'),
      }} />
    </main>
  );
}
```

- [ ] **Step 5: 통합 동작 확인 + 커밋**

```bash
pnpm --filter @zettlink/dashboard test
git add apps/dashboard/app/cards/[slug]/make apps/dashboard/components/MakeRoomPanel.tsx apps/dashboard/app/api/generate packages/core/src/prompts/{deep,til,guide}.ts
git commit -m "feat(dashboard): Focused Make Room (Deep/TIL/Guide 생성 + 발행)"
```

### Task 3.8: 에러 표시 + malformed 카드 배지

**Files.**
- Modify: `apps/dashboard/lib/scan.ts` (이미 try/catch 로 스킵), `apps/dashboard/components/CardChip.tsx`

`local-dashboard-ui-ux.md` 의 "Error Handling" 명세. malformed card 는 보드에서 빠지면 안 되고 에러 배지를 단 채 보여야 한다.

- [ ] **Step 1: scanVault 가 malformed card 도 `error: string` 필드와 함께 반환하도록 변경.**
- [ ] **Step 2: CardChip 이 `error` 가 있으면 빨간 배지를 그린다.**
- [ ] **Step 3: 테스트 — fixture 에 잘못된 frontmatter 카드 1 개를 두고 보드에 노출되는지 확인.**
- [ ] **Step 4: 커밋**

```bash
git commit -m "feat(dashboard): malformed 카드도 에러 배지로 표시"
```

---

## Phase 4 — apps/blog (Astro 공개 사이트)

`published: true` 카드만 렌더링. 정적 빌드.

### Task 4.1: Astro 셋업 + content collection

**Files.**
- Create: `apps/blog/package.json`, `apps/blog/astro.config.mjs`, `apps/blog/src/content.config.ts`, `apps/blog/src/pages/index.astro`

- [ ] **Step 1 → 4: 셋업, content collection, vault 글롭, 빌드**

```ts
// apps/blog/src/content.config.ts
// vault 의 카드 폴더에서 published=true 인 index.md 만 collection 으로 노출한다.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const cards = defineCollection({
  loader: glob({ pattern: '**/index.md', base: process.env.REPO_LOCAL_PATH + '/sources' }),
  schema: z.object({
    url: z.string(),
    platform: z.enum(['youtube', 'github']),
    slug: z.string(),
    title: z.string(),
    summary_one_line: z.string(),
    tags: z.array(z.string()),
    published: z.boolean(),
    youtube: z.any().optional(),
    github: z.any().optional(),
    // note 는 의도적으로 제외 — 빌드 단계에서 자동 차단.
  }).passthrough(),
});

export const collections = { cards };
```

- [ ] **Step 5: index.astro — published 만 필터**

```astro
---
// apps/blog/src/pages/index.astro
// 공개 카드 리스트.
import { getCollection } from 'astro:content';
const all = await getCollection('cards');
const cards = all.filter((c) => c.data.published).sort((a, b) => b.id.localeCompare(a.id));
---
<html lang="ko"><body>
<h1>zettlink</h1>
<ul>
  {cards.map((c) => <li><a href={`/cards/${c.data.slug}`}>{c.data.title}</a></li>)}
</ul>
</body></html>
```

- [ ] **Step 6: published 필터 단위 테스트**

```ts
// apps/blog/tests/published-filter.test.ts
// 빌드 결과물에 published=false 카드의 본문이 포함되지 않는지 확인.
```

- [ ] **Step 7: `private/` 폴더는 vault loader 패턴에서 제외 + 빌드 시 published 누락 카드 경고**

```js
// apps/blog/astro.config.mjs
export default { /* ... */ vite: { /* private/ 제외 */ } };
```

- [ ] **Step 8: 커밋**

```bash
pnpm --filter @zettlink/blog test
git add apps/blog
git commit -m "feat(blog): Astro 공개 사이트 + published 필터"
```

### Task 4.2: 카드 상세 + 산출물 탭 + Pagefind 검색

- [ ] **Step 1: `src/pages/cards/[slug].astro`** — 카드 요약본 + (`deep.md` / `til.md` / `guide.md` 중 published=true 인 것만) 탭으로.
- [ ] **Step 2: Pagefind 통합** — `astro build` 후 `pagefind --site dist` 실행.
- [ ] **Step 3: 빌드 + Cloudflare 와 연결.**
- [ ] **Step 4: 커밋**

```bash
git commit -m "feat(blog): 카드 상세 + 산출물 탭 + Pagefind 검색"
```

---

## Phase 5 — README + 운영 명령

**Files.**
- Create: `README.md`

- [ ] **Step 1: README 작성** — 사전 조건 (Node 22, pnpm, `brew install yt-dlp`, `.env`, vault repo 경로), 명령어 (`pnpm daemon` / `pnpm dashboard` / `pnpm deploy` / `pnpm blog:build`), 트러블슈팅.

- [ ] **Step 2: 커밋**

```bash
git commit -m "docs: README — 셋업 + 운영 명령"
```

---

## 자체 검토 체크리스트 (실행 전 마지막)

- [ ] `local-dashboard-ui-ux.md` 의 모든 IA 항목이 task 와 매핑되는가? (Review Board / Card Detail / Focused Make Room / 4 컬럼 / 우선순위 / scope / filter / search / 비낙관적 토글 / malformed 카드 표시)
- [ ] DESIGN.md 의 토큰이 dashboard `globals.css` 와 컴포넌트 className 에서 모두 사용되는가?
- [ ] ADR 0001 의 2-레벨 발행 플래그가 frontmatter 스키마 (Task 1.6) 와 publish API (Task 3.6) 양쪽에 반영되는가?
- [ ] 모든 새 TS 파일에 한국어 1-line 헤더가 있는가?
- [ ] 한국어 문장이 콜론으로 끝나지 않는가?
- [ ] 매 task 끝에 commit 이 있는가?
- [ ] core 의 함수 시그니처가 daemon / dashboard / blog 에서 동일한 이름으로 호출되는가? (`writeCard`, `listCards`, `commitAndPushWithRetry`, `parseIndex`, `parseArtifact`, `serializeIndex`, `serializeArtifact`)
- [ ] context-notes.md 에 새 결정 두 가지 (`reviewed` 필드 도입 / 2-레벨 발행 플래그 frontmatter 스키마) 가 append 되었는가? — **이 작업은 구현 시작 직전에 별도 commit 으로 추가할 것.**

---

## Execution Handoff

이 plan 은 다음 두 가지 방식으로 실행할 수 있다.

**1. Subagent-Driven (권장).** 매 task 마다 새 subagent 를 dispatch 하고, task 사이에 두 단계 review 를 거친다. 빠른 iteration + clean context.
**2. Inline Execution.** 같은 세션에서 batch 실행 + 체크포인트 review.

**Subagent-Driven 선택 시.** REQUIRED SUB-SKILL `superpowers:subagent-driven-development`.
**Inline 선택 시.** REQUIRED SUB-SKILL `superpowers:executing-plans`.

어느 쪽이든 Phase 1 + 2 가 끝나면 한 번 멈추고 실제 Telegram URL 로 smoke test 를 한 뒤 Phase 3 / 4 로 넘어가자.
