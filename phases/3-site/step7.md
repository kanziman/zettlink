# Step 7: deploy

## 읽어야 할 파일

- `scripts/deploy-dashboard.ts` — 패턴 참고 (fetch + process.exit)
- `package.json` (루트) — 현재 scripts 목록 확인 (deploy:dashboard 있음)
- `.env.example` — 현재 환경변수 목록 확인 (VERCEL_DEPLOY_HOOK_SITE 이미 있는지)
- `apps/site/package.json` — step 1 결과물 (build script 확인)
- `docs/ARCHITECTURE.md` — §9 배포 (apps/site 배포 전략)

## 작업

`pnpm deploy:site`로 Vercel deploy hook을 POST해 사이트 재빌드를 트리거하는 스크립트와 Vercel 설정을 추가한다.

### 생성할 파일

**`scripts/deploy-site.ts`**

```typescript
// 공개 사이트 Vercel deploy hook을 POST로 호출하는 스크립트
const hookUrl = process.env.VERCEL_DEPLOY_HOOK_SITE

if (!hookUrl) {
  console.error('VERCEL_DEPLOY_HOOK_SITE 환경변수가 설정되지 않았습니다.')
  process.exit(1)
}

const res = await fetch(hookUrl, { method: 'POST' })
if (!res.ok) {
  console.error(`deploy hook 실패: ${res.status}`)
  process.exit(1)
}

console.log('사이트 배포 트리거 완료')
```

**`apps/site/vercel.json`**

```json
{
  "framework": null,
  "buildCommand": "cd ../.. && pnpm --filter @zettlink/site build",
  "outputDirectory": "out",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile"
}
```

> Note: Vercel 프로젝트 설정에서 rootDirectory=`apps/site`로 지정. GitHub auto-deploy는 **OFF**로 설정하고 deploy hook만 사용한다.

### 수정할 파일

**`package.json` (루트)**

`deploy:site` 스크립트를 추가한다.

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "gen-types": "bash scripts/gen-types.sh",
    "deploy:dashboard": "tsx scripts/deploy-dashboard.ts",
    "deploy:site": "tsx scripts/deploy-site.ts"
  }
}
```

**`.env.example`** — VERCEL_DEPLOY_HOOK_SITE가 이미 있으면 건너뛴다. 없으면 추가한다.

```
VERCEL_DEPLOY_HOOK_SITE=
```

## Vercel 프로젝트 설정 체크리스트

Vercel 대시보드에서 수동으로 설정해야 하는 항목:

- [ ] 새 Vercel project 생성 (apps/site용)
- [ ] rootDirectory: `apps/site`
- [ ] Framework Preset: Other (vercel.json의 `framework: null` 때문)
- [ ] GitHub auto-deploy: **OFF**
- [ ] Deploy Hook 생성 → URL을 `.env`의 `VERCEL_DEPLOY_HOOK_SITE`에 저장
- [ ] 환경변수 등록:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Acceptance Criteria

```bash
# 루트 package.json에 deploy:site 스크립트 존재 확인
cat package.json | grep deploy:site
# → "deploy:site": "tsx scripts/deploy-site.ts"

# 스크립트 파일 존재 확인
ls scripts/deploy-site.ts

# Vercel 프로젝트와 hook이 설정된 경우 실제 트리거 테스트
VERCEL_DEPLOY_HOOK_SITE=<hook-url> pnpm deploy:site
# → "사이트 배포 트리거 완료" 출력

# 환경변수 없을 때 에러 처리 확인
pnpm deploy:site
# → "VERCEL_DEPLOY_HOOK_SITE 환경변수가 설정되지 않았습니다." 출력 후 exit 1
```

## 금지사항

- deploy:site를 `deploy:dashboard`와 같은 스크립트로 합치지 마라. 사이트와 대시보드는 별도로 배포된다.
- `apps/site/vercel.json`에서 Vercel GitHub integration auto-deploy를 켜지 마라. publish 시점에 수동으로 `pnpm deploy:site`를 실행하는 것이 의도된 흐름이다.
- `SUPABASE_SERVICE_ROLE_KEY`를 Vercel site 환경변수에 등록하지 마라. site는 anon 키만 필요하다.
