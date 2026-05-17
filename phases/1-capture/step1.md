# Step 1: worker-loop

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL 규칙, 기술 스택
- `docs/ARCHITECTURE.md` — §3.1(12단계 캡처 플로우), §4(실패 모드 & 복구)
- `docs/ADR.md` — ADR-006(pick_next_job RPC), ADR-014(단일 worker)
- `packages/db/src/index.ts` — createServiceClient
- `packages/shared/src/index.ts` — config, canonicalize
- `supabase/migrations/0001_init.sql` — pick_next_job() RPC 시그니처 확인
- `phases/1-capture/index.json` — step 0 summary

## 작업

`apps/worker/src/index.ts`를 구현하라. poll loop + reaper + dispatcher.

### 생성할 파일

**`apps/worker/src/index.ts`**

구현 내용:

```typescript
// 1. poll loop — 5초 간격
async function pollLoop() {
  while (true) {
    await processNextJob()
    await sleep(5000)
  }
}

// 2. processNextJob — pick_next_job() RPC 호출
async function processNextJob() {
  const db = createServiceClient()
  const { data: jobs } = await db.rpc('pick_next_job')
  if (!jobs || jobs.length === 0) return
  const job = jobs[0]
  await dispatch(job)
}

// 3. dispatch — platform별 처리 (Phase 1에서는 stub)
async function dispatch(job: Job) {
  try {
    const canonical = canonicalize(job.raw_url)
    if (!canonical) {
      await markDead(job, 'unsupported URL')
      return
    }
    // Phase 1 Step별로 extractor → llm → vault → git 연결
    // 이 step에서는 skeleton만 구현, 각 단계는 TODO 처리
    logger.info({ jobId: job.id, url: canonical.canonical }, 'job.pick')
    await markDone(job)
  } catch (err) {
    await markFailed(job, err)
  }
}

// 4. reaper — 30분 초과 stuck job을 queued로 복귀
async function reaper() {
  const db = createServiceClient()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  await db
    .from('jobs')
    .update({ status: 'queued', picked_at: null })
    .eq('status', 'processing')
    .lt('picked_at', cutoff)
}
```

헬퍼 함수:
- `markDone(job)` — `UPDATE jobs SET status='done', finished_at=now()`
- `markFailed(job, err)` — attempts+1, backoff 계산, status='failed' or 'dead'
- `markDead(job, reason)` — `UPDATE jobs SET status='dead', last_error=reason`
- `sleep(ms)` — `new Promise(r => setTimeout(r, ms))`

reaper는 pollLoop와 병렬로 10분 간격 실행:
```typescript
setInterval(reaper, 10 * 60 * 1000)
```

**`apps/worker/package.json`**

dependencies:
- `pino`: `^9`
- `@zettlink/db`: `workspace:*`
- `@zettlink/shared`: `workspace:*`

**`apps/worker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 실패 처리 로직

```typescript
async function markFailed(job: Job, err: unknown) {
  const db = createServiceClient()
  const attempts = job.attempts  // pick_next_job이 이미 +1 했음
  const isDead = attempts >= job.max_attempts
  const backoffMs = [60_000, 300_000, 1_800_000][Math.min(attempts - 1, 2)]
  const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString()

  await db.from('jobs').update({
    status: isDead ? 'dead' : 'failed',
    last_error: String(err),
    next_attempt_at: nextAttemptAt,
    finished_at: isDead ? new Date().toISOString() : null,
  }).eq('id', job.id)
}
```

## Acceptance Criteria

```bash
pnpm install
pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# pick_next_job RPC 사용 확인
grep -r "pick_next_job" apps/worker/src/ && echo "RPC OK"

# reaper 구현 확인
grep -r "picked_at" apps/worker/src/ && echo "reaper OK"

# 직접 UPDATE 없이 RPC 사용 확인
grep -r "\.update.*status.*processing" apps/worker/src/ && echo "FAIL: direct status update" || echo "OK: no direct processing update"
```

## 금지사항

- job pickup을 `UPDATE jobs SET status='processing'` 직접 쿼리로 하지 마라. 반드시 `pick_next_job()` RPC 사용.
- poll loop에 `while(true)` + await sleep 대신 setInterval을 쓰지 마라. setInterval은 이전 작업 완료 전 다음 tick이 실행된다.
- reaper를 pollLoop 안에 넣지 마라. 별도 interval로 분리.
