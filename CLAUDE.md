# 프로젝트: zettlink

YouTube/GitHub URL을 Telegram에 던지면 Claude Sonnet 4.6이 요약·태그·인사이트를 만들고, 검토 후 공개 사이트에 발행하는 1인 지식 관리 도구.

## 기술 스택

- **언어/런타임:** TypeScript (strict mode), Node 22, ESM, pnpm workspace
- **Bot/Worker (Mac 로컬, launchd):** Telegraf, yt-dlp, `@anthropic-ai/sdk`, pino
- **DB:** Supabase Postgres + Auth (`@supabase/supabase-js v2`), 타입은 `supabase gen types`로 자동 생성
- **Dashboard (Vercel, admin-gated):** Next.js 15 App Router, Tailwind, Server Components 기본
- **Site (Vercel, 공개):** Next.js 15 SSG (`generateStaticParams`), MDX, Pagefind
- **공유 UI:** packages/ui (DESIGN.md = Wanted Montage 기반, Pretendard, semantic 토큰)
- **LLM:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) 단일, tool_use 구조 출력

## 아키텍처 규칙

- **CRITICAL: 모든 DB 접근은 `packages/db`의 클라이언트를 통해서만 한다.** worker/bot은 `createServiceClient` (service_role), dashboard 서버 코드는 `createServerClient` (session jwt), dashboard 클라이언트는 `createBrowserClient` (anon). 각 앱에서 raw `createClient` 호출 금지.
- **CRITICAL: 클라이언트 컴포넌트에서 Supabase service_role 키를 절대 노출하지 않는다.** `NEXT_PUBLIC_` prefix는 anon key에만 허용.
- **CRITICAL: 대시보드 모든 라우트는 `apps/dashboard/middleware.ts`에서 admin user_id whitelist를 통과해야 한다.** `/login`·`/auth/callback`만 예외.
- **CRITICAL: URL은 항상 `packages/shared/url-normalize.ts`의 `canonicalize()`를 거친 후 DB에 저장한다.** raw URL을 cards에 직접 쓰지 않는다.
- **CRITICAL: 모든 LLM 호출 전 `events`에서 오늘자 cost 합산해 `config.budget.daily_usd` cap을 체크한다.** 초과 시 즉시 jobs `dead` + bot 알림.
- **CRITICAL: vault/.md write는 atomic (temp+rename)으로만.** worker가 mid-write 죽어도 vault는 절대 일관성 깨지지 않음.
- 컴포넌트는 `packages/ui`에 두고 두 앱에서 공유. 앱 로컬 컴포넌트는 `apps/<app>/components/`.
- 타입은 `packages/shared/types.ts` + 자동 생성된 `packages/db/types.gen.ts`. 새 타입을 만들기 전에 두 곳 모두 검색.
- API 로직 (외부 호출, DB write)은 worker의 `apps/worker/src/` 또는 dashboard의 `app/api/*/route.ts`에서만. 컴포넌트에서 직접 외부 API를 호출하지 않는다.

## 개발 프로세스

- **CRITICAL: 새 기능은 TDD.** 단위 테스트 먼저 작성, 통과하는 구현. `packages/shared` (url-normalize, slug, tag-normalize)는 단위 테스트 100% 커버.
- **CRITICAL: 커밋 메시지는 Conventional Commits.** `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. 한 커밋 = 한 논리 단위.
- **CRITICAL: 마이그레이션은 `supabase/migrations/`에 새 파일로만.** 기존 마이그레이션 수정 금지. 적용 후 `pnpm gen-types`로 `packages/db/types.gen.ts` 재생성.
- **CRITICAL: React 컴포넌트·훅·페이지를 생성하거나 수정할 때 반드시 `/react-best-practices` 스킬을 먼저 호출한다.** `packages/ui`, `apps/dashboard`, `apps/site` 내 모든 `.tsx` 파일에 적용.
- 새 파일 첫 줄에 한국어 1줄 주석으로 역할 설명 (TypeScript: `// ...`, SQL: `-- ...`). 설정 파일은 제외.
- Phase 0 끝나면 docs/PRD/ARCHITECTURE/ADR이 최신인지 확인. 변경 시 같은 PR에 docs 업데이트 포함.

## 명령어

```bash
# 개발
pnpm install                              # 모든 워크스페이스 의존성
pnpm --filter dashboard dev               # 대시보드 로컬
pnpm --filter site dev                    # 공개 사이트 로컬
pnpm --filter bot dev                     # bot 로컬 실행
pnpm --filter worker dev                  # worker 로컬 실행

# Supabase
supabase start                            # 로컬 컨테이너 (개발용)
supabase db push                          # 마이그레이션 적용
pnpm gen-types                            # types.gen.ts 재생성

# 빌드 & 검증
pnpm build                                # 모든 앱 빌드
pnpm test                                 # 모든 단위/통합 테스트
pnpm lint                                 # ESLint
pnpm typecheck                            # tsc --noEmit (전 워크스페이스)

# 배포
pnpm deploy                               # site Vercel deploy hook POST
# 또는 cd apps/site && vercel --prod
# dashboard는 GitHub push로 Vercel 자동 deploy

# 데몬 (Mac launchd)
launchctl load ~/Library/LaunchAgents/com.zettlink.bot.plist
launchctl load ~/Library/LaunchAgents/com.zettlink.worker.plist
launchctl list | grep zettlink

# 데이터 복구
pnpm tsx scripts/export-vault.ts          # Supabase → vault/.md
pnpm tsx scripts/import-vault.ts          # vault/.md → Supabase
```

## 참고 문서

- [docs/PRD.md](docs/PRD.md) — 제품 정의
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 아키텍처 (BEFORE_PLAN.md를 supersede)
- [docs/ADR.md](docs/ADR.md) — 핵심 결정 15개
- [docs/DESIGN.md](docs/DESIGN.md) — Wanted Montage 디자인 시스템
- [docs/UI_GUIDE.md](docs/UI_GUIDE.md) — UI 가이드
- [docs/BEFORE_PLAN.md](docs/BEFORE_PLAN.md) — 초기 계획 (deprecated, 참고용)
- [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) — PO + Reviewer 2-에이전트 사이클 (Phase 구현 가이드)
