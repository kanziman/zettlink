# Step 7: deploy

## 읽어야 할 파일

- `CLAUDE.md` — 기술 스택 (Vercel, rootDirectory=apps/dashboard)
- `docs/ARCHITECTURE.md` — §9 배포 섹션
- `.env.example` — 현재 환경변수 목록
- `apps/dashboard/package.json` — scripts 확인
- `apps/site/package.json` — site 참고 (동일 패턴)

## 작업

Vercel 배포 설정 파일을 추가하고 `.env.example`을 업데이트한다.
실제 Vercel 프로젝트 생성·연결은 수동 단계를 포함한다.

### 생성할 파일

**`apps/dashboard/vercel.json`**

```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm --filter @zettlink/dashboard build",
  "installCommand": "cd ../.. && pnpm install"
}
```

**`scripts/deploy-dashboard.ts`**

```typescript
// 대시보드 Vercel deploy hook을 POST로 호출하는 스크립트
const hookUrl = process.env.VERCEL_DEPLOY_HOOK_DASHBOARD

if (!hookUrl) {
  console.error('VERCEL_DEPLOY_HOOK_DASHBOARD 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const res = await fetch(hookUrl, { method: 'POST' })
if (!res.ok) {
  console.error(`deploy hook 실패: ${res.status}`)
  process.exit(1)
}

console.log('대시보드 배포 트리거 완료')
```

### 수정할 파일

**`.env.example`** 에 다음 항목을 추가한다:

```
# dashboard (Next.js 클라이언트에 노출 — anon key와 URL만 허용)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

기존 `SUPABASE_URL`, `SUPABASE_ANON_KEY`와 같은 값이다. dashboard 클라이언트 컴포넌트(로그인 페이지)가 브라우저에서 직접 Supabase Auth를 호출하기 위해 필요하다.

### Vercel 수동 설정 지침

Vercel CLI 또는 대시보드에서 다음을 설정한다:

```bash
# 1. Vercel 프로젝트 생성 (apps/dashboard 디렉토리에서)
cd apps/dashboard
vercel link  # 기존 프로젝트 연결 또는 새 프로젝트 생성

# 2. 환경변수 설정 (Vercel 대시보드 또는 CLI)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ADMIN_USER_IDS production
vercel env add ANTHROPIC_API_KEY production
vercel env add BUDGET_DAILY_USD production

# 3. 배포
vercel --prod
# 또는 deploy hook 사용:
# pnpm tsx scripts/deploy-dashboard.ts
```

Vercel 프로젝트 설정:
- **Root Directory**: `apps/dashboard`
- **Framework Preset**: Next.js
- **Node.js Version**: 22.x
- **GitHub 연동**: push → 자동 preview, main push → 자동 production 배포

### package.json에 deploy 스크립트 추가

`package.json` (루트)의 scripts에 다음을 추가한다:

```json
"deploy:dashboard": "tsx scripts/deploy-dashboard.ts"
```

## Acceptance Criteria

```bash
# 로컬 빌드 최종 확인
pnpm --filter @zettlink/dashboard build
# → 성공, .next 생성

# typecheck 전체
pnpm typecheck
# → 에러 없음

# .env.example 확인
grep "NEXT_PUBLIC_SUPABASE" .env.example
# → NEXT_PUBLIC_SUPABASE_URL 와 NEXT_PUBLIC_SUPABASE_ANON_KEY 두 줄 출력

# deploy script typecheck
pnpm tsx --noEmit scripts/deploy-dashboard.ts 2>/dev/null || true
```

## 금지사항

- `SUPABASE_SERVICE_ROLE_KEY`를 Vercel 환경변수에 `NEXT_PUBLIC_` prefix로 설정하지 마라.
- `vercel.json`에 `ANTHROPIC_API_KEY` 등 secret 값을 직접 쓰지 마라.
- `apps/dashboard`에 `.env` 파일을 커밋하지 마라.
