# Step 2: db-client

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙(모든 DB 접근은 packages/db를 통해서만, service_role 노출 금지)
- `docs/ARCHITECTURE.md` — §6(패턴: createServiceClient/createServerClient/createBrowserClient 용도)
- `docs/ADR.md` — ADR-001(Supabase), ADR-002(Auth+RLS)
- `packages/db/src/types.gen.ts` — (존재하는 경우) 자동 생성 타입
- `phases/0-infrastructure/index.json` — step 0, 1 summary

## 작업

`packages/db` 패키지에 Supabase 클라이언트 3종을 구현하라.

### 생성할 파일

**`packages/db/src/client.ts`**

```typescript
// Supabase 클라이언트 3종을 용도에 따라 분리 생성하는 팩토리 모듈
```

아래 3개 함수를 export하라:

```typescript
// worker / bot / server scripts에서 사용 — RLS 우회
export function createServiceClient(): SupabaseClient<Database>

// dashboard 서버 컴포넌트 / Route Handler에서 사용 — session JWT 기반
export function createServerClient(cookieStore: ReadonlyRequestCookies): SupabaseClient<Database>

// dashboard 클라이언트 컴포넌트에서 사용 — anon key, NEXT_PUBLIC_ 허용
export function createBrowserClient(): SupabaseClient<Database>
```

구현 상세:
- `createServiceClient`: `@supabase/supabase-js`의 `createClient(url, serviceRoleKey)`
- `createServerClient`: `@supabase/ssr`의 `createServerClient(url, anonKey, { cookies })` — Next.js App Router 쿠키 패턴
- `createBrowserClient`: `@supabase/ssr`의 `createBrowserClient(url, anonKey)`
- 환경 변수는 `packages/shared/src/config.ts`의 `config` 객체를 import해 사용하라 (직접 `process.env` 접근 금지)

**`packages/db/src/index.ts`**

```typescript
// packages/db 공개 API — client 팩토리 re-export
export { createServiceClient, createServerClient, createBrowserClient } from './client.js'
export type { Database } from './types.gen.js'  // types.gen.ts가 없으면 빈 타입 선언
```

`types.gen.ts`가 아직 생성되지 않은 경우:
```typescript
// 임시 Database 타입 (supabase gen types 실행 후 교체됨)
export type Database = Record<string, unknown>
```

**`packages/db/package.json` 업데이트**

dependencies에 추가:
- `@supabase/supabase-js`: `^2`
- `@supabase/ssr`: `^0`

**`packages/shared/src/config.ts`** (이 step에서 minimal 버전 작성)

이 파일은 step 3에서 완성하지만, `createServiceClient`가 즉시 사용할 수 있도록 환경 변수 최소 버전을 먼저 작성하라:

```typescript
// 환경 변수 로드 및 검증 — zod 기반 (step 3에서 완성)
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
}
```

step 3에서 zod 검증으로 교체될 예정이므로 최소 구현만 해도 된다.

## Acceptance Criteria

```bash
pnpm --filter @zettlink/db build    # 컴파일 에러 없음

# import 경로 확인 — packages/db를 우회하는 직접 import가 없어야 함
grep -r "from '@supabase/supabase-js'" apps/ && echo "FAIL: direct supabase import in apps/" || echo "OK"
grep -r "from '@supabase/ssr'" apps/ && echo "FAIL: direct ssr import in apps/" || echo "OK"
```

## 금지사항

- `SUPABASE_SERVICE_ROLE_KEY`를 `NEXT_PUBLIC_` prefix와 함께 노출하지 마라. 클라이언트 사이드에서 service_role 키 접근은 보안 위반.
- `packages/db`를 우회해 apps/ 내에서 `createClient`를 직접 호출하지 마라. 반드시 `@zettlink/db`를 통해서만.
- `types.gen.ts`를 수동 작성하지 마라. 임시 타입은 허용이지만 `supabase gen types` 결과물로 교체 예정임을 주석으로 명시하라.
