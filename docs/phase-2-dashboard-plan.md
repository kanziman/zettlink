# Phase 2 — Dashboard 구현 계획

## 목표

admin-gated Next.js 15 대시보드를 구현한다. Supabase Auth 로그인 후 ADMIN_USER_IDS whitelist를 통과한 사용자만 접근할 수 있으며, 카드 리스트 탐색·심화 요약 생성·publish 토글·시스템 모니터 기능을 제공한다.

## 핵심 결정

- **card.id = slug** — `titleToSlug(title)` / `repoToSlug(externalId)` 결과가 PK. 라우트는 `/cards/[slug]`.
- **인증 흐름** — Supabase email/password → middleware에서 session 검증 + user.id ∈ ADMIN_USER_IDS. 비-admin은 403.
- **서버 컴포넌트 기본** — 데이터 조회는 Server Component + `createServerClient(cookies())`. 버튼 인터랙션만 Client Component.
- **packages/ui** — Tailwind CSS 4 + DESIGN.md semantic 토큰. Button, Badge, Tag, CardRow 4개 컴포넌트.
- **enrich API** — Claude Sonnet 4.6 직접 호출 (`@anthropic-ai/sdk`). 비용 가드 체크 후 deep/til/guide 중 하나 생성. vault atomic write + DB 업데이트.
- **reprocess** — 기존 card url로 새 job INSERT (force=true). worker가 다음 poll에 픽업.
- **Vercel 배포** — rootDirectory=apps/dashboard, env vars 목록 문서화.

## Step별 구현 순서

### Step 0 — scaffold
- `apps/dashboard/` 아래 Next.js 15 App Router 기본 구조 생성
- 의존성: `next@^15`, `react@^19`, `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `tailwindcss@^4`
- `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- `app/layout.tsx` — root layout, ThemeProvider, `<html lang="ko">`
- `app/globals.css` — DESIGN.md semantic 토큰을 CSS 변수로 (`--color-label-normal` 등)
- `tsconfig.json` extends `tsconfig.base.json`
- 검증: `pnpm --filter dashboard build` 성공

### Step 1 — auth
- `middleware.ts` — matcher: `/((?!login|auth|_next).*)`, session 없으면 `/login` redirect, session 있으면 user.id ∈ config.adminUserIds 확인, 불일치 시 403 plain text
- `app/login/page.tsx` — email + password form (Client Component), `supabase.auth.signInWithPassword()`, 성공 시 `/` redirect
- `app/auth/callback/route.ts` — `code` 쿼리 파라미터 → `exchangeCodeForSession()` → `/` redirect (magic link / OAuth 대비)
- `lib/supabase/server.ts` — `createServerClient(await cookies())` 래퍼 (Route Handler용은 읽기+쓰기 가능 버전)
- 검증: 미인증 → /login, 비-admin → 403, admin → 통과

### Step 2 — packages/ui
- `packages/ui/package.json` — peerDeps: react@^19, tailwindcss@^4
- `packages/ui/src/Button.tsx` — variant(primary/ghost/danger), size(sm/md)
- `packages/ui/src/Badge.tsx` — status badge (done/failed/pending/processing → 색상 매핑)
- `packages/ui/src/Tag.tsx` — 태그 chip (클릭 가능 여부 선택)
- `packages/ui/src/CardRow.tsx` — 카드 리스트 행 (title, platform, status, created_at, tags)
- `packages/ui/src/index.ts` — re-export
- 검증: `pnpm --filter @zettlink/ui build` 성공

### Step 3 — card list (메인 페이지)
- `app/(admin)/layout.tsx` — top nav (로고, /monitor 링크, 로그아웃 버튼), admin guard (서버에서 재확인)
- `app/(admin)/page.tsx` — Server Component
  - searchParams: `q` (제목/URL ilike), `tag` (태그 필터), `status` (done/failed/all)
  - Supabase: `cards` LEFT JOIN `card_tags` JOIN `tags` WHERE tag=? AND title ilike ?
  - 최신순 50개 (cursor pagination은 Phase 4+)
  - `<form>` 검색 바 (GET 방식, searchParams 반영)
  - `<CardRow>` 리스트, 각 행 클릭 → `/cards/[slug]`
- 검증: 카드 리스트 표시, 검색 동작, 태그 필터 동작

### Step 4 — card detail
- `app/(admin)/cards/[slug]/page.tsx` — Server Component
  - Supabase: `cards` JOIN `card_tags` JOIN `tags` WHERE id = slug
  - 없으면 notFound()
  - 상단: title, url, platform badge, status badge, created_at
  - 본문: summary, insights (bullets), tags
  - 액션 버튼 (Client Component):
    - "심화 요약" → POST /api/enrich {id, type:'deep'} (has_deep=false일 때만 활성)
    - "TIL" → POST /api/enrich {id, type:'til'}
    - "가이드" → POST /api/enrich {id, type:'guide'}
    - "Publish" / "Unpublish" 토글 → POST /api/publish {id}
    - "재처리" → POST /api/reprocess {id}
  - vault 링크: vault_path가 있으면 파일 경로 표시
- 검증: 카드 상세 렌더, 버튼 클릭 시 API 호출 후 상태 반영

### Step 5 — monitor
- `app/(admin)/monitor/page.tsx` — 30초 자동 갱신 (Client Component, `useEffect` + `router.refresh()`)
  - 오늘 비용: `SELECT SUM(cost_usd) FROM cards WHERE created_at >= today`
  - 큐 현황: jobs by status count
  - 최근 이벤트: `events` 최신 30개 (type, level, card_id, ts, data 요약)
  - budget daily_usd 대비 진행률 표시
- 검증: 페이지 로드 후 데이터 표시, 30초마다 갱신

### Step 6 — API routes
- `app/api/enrich/route.ts` — POST {id, type}
  - session 검증 + admin 확인
  - 비용 가드: 오늘 cost_usd SUM ≥ budget.dailyUsd → 400
  - Supabase SELECT card
  - vault에서 transcript/README 텍스트 로드 (fs.readFile, vault_path 기준)
  - Claude Sonnet 4.6 호출 (deep/til/guide 프롬프트)
  - vault atomic write (deep.md / til.md / guide.md)
  - DB UPDATE: has_deep/has_til/has_guide = true, updated_at
  - events INSERT: type='enrich.done'
  - 응답: {ok: true, content: string}

- `app/api/publish/route.ts` — POST {id}
  - session 검증 + admin 확인
  - Supabase UPDATE cards SET published = NOT published WHERE id = ?
  - 응답: {ok: true, published: boolean}

- `app/api/reprocess/route.ts` — POST {id}
  - session 검증 + admin 확인
  - Supabase SELECT card.url
  - INSERT INTO jobs (raw_url=url, status='queued', force=true)
  - 응답: {ok: true, jobId: number}

- 검증: 각 엔드포인트 인증 없이 → 401, 정상 흐름 → 기대 응답

### Step 7 — Vercel 배포 설정
- `apps/dashboard/vercel.json` — `{framework: "nextjs"}`  (rootDirectory는 Vercel 프로젝트 설정으로)
- `.env.example` 에 dashboard 필요 env 추가 확인:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`
  - `ANTHROPIC_API_KEY` (enrich에서 사용)
- `scripts/deploy-dashboard.ts` — Vercel deploy hook POST (site와 동일 패턴)
- Vercel 프로젝트 생성 지침 (docs 주석)
- 검증: `pnpm --filter dashboard build` 로컬 성공

## Gate 1 검증 기준

1. middleware가 session 없으면 /login redirect, session 있어도 ADMIN_USER_IDS에 없으면 403을 반환하는가?
2. enrich route가 LLM 호출 전 오늘 비용 합산 체크를 수행하는가?
3. publish route가 service_role 없이 session JWT 기반 서버 클라이언트를 사용하는가? (NEXT_PUBLIC_ prefix는 anon key에만)
4. packages/ui 컴포넌트가 DESIGN.md semantic 토큰 CSS 변수를 사용하는가?
5. Server Component에서 external API 직접 호출 없이 Supabase 조회만 하는가?

## Gate 2 검증 기준

1. 미인증 요청 → /login 리다이렉트가 동작하는가?
2. 비-admin user_id → 403이 반환되는가?
3. admin 로그인 → 카드 리스트 표시되는가?
4. enrich 호출 → DB has_deep/has_til/has_guide=true로 업데이트되는가?
5. publish 토글 → DB published 값이 반전되는가?
6. reprocess → jobs에 새 행이 queued 상태로 INSERT되는가?
7. NEXT_PUBLIC_ prefix가 아닌 service_role 키가 클라이언트 번들에 포함되지 않는가?
8. 새 TypeScript 파일 첫 줄에 한국어 역할 주석이 있는가?
