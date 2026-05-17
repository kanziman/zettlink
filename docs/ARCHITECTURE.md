# 아키텍처

## 0. 토폴로지 개요

```
                  Mobile (Telegram)
                        │ URL
                        ▼
                ┌──────────────────┐
                │ Bot (Telegraf)   │  Mac 로컬 데몬, long polling, whitelist
                │ - parse + insert │
                └──────────┬───────┘
                           │ INSERT INTO jobs
                           ▼
        ╔══════════════════════════════════════════════╗
        ║  Supabase  (Postgres + Auth) — primary store ║
        ║  • auth.users  (admin 1명, RLS)              ║
        ║  • cards / tags / card_tags / jobs / events  ║
        ╚══════════════════════╤═══════════════════════╝
                               │ pick_next_job() RPC
                               ▼
                ┌──────────────────┐
                │ Worker (Mac)     │  service_role key (RLS 우회)
                │  normalize URL   │
                │  → extract       │  yt-dlp / GH API
                │  → LLM           │  Claude Sonnet 4.6 (tool_use)
                │  → tag normalize │
                │  → vault export  │  Supabase → .md (옵션)
                │  → git push      │  vault backup channel
                └──────────┬───────┘
                           │ status=done, event 기록
                           ▼
                ┌──────────────────┐
                │ Bot reply        │  ✅ <title> (<slug>)
                └──────────────────┘

PUBLIC (Vercel — admin-gated):  apps/dashboard
   ├─ /login (Supabase Auth UI)
   ├─ middleware.ts (session + user_id whitelist)
   ├─ 카드 리스트·필터·검색·심화·publish 토글
   └─ /monitor (비용·큐·에러)

PUBLIC (Vercel — anonymous read):  apps/site
   ├─ generateStaticParams() : Supabase WHERE published=true
   ├─ MDX 렌더 + Pagefind 검색
   └─ `pnpm deploy` → Vercel deploy hook POST
```

## 1. 디렉토리 구조 (pnpm workspace)

```
zettlink/
├── apps/
│   ├── bot/                 # Telegraf 데몬 (Mac, launchd)
│   ├── worker/              # 작업 처리 데몬 (Mac, launchd)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── extractors/{youtube,github}.ts
│   │       ├── llm/{summarize,enrich,tag-normalize}.ts
│   │       ├── vault/{write,git}.ts
│   │       └── retry.ts
│   ├── dashboard/           # Next.js 15 → Vercel (admin-gated)
│   │   ├── app/
│   │   │   ├── login/page.tsx
│   │   │   ├── auth/callback/route.ts
│   │   │   ├── (admin)/{layout,page,cards/[slug]/page,monitor/page}.tsx
│   │   │   └── api/{enrich,publish,reprocess}/route.ts
│   │   ├── middleware.ts    # session + admin user_id whitelist
│   │   └── lib/supabase/
│   └── site/                # Next.js 15 → Vercel (공개)
│       ├── app/
│       │   ├── page.tsx
│       │   ├── [platform]/[slug]/page.tsx
│       │   └── tags/[tag]/page.tsx
│       └── lib/cards.ts     # 빌드 타임 Supabase 조회
├── packages/
│   ├── db/                  # Supabase 클라이언트 + types.gen.ts
│   ├── shared/              # url-normalize, slug, config, types
│   ├── ui/                  # DESIGN.md 토큰 기반 공유 컴포넌트
│   └── prompts/             # LLM 프롬프트 *.md
├── supabase/
│   ├── config.toml
│   ├── migrations/0001_init.sql
│   └── seed.sql
├── vault/                   # Supabase → .md export (backup·이식)
│   ├── youtube/<slug>/{index,transcript,deep,til,guide}.md
│   └── github/<slug>/{index,extract,deep,til,guide}.md
├── scripts/
│   ├── deploy-{site,dashboard}.ts
│   ├── export-vault.ts / import-vault.ts
│   └── gen-types.sh
├── logs/                    # pino JSONL (gitignored)
└── docs/                    # PRD/ARCHITECTURE/ADR/DESIGN/BEFORE_PLAN
```

## 2. 데이터 모델 (Postgres, supabase/migrations/0001_init.sql)

핵심 테이블:

- `cards` — slug PK, `url` UNIQUE, `(platform, external_id)` UNIQUE, `status`/`published`/`has_{deep,til,guide}`, `tokens_used`/`cost_usd`, timestamps.
- `tags` — `canonical_name` UNIQUE + `aliases jsonb` + `usage_count`.
- `card_tags` — M:N 조인.
- `jobs` — 영속 큐. `pick_next_job()` RPC가 `FOR UPDATE SKIP LOCKED`로 race-safe 픽업.
- `events` — 모든 단계 구조화 로그 (`type`, `data jsonb`).

**RLS 정책:**

- `anon` — `cards WHERE published=true`만 select. site 빌드 anon 키 사용.
- `authenticated` — 전체 select. dashboard 서버 클라이언트가 session jwt 사용, app 단에서 `user_id ∈ ADMIN_USER_IDS` 추가 검증.
- write — `service_role`만 (worker + dashboard Server Actions). RLS 우회.

## 3. 데이터 흐름

### 3.1. 캡처 → 카드

1. Bot이 whitelisted user_id의 URL 수신.
2. `INSERT INTO jobs (raw_url, status='queued')` (service_role).
3. Bot이 "⏳ queued #N" 즉시 회신.
4. Worker가 `pick_next_job()` RPC로 잡 픽업 (status='processing').
5. URL canonical 정규화 (`packages/shared/url-normalize.ts`).
6. `UPSERT cards (platform, external_id)` — 존재하고 `!force`면 skip.
7. 플랫폼별 extract (yt-dlp / GH API). YouTube는 `manual ko → auto ko-orig/ko → manual en → manual all → description fallback` 순으로 텍스트를 선택하고 source를 기록한다.
8. Claude Sonnet 4.6 호출 (tool_use 구조 출력: summary/insights/tags).
9. Tag canonical 매칭 + UPSERT.
10. (옵션) vault/.md export (atomic temp+rename) + git push.
11. `UPDATE cards SET status='done'`, `INSERT events`.
12. Bot이 "✅ <title> (<slug>)" 회신.

### 3.2. 심화 (deep / TIL / guide)

Dashboard 클릭 → `/api/enrich` Server Action → Supabase SELECT → LLM 호출 → vault write → `UPDATE cards SET has_<type>=true` → git push.

### 3.3. 발행

Dashboard publish 토글 → `UPDATE cards SET published=true` → (옵션) Vercel deploy hook POST → site 재빌드 → published 카드만 generateStaticParams.

## 4. 실패 모드 & 복구

| 단계 | 시나리오 | 처리 |
|---|---|---|
| Bot poll | Telegram 다운 | telegraf 재연결, launchd 자동 재시작 |
| Worker crash mid-job | `picked_at` > 30분 | reaper가 queued로 복귀 |
| LLM 5xx / rate limit | exp backoff | 3회 재시도 |
| LLM 비용 가드 초과 | 사전 체크 | jobs status='dead', bot 알림 |
| Supabase 429 / 네트워크 | HTTP code | exp backoff 3회 |
| Supabase 403 (RLS) | 즉시 감지 | hard fail, 서버 misconfig 알림 |
| YouTube subtitle 다운로드 실패 | yt-dlp exit/stderr | 다음 subtitle 후보를 시도하고, 모두 실패하면 description fallback + source 기록 |
| Git push conflict | exit code | `git pull --rebase` + 1회 재시도 |
| Dashboard 미인증 | middleware | `/login` 리다이렉트 |
| Dashboard 비-admin | middleware | 403 + events log |

모든 단계가 (a) 테스트 가능, (b) 에러 핸들링 있음, (c) 사용자에게 명시적 알림 — silent failure 없음.

## 5. 관측성

- **`events` 테이블** — 매 단계 1 row. `data jsonb`에 cost/tokens/duration/error 기록.
- **YouTube extract event** — `transcript_source`와 `subtitle_failures`를 기록해 description fallback과 yt-dlp 429 등을 추적.
- **`pino`** — `logs/zettlink-YYYY-MM-DD.log` (JSONL).
- **Dashboard `/monitor`** — 오늘/이번달 LLM 비용, 큐 깊이, 최근 실패 10건, 처리 시간 분포.
- **Supabase Studio SQL 콘솔** — ad-hoc 분석.
- **비용 가드** — LLM 호출 직전 `SELECT sum((data->>'cost_usd')::numeric) FROM events WHERE type='llm.call' AND ts > current_date` 체크.

## 6. 패턴

- Next.js 15 App Router, Server Components 기본. 인터랙션이 필요한 곳만 `'use client'`.
- 대시보드 데이터 페칭: Server Component에서 Supabase `createServerClient` (session jwt) 사용.
- 사이트 데이터 페칭: 빌드 타임에 `createClient` (anon key)로 `cards WHERE published=true` 조회, `generateStaticParams`로 정적 페이지 생성.
- Worker는 `createServiceClient` (service_role key)로 RLS 우회.

## 7. 상태 관리

- 영속 상태: Supabase Postgres (단일 진실).
- 빌드 산출물: vault/.md (옵션, backup/이식).
- 클라이언트 상태: 대시보드 페이지 내 form state는 `useState`/`useReducer`. 서버에 영향이 있으면 Server Action.

## 8. 환경 변수 (.env)

| 키 | 사용처 |
|---|---|
| `SUPABASE_URL` | 모든 앱 |
| `SUPABASE_ANON_KEY` | site (빌드), dashboard 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | worker, bot, dashboard 서버 |
| `ADMIN_USER_IDS` | dashboard middleware (콤마 구분 user_id 리스트) |
| `TELEGRAM_BOT_TOKEN` | bot |
| `TELEGRAM_WHITELIST` | bot (콤마 구분 chat_id) |
| `ANTHROPIC_API_KEY` | worker |
| `GITHUB_TOKEN` | worker (rate limit 우회) |
| `VERCEL_DEPLOY_HOOK_SITE` | scripts/deploy-site.ts |
| `VERCEL_DEPLOY_HOOK_DASHBOARD` | scripts/deploy-dashboard.ts (옵션) |

## 9. 배포

- **Supabase** — `supabase db push`로 마이그레이션 적용. Free tier 충분.
- **apps/dashboard** — Vercel 프로젝트 rootDirectory=`apps/dashboard`, GitHub auto-deploy ON. 환경변수 등록.
- **apps/site** — Vercel 프로젝트 rootDirectory=`apps/site`, GitHub auto-deploy **OFF**, deploy hook **ON**. `pnpm deploy`로 수동 트리거.
- **bot/worker** — Mac launchd plist (auto-restart). `logs/`에 stdout/stderr 캡처.

---

*최종 갱신: 2026-05-17. 이 문서는 [BEFORE_PLAN.md](BEFORE_PLAN.md)를 supersede합니다.*
