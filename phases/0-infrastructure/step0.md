# Step 0: workspace-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `CLAUDE.md` — 기술 스택, CRITICAL 규칙, 명령어
- `docs/ARCHITECTURE.md` — 디렉토리 구조(§1), 환경 변수 목록(§8)
- `docs/ADR.md` — ADR-015(단일 monorepo), ADR-003(Next.js 15)

## 작업

pnpm workspace monorepo 뼈대를 생성하라. 이 step에서는 소스 코드를 작성하지 않는다. 폴더 구조와 설정 파일만 만든다.

### 생성할 파일

**루트**

- `pnpm-workspace.yaml` — `apps/*`와 `packages/*`를 workspace로 선언
- `tsconfig.base.json` — 모든 패키지가 extends하는 기반 설정
  - `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `esModuleInterop: true`, `skipLibCheck: true`
- `package.json` (루트) — `private: true`, Node 22 engines, 공통 devDependencies(`typescript`, `@types/node`), scripts(`build`, `test`, `lint`, `typecheck`, `gen-types`)
- `.gitignore` — 반드시 포함: `logs/`, `.env`, `.env.*`, `!.env.example`, `.vercel/`, `.next/`, `node_modules/`, `dist/`
- `.env.example` — 아래 키를 모두 포함하고 값은 빈 문자열 또는 설명 placeholder:
  ```
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ADMIN_USER_IDS=
  TELEGRAM_BOT_TOKEN=
  TELEGRAM_WHITELIST=
  ANTHROPIC_API_KEY=
  GITHUB_TOKEN=
  VERCEL_DEPLOY_HOOK_SITE=
  VERCEL_DEPLOY_HOOK_DASHBOARD=
  ```

**apps/ 하위 (각각 최소 package.json만)**

- `apps/bot/package.json` — name: `@zettlink/bot`, type: `module`
- `apps/worker/package.json` — name: `@zettlink/worker`, type: `module`
- `apps/dashboard/package.json` — name: `@zettlink/dashboard`, type: `module`
- `apps/site/package.json` — name: `@zettlink/site`, type: `module`

**packages/ 하위 (각각 package.json + tsconfig.json)**

- `packages/db/` — name: `@zettlink/db`, main: `./src/index.ts`
- `packages/shared/` — name: `@zettlink/shared`, main: `./src/index.ts`
- `packages/ui/` — name: `@zettlink/ui`, main: `./src/index.ts`
- `packages/prompts/` — name: `@zettlink/prompts`

각 package의 `tsconfig.json`은 루트 `tsconfig.base.json`을 extends하라.

### 주의사항

- 소스 파일(`.ts`)은 이 step에서 만들지 마라. 설정 파일과 빈 디렉토리만.
- `packages/db/src/`, `packages/shared/src/` 등 src 폴더는 빈 상태로 생성해도 된다.
- apps/dashboard, apps/site는 Next.js 프로젝트이므로 `package.json`에 `next`, `react`, `react-dom` dependency를 명시하라. 실제 설치는 `pnpm install`이 처리한다.

## Acceptance Criteria

```bash
# workspace 인식 확인
pnpm install
pnpm -r ls
# → @zettlink/bot, @zettlink/worker, @zettlink/dashboard, @zettlink/site,
#    @zettlink/db, @zettlink/shared, @zettlink/ui, @zettlink/prompts 목록 출력

# .gitignore 확인
grep -E "^\.env$" .gitignore   # → .env
grep -E "^logs/$" .gitignore   # → logs/
```

## 금지사항

- 소스 코드(.ts, .tsx)를 이 step에서 작성하지 마라. 다음 step에서 한다.
- `pnpm install` 후 lock file(pnpm-lock.yaml)은 커밋에 포함하라. 삭제하지 마라.
- 기존 파일(`scripts/execute.py`, `docs/*.md`, `CLAUDE.md`)을 수정하지 마라.
