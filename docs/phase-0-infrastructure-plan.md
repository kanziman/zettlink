# Phase 0-infrastructure 구현 플랜

> Gate 1 플랜. Reviewer(/codex:review) 승인 후 구현 시작.

---

## 1. 구현 순서와 이유

```
Step 0: workspace-setup
  ↓ (monorepo 뼈대 없으면 이후 단계 불가)
Step 1: db-schema
  ↓ (types.gen.ts → packages/db/src/client.ts 타입 참조)
Step 2: db-client
  ↓ (minimal config.ts 작성 → step 3에서 교체)
Step 3: shared-config
  ↓ (packages/shared 구조 완성 후 TDD 시작)
Step 4: url-normalize
  ↓ (CanonicalUrl 타입 → slug.ts에서 참조)
Step 5: slug
  ↓ (코드 독립. Step 0 디렉토리 구조만 필요)
Step 6: launchd
```

**순서 이유:**
- Step 0가 선행이어야 pnpm workspace가 인식되고 이후 `pnpm --filter` 명령이 동작한다.
- Step 1이 Step 2보다 앞서야 `supabase gen types`로 `types.gen.ts`를 생성할 수 있다. Step 2는 types.gen.ts 없이도 임시 타입으로 컴파일되지만, 실제 DB 타입 정확도를 위해 Step 1 완료 후 진행한다.
- Step 2에서 minimal `config.ts`를 먼저 써야 `packages/db/src/client.ts`가 env 변수를 읽을 수 있다. Step 3에서 zod 버전으로 교체한다.
- Steps 4-5(TDD)는 `packages/shared` 패키지 구조(Step 0, 3)가 준비된 후 시작한다.
- Step 6(launchd)은 소스 코드와 독립적이므로 마지막에 배치한다. Step 0 이후 어느 시점에도 가능하나 전체 완성 후 한 번에 검증하기 위해 마지막으로 뺐다.

---

## 2. 각 Step의 검증 방법 (AC)

### Step 0: workspace-setup

```bash
pnpm install
pnpm -r ls
# → @zettlink/bot, @zettlink/worker, @zettlink/dashboard, @zettlink/site,
#    @zettlink/db, @zettlink/shared, @zettlink/ui, @zettlink/prompts 목록 출력

grep -E "^\.env$" .gitignore   # → .env
grep -E "^logs/" .gitignore    # → logs/ 또는 logs/*.log
```

### Step 1: db-schema

```bash
test -f supabase/migrations/0001_init.sql && echo "OK"

# Supabase CLI + Docker가 준비된 경우만:
supabase start
supabase db push
bash scripts/gen-types.sh
test -f packages/db/src/types.gen.ts && echo "types.gen.ts OK"
```

Supabase CLI 또는 Docker가 없으면 SQL 파일 생성까지만 하고 `status: "blocked"` 기록 후 중단. 실행 환경 확인은 step 시작 전에 한다:

```bash
supabase --version
docker info
```

### Step 2: db-client

**시작 전 읽어야 할 파일:**
- `packages/db/src/types.gen.ts` — Step 1 산출물. 존재하면 타입 참조 방식 확인. 없으면 임시 `any` 타입으로 진행하고 주석 표시.

```bash
pnpm --filter @zettlink/db build   # 컴파일 에러 없음

# apps/ 내 직접 supabase import 없어야 함
grep -r "from '@supabase/supabase-js'" apps/ && echo "FAIL" || echo "OK"
grep -r "from '@supabase/ssr'" apps/ && echo "FAIL" || echo "OK"
```

### Step 3: shared-config

**시작 전 읽어야 할 파일:**
- `packages/shared/src/config.ts` — Step 2에서 생성한 minimal 버전. zod 스키마로 교체할 대상 파악.

```bash
pnpm --filter @zettlink/shared build   # 컴파일 에러 없음

# 필수 변수 누락 시 ZodError crash 확인
node -e "import('@zettlink/shared').then(m => m.config)" 2>&1 \
  | grep -i "ZodError\|invalid\|required" && echo "OK: validation works"
```

### Step 4: url-normalize

**시작 전 읽어야 할 파일:**
- `packages/shared/src/index.ts` — Step 3 산출물. `canonicalize` re-export 추가 위치 확인.

**커버해야 할 URL 변형 케이스 (테스트 작성 전 반드시 열거):**

| 플랫폼 | 입력 변형 | canonical 형태 |
|---|---|---|
| YouTube | `https://www.youtube.com/watch?v=ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | `https://youtu.be/ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | `https://www.youtube.com/embed/ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | `https://www.youtube.com/shorts/ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | `https://m.youtube.com/watch?v=ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | `https://www.youtube.com/live/ABC123` | `https://www.youtube.com/watch?v=ABC123` |
| YouTube | query param 추가 (`?t=30`, `?list=PL...`) | video ID만 보존, 나머지 제거 |
| GitHub | `https://github.com/owner/repo` | `https://github.com/owner/repo` |
| GitHub | `https://github.com/owner/repo/` (trailing slash) | `https://github.com/owner/repo` |
| GitHub | `https://github.com/owner/repo/blob/branch/path` | `https://github.com/owner/repo` |
| GitHub | `https://github.com/owner/repo/tree/branch` | `https://github.com/owner/repo` |
| GitHub | `https://github.com/owner/repo/issues/123` | `https://github.com/owner/repo` |
| 미지원 | `https://twitter.com/...` 등 | `throw Error('unsupported platform')` |

`canonicalize()` 반환 타입: `{ platform: 'youtube' | 'github'; externalId: string; canonical: string }` (또는 `packages/shared/src/types.ts`에서 import한 `CanonicalUrl` 타입으로 통일).

```bash
pnpm --filter @zettlink/shared test
# → url-normalize 관련 테스트 전체 PASS
# → coverage: url-normalize.ts 100% (lines, branches, functions)
```

RED → GREEN 순서 검증: 테스트 먼저 실행해 실패를 확인한 뒤 구현.

### Step 5: slug

**시작 전 읽어야 할 파일:**
- `packages/shared/src/types.ts` — Step 4 산출물. `CanonicalUrl` 타입 위치 확인. slug.ts에서 import할 타입 서명 파악.
- `packages/shared/src/index.ts` — Step 4 산출물. `canonicalize` re-export 패턴 확인 후 `titleToSlug`, `repoToSlug` re-export를 같은 위치에 추가.

```bash
pnpm --filter @zettlink/shared test
# → url-normalize + slug 테스트 전체 PASS
# → coverage: slug.ts 100%

pnpm --filter @zettlink/shared build
```

### Step 6: launchd

```bash
plutil -lint com.zettlink.bot.plist && echo "bot plist OK"
plutil -lint com.zettlink.worker.plist && echo "worker plist OK"
test -x scripts/install-launchd.sh && echo "install script OK"
test -f logs/.gitkeep && echo "logs dir OK"

# 전체 최종 확인
pnpm install
pnpm --filter @zettlink/shared test
pnpm --filter @zettlink/db build
pnpm --filter @zettlink/shared build
```

---

## 3. 생성될 파일 목록

### Step 0: workspace-setup

```
pnpm-workspace.yaml
tsconfig.base.json
package.json                         (루트, private)
.env.example
apps/bot/package.json
apps/worker/package.json
apps/dashboard/package.json
apps/site/package.json
packages/db/package.json
packages/db/tsconfig.json
packages/db/src/                     (빈 디렉토리)
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/                 (빈 디렉토리)
packages/ui/package.json
packages/ui/tsconfig.json
packages/ui/src/                     (빈 디렉토리)
packages/prompts/package.json
```

주의: `.gitignore`는 이미 존재(`da676bc` 커밋). `logs/` 항목을 확인하고 필요시 `logs/*.log`로 수정.

### Step 1: db-schema

```
supabase/config.toml
supabase/migrations/0001_init.sql
supabase/seed.sql
scripts/gen-types.sh
packages/db/src/types.gen.ts         (supabase gen types 결과, 환경 있을 때만)
```

### Step 2: db-client

```
packages/db/src/client.ts
packages/db/src/index.ts
packages/shared/src/config.ts        (minimal 버전, step 3에서 교체)
```

`packages/db/package.json`에 `@supabase/supabase-js`, `@supabase/ssr` 추가.

### Step 3: shared-config

```
packages/shared/src/config.ts        (zod 버전으로 교체)
packages/shared/src/types.ts
packages/shared/src/index.ts
```

`packages/shared/package.json`에 `zod: "^3"` 추가.

### Step 4: url-normalize

```
packages/shared/src/__tests__/url-normalize.test.ts   (먼저 작성)
packages/shared/src/url-normalize.ts
```

`packages/shared/package.json` devDependencies에 `vitest` 추가, `test` script 설정.
`packages/shared/src/index.ts`에 `canonicalize` re-export 추가.

### Step 5: slug

```
packages/shared/src/__tests__/slug.test.ts   (먼저 작성)
packages/shared/src/slug.ts
```

`packages/shared/src/index.ts`에 `titleToSlug`, `repoToSlug` re-export 추가.

### Step 6: launchd

```
com.zettlink.bot.plist
com.zettlink.worker.plist
scripts/install-launchd.sh
logs/.gitkeep
```

---

## 4. CLAUDE.md CRITICAL 규칙 충돌 여부 확인

| CRITICAL 규칙 | Phase 0 관련성 | 충돌 여부 |
|---|---|---|
| 모든 DB 접근은 `packages/db` 클라이언트를 통해서만 | Step 2에서 3종 팩토리 구현. apps/에서 직접 `createClient` 금지. AC에 grep 검사 포함. | 없음 |
| `service_role` 키를 `NEXT_PUBLIC_` prefix로 노출 금지 | `createBrowserClient`는 anon key만 사용. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`는 절대 사용 안 함. | 없음 |
| 대시보드 모든 라우트는 middleware.ts admin whitelist 통과 | Phase 0 범위 외 (dashboard 코드 없음). | 해당 없음 |
| URL은 항상 `canonicalize()` 후 DB 저장 | Step 4에서 도구 구현. Phase 0에서는 DB 저장 코드 없음. | 없음 |
| LLM 호출 전 daily cost cap 체크 | Phase 0 범위 외 (LLM 호출 없음). | 해당 없음 |
| vault write는 atomic (temp+rename) | Phase 0 범위 외 (worker 코드 없음). | 해당 없음 |
| 새 기능은 TDD | Steps 4, 5 명시적 TDD (RED → GREEN). Steps 0-3, 6은 설정/인프라로 비즈니스 로직 없음 — TDD 대상 아님. | 없음 |
| 마이그레이션은 새 파일로만 | Step 1에서 `0001_init.sql` 신규 생성. Phase 0 이후 이 파일을 수정하지 않는다. | 없음 |
| React 컴포넌트 작성 시 `/react-best-practices` 먼저 호출 | Phase 0에 `.tsx` 파일 없음. | 해당 없음 |
| 커밋 메시지 Conventional Commits | 각 Step 완료 시 `chore:`, `feat:`, `test:` 등으로 커밋. | 없음 |

---

## 5. Step별 커밋 계획

```
chore: workspace monorepo skeleton — pnpm workspace, tsconfig.base.json, app/package stubs
feat(db): Supabase schema — 0001_init.sql, pick_next_job() RPC, RLS policies, seed tags
feat(db): Supabase client factories — createServiceClient, createServerClient, createBrowserClient
feat(shared): zod-based config validation and domain types
test(shared): url-normalize — YouTube/GitHub variant coverage (RED phase)
feat(shared): url-normalize — canonicalize() implementation (GREEN phase)
test(shared): slug — titleToSlug and repoToSlug coverage (RED phase)
feat(shared): slug — titleToSlug and repoToSlug implementation (GREEN phase)
chore: launchd plist and install script for bot and worker
```

---

*작성일: 2026-05-16. Gate 1 — Reviewer 승인 대기.*
