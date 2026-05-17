# Step 8: retry

## 읽어야 할 파일

- `docs/ARCHITECTURE.md` — §4(실패 모드 — backoff: 1m, 5m, 30m)
- `apps/worker/src/index.ts` — markFailed 함수 (backoff 계산 위치)
- `phases/1-capture/index.json` — step 0~7 summary

## 작업

`apps/worker/src/retry.ts`를 TDD로 구현하라. **테스트를 먼저 작성하고, 통과하는 구현을 나중에 작성한다.**

### Step 순서 (반드시 이 순서)

1. `apps/worker/src/__tests__/retry.test.ts` 작성
2. `pnpm --filter @zettlink/worker test` 실행 → 실패 확인 (RED)
3. `apps/worker/src/retry.ts` 구현
4. `pnpm --filter @zettlink/worker test` 실행 → 통과 확인 (GREEN)
5. `apps/worker/src/index.ts`의 `markFailed`에서 inline 계산 → `backoffMs()` 호출로 교체

### `retry.ts` 인터페이스

```typescript
// attempt = pick_next_job 이후의 attempts 값 (1-based)
// 반환: 다음 시도까지 대기 ms
export function backoffMs(attempt: number): number

// Exponential backoff with jitter (±10%)
// attempt 1 → 60_000ms (1분)
// attempt 2 → 300_000ms (5분)
// attempt 3+ → 1_800_000ms (30분)
```

### 테스트 케이스

```typescript
// apps/worker/src/__tests__/retry.test.ts
import { describe, it, expect } from 'vitest'
import { backoffMs } from '../retry.js'

describe('backoffMs', () => {
  it('attempt 1 → ~60초', () => {
    const ms = backoffMs(1)
    expect(ms).toBeGreaterThanOrEqual(54_000)   // -10%
    expect(ms).toBeLessThanOrEqual(66_000)       // +10%
  })

  it('attempt 2 → ~5분', () => {
    const ms = backoffMs(2)
    expect(ms).toBeGreaterThanOrEqual(270_000)
    expect(ms).toBeLessThanOrEqual(330_000)
  })

  it('attempt 3 → ~30분', () => {
    const ms = backoffMs(3)
    expect(ms).toBeGreaterThanOrEqual(1_620_000)
    expect(ms).toBeLessThanOrEqual(1_980_000)
  })

  it('attempt 4 이상도 30분 상한', () => {
    const ms = backoffMs(10)
    expect(ms).toBeLessThanOrEqual(1_980_000)
  })

  it('항상 양수', () => {
    expect(backoffMs(1)).toBeGreaterThan(0)
    expect(backoffMs(0)).toBeGreaterThan(0)
  })
})
```

### `apps/worker/package.json` 업데이트

devDependencies에 추가:
```json
"vitest": "^2",
"@vitest/coverage-v8": "^2"
```

scripts에 추가:
```json
"test": "vitest run --coverage"
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/worker test
# → retry.test.ts 5개 테스트 PASS
# → coverage: retry.ts 100%

pnpm --filter @zettlink/worker build
# → 컴파일 에러 없음

# worker-loop에서 backoffMs 사용 확인
grep -r "backoffMs" apps/worker/src/index.ts && echo "backoffMs integrated OK"
```

## 금지사항

- 테스트를 나중에 작성하지 마라. 반드시 RED → GREEN 순서.
- backoff 값을 index.ts에 inline으로 남기지 마라. backoffMs() 호출로 교체.
- jitter 없이 고정값을 반환하지 마라. ±10% 범위의 무작위 편차 포함.
