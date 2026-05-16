# 에이전트 워크플로우: PO + Reviewer 패턴

zettlink 각 Phase를 구현할 때 사용하는 2-에이전트 사이클. PO가 전체 컨텍스트를 보유하고 처음부터 끝까지 직접 구현하며, Reviewer는 2회의 게이트 시점에만 독립적으로 개입한다.

---

## 사이클 구조

```
[1] PO — 플랜 작성
      │  (Phase 체크리스트 + 아키텍처 문서 기반)
      ▼
[2] Reviewer (/codex:review)
      │  플랜 파일 커밋 기준 → APPROVED or 수정 목록
      ▼
[3] PO — 전체 구현
      │  항목별 커밋, 중간 핸드오프 없음
      ▼
[4] Reviewer (/codex:review)
      │  전체 diff 기준 → APPROVED or 수정 목록
      ▼
    완료 → 다음 Phase
```

---

## 역할 정의

### PO (Product Owner)

- **컨텍스트:** `CLAUDE.md` + `docs/ARCHITECTURE.md` + `docs/ADR.md` + Phase 체크리스트 전문 보유.
- **책임:** 플랜 작성 → 게이트 1 통과 → 구현 전체 → 게이트 2 통과.
- **제약:** 중간에 다른 에이전트에게 위임하지 않는다. 핸드오프가 없어야 컨텍스트 손실이 없다.
- **커밋:** 체크리스트 항목 1개 완료 = 커밋 1개. Conventional Commits 형식.
- **스킬:** React 컴포넌트·훅·페이지(`.tsx`)를 작성하기 전에 반드시 `/react-best-practices`를 먼저 호출한다. `packages/ui`, `apps/dashboard`, `apps/site` 내 모든 UI 작업에 적용.

### Reviewer

- **도구:** `/codex:review` (독립 세션, Claude와 다른 모델).
- **개입 횟수:** 정확히 2회 (게이트 1, 게이트 2).
- **역할:** "기준 충족 여부 확인". 왜 이 방향인지는 PO가 판단하고, Reviewer는 코드 품질과 CRITICAL 규칙 위반 여부만 본다.
- **출력:** `APPROVED` or 수정 사항 목록.

---

## 게이트 1 — 플랜 승인

PO가 구현 플랜을 `docs/phase-N-plan.md`에 작성하고 커밋한 뒤 Reviewer를 호출한다.

```bash
# PO
git add docs/phase-N-plan.md
git commit -m "plan: Phase N implementation plan"

# Reviewer
/codex:review
```

플랜에 포함해야 할 내용:
- 구현 순서 (체크리스트 항목별)
- 각 단계의 검증 방법
- 생성될 파일 목록
- CLAUDE.md CRITICAL 규칙과의 충돌 여부 확인

**피드백 루프:** 수정 요청이 오면 PO가 플랜 수정 → 재커밋 → `/codex:review` 재실행.

---

## 게이트 2 — 결과 검토

Phase 구현 전체가 완료된 후 호출한다.

```bash
/codex:review
```

Reviewer가 확인하는 항목:

| 항목 | 검출 근거 |
|---|---|
| `service_role` 키를 클라이언트 컴포넌트에서 사용 | `NEXT_PUBLIC_` prefix + service_role 키 조합 |
| `createClient` 직접 호출 (packages/db 우회) | import 경로 |
| raw URL을 canonicalize 없이 DB에 저장 | `canonicalize()` 미호출 |
| LLM 호출 전 비용 가드 누락 | events SUM 쿼리 부재 |
| vault write가 atomic하지 않음 | temp+rename 패턴 누락 |
| 단위 테스트 누락 (100% 필수 모듈) | `url-normalize`, `slug`, `tag-normalize` |
| 마이그레이션 기존 파일 수정 | git diff 기준 |
| Conventional Commits 미준수 | 커밋 메시지 형식 |

**피드백 루프:** 이슈 발견 시 PO 수정 → 재커밋 → `/codex:review` 재실행 → `APPROVED`이면 다음 Phase.

---

## Phase별 PO 프롬프트 템플릿

각 Phase 시작 시 아래 템플릿으로 PO 세션을 시작한다.

### Phase 0 — 인프라

```
당신은 PO입니다. 다음 컨텍스트를 모두 읽고 Phase 0을 처음부터 끝까지 직접 구현하라.

## 컨텍스트 (전문 첨부)
- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/ADR.md

## Phase 0 체크리스트
- pnpm workspace 셋업 (apps/*, packages/*, pnpm-workspace.yaml)
- tsconfig.base.json (strict, ESM, Node 22 타겟)
- supabase/migrations/0001_init.sql (schema + RLS + pick_next_job() RPC)
- supabase db push + supabase gen types → packages/db/types.gen.ts
- packages/db/client.ts (createServiceClient, createServerClient, createBrowserClient)
- packages/shared/config.ts (zod 기반 .env 검증)
- packages/shared/types.ts (Card, Job, Event 타입)
- packages/shared/url-normalize.ts + 단위 테스트 (YouTube/GitHub 변형 100% 커버)
- packages/shared/slug.ts + 단위 테스트
- launchd plist 2개 (com.zettlink.bot.plist, com.zettlink.worker.plist)
- .env.example
- .gitignore (logs/, .env, .vercel/, .next/, node_modules/)

## 규칙
- 체크리스트 항목 완료 시마다 커밋 (Conventional Commits)
- 새 파일 첫 줄: 한국어 1줄 역할 주석
- 단위 테스트 먼저 작성, 그 다음 구현
- 중간에 다른 에이전트에 위임하지 않는다

## 시작
먼저 docs/phase-0-plan.md에 구현 순서와 검증 방법을 작성하라.
작성 완료 후 커밋하면 Reviewer(/codex:review)가 플랜을 검토한다.
```

### Phase 1 — 캡처 → 카드

```
당신은 PO입니다. Phase 1을 처음부터 끝까지 직접 구현하라.

## 컨텍스트 (전문 첨부)
- CLAUDE.md, docs/ARCHITECTURE.md, docs/ADR.md
- Phase 0 결과물 (packages/db/client.ts, packages/shared/*)

## Phase 1 체크리스트
- apps/bot/src/index.ts (Telegraf, whitelist, INSERT jobs)
- apps/worker/src/index.ts (pick_next_job() 폴링 + reaper + dispatcher)
- apps/worker/src/extractors/youtube.ts (yt-dlp wrapper)
- apps/worker/src/extractors/github.ts (GH API)
- apps/worker/src/llm/summarize.ts (Claude SDK, tool_use 구조 출력)
- apps/worker/src/llm/tag-normalize.ts (alias 매칭 + UPSERT)
- apps/worker/src/vault/write.ts (atomic temp+rename)
- apps/worker/src/vault/git.ts (commit + push)
- apps/worker/src/retry.ts (exp backoff: 1m, 5m, 30m)
- events 로그 전 단계
- LLM 호출 전 비용 가드 (daily_usd cap)
- bot 알림 (queued / done / fail / already-exists / dead)

## E2E 검증 기준
1. YouTube URL → "queued" → "✅" + Supabase row 생성
2. 같은 URL 재전송 → "🔗 already exists"
3. youtu.be 형태 → "🔗 already exists" (URL 정규화 검증)
4. +force → 재처리
5. SIGKILL → 재시작 → 미완료 작업 재개
6. 잘못된 URL → "❌ unsupported"
```

### Phase 2 — 대시보드

```
당신은 PO입니다. Phase 2를 처음부터 끝까지 직접 구현하라.

## 스킬 규칙
React 컴포넌트·훅·페이지(.tsx)를 작성하기 전에 반드시 /react-best-practices를 먼저 호출하라.

## 체크리스트
- apps/dashboard/middleware.ts (session + user_id whitelist, /login·/auth/callback 예외)
- apps/dashboard/app/login/page.tsx (Supabase Auth UI)
- apps/dashboard/app/auth/callback/route.ts
- apps/dashboard/app/(admin)/layout.tsx (admin 가드)
- apps/dashboard/app/(admin)/page.tsx (카드 리스트, 검색, 태그 필터)
- apps/dashboard/app/(admin)/cards/[slug]/page.tsx
- apps/dashboard/app/(admin)/monitor/page.tsx (비용·큐·에러)
- apps/dashboard/app/api/enrich/route.ts
- apps/dashboard/app/api/publish/route.ts
- apps/dashboard/app/api/reprocess/route.ts
- packages/ui 컴포넌트 (DESIGN.md 토큰 기반)
- Vercel 프로젝트 배포 (rootDirectory=apps/dashboard)

## 검증 기준
- 미인증 → /login 리다이렉트
- 비-admin 이메일 → 403
- admin 로그인 → 카드 리스트 조회
- deep 생성 → has_deep=true
- published 토글 → cards.published=true
```

### Phase 3 — 공개 사이트

```
당신은 PO입니다. Phase 3를 처음부터 끝까지 직접 구현하라.

## 스킬 규칙
React 컴포넌트·훅·페이지(.tsx)를 작성하기 전에 반드시 /react-best-practices를 먼저 호출하라.

## 체크리스트
- apps/site/app/page.tsx (카드 인덱스, SSG)
- apps/site/app/[platform]/[slug]/page.tsx (generateStaticParams)
- apps/site/app/tags/[tag]/page.tsx
- apps/site/lib/cards.ts (빌드 타임 Supabase anon 키 조회, published=true)
- MDX 렌더 (next-mdx-remote)
- Pagefind 통합 (postbuild)
- packages/ui 공유 컴포넌트 적용
- Vercel 프로젝트 (rootDirectory=apps/site, auto-deploy OFF, deploy hook ON)
- scripts/deploy-site.ts (deploy hook POST)

## 검증 기준
- pnpm --filter site build → published 카드 N개 페이지 생성
- pnpm deploy → Vercel 빌드 → 공개 URL 접근
- 미published 카드 직접 URL → 404
```

---

## 커밋 컨벤션

```
feat: add pick_next_job() RPC with FOR UPDATE SKIP LOCKED
test: url-normalize — youtube shorts / live / m.youtube variants
fix: vault write — switch to atomic temp+rename
chore: add launchd plist for bot and worker
refactor: move db client to packages/db/client.ts
```

항목 1개 = 커밋 1개. 여러 파일이 논리적으로 묶이면 함께 커밋 가능.

---

## 피드백 루프 상세

```
Reviewer가 이슈 발견
  └─ PO가 수정 (최소 변경, 관련 파일만)
  └─ git add <수정된 파일>
  └─ git commit -m "fix: <이슈 설명>"
  └─ /codex:review 재실행
  └─ APPROVED → 완료
```

수정 범위는 Reviewer가 지적한 부분에만 한정한다. 관련 없는 코드를 함께 수정하지 않는다.

---

*최종 갱신: 2026-05-16.*
