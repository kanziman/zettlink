# Step 5: monitor

## 읽어야 할 파일

- `CLAUDE.md` — React 컴포넌트 생성 전 /react-best-practices 스킬 호출 CRITICAL 규칙
- `packages/db/src/types.gen.ts` — events, jobs, cards Row 타입
- `packages/shared/src/config.ts` — config.budget.dailyUsd 확인
- `apps/dashboard/lib/supabase/server.ts` — createSupabaseServerClient
- `apps/dashboard/app/(admin)/layout.tsx` — admin 레이아웃 확인 (nav에 /monitor 링크 있음)

## 작업

시스템 모니터 페이지를 구현한다. 오늘 비용·잡 큐 현황·최근 이벤트를 표시하고 30초마다 자동 갱신한다.

`async-parallel` 규칙 적용: 비용·잡 현황·이벤트 조회 3개는 독립적이므로 `Promise.all`로 병렬 실행한다.

### 생성할 파일

**`apps/dashboard/app/(admin)/monitor/page.tsx`**

데이터는 Server Component에서 조회, 30초 자동 갱신은 Client Component `AutoRefresh`로 분리.

```typescript
// 시스템 모니터 페이지 — 비용·큐·이벤트 현황
import { createSupabaseServerClient } from '../../../lib/supabase/server'
import { AutoRefresh } from './AutoRefresh'

export default async function MonitorPage() {
  const supabase = await createSupabaseServerClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // async-parallel: 독립적인 3개 조회를 병렬 실행
  const [costResult, jobsResult, eventsResult] = await Promise.all([
    supabase
      .from('cards')
      .select('cost_usd, tokens_used')
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('jobs')
      .select('status')
      .in('status', ['queued', 'processing', 'failed', 'dead']),
    supabase
      .from('events')
      .select('id, ts, level, type, card_id, data')
      .order('ts', { ascending: false })
      .limit(30),
  ])

  const cards = costResult.data ?? []
  const todayCost = cards.reduce((sum, c) => sum + (c.cost_usd ?? 0), 0)
  const todayTokens = cards.reduce((sum, c) => sum + (c.tokens_used ?? 0), 0)
  const budgetUsd = parseFloat(process.env.BUDGET_DAILY_USD ?? '5.0')
  const budgetPct = Math.min((todayCost / budgetUsd) * 100, 100)

  const jobs = jobsResult.data ?? []
  const jobCounts = {
    queued: jobs.filter(j => j.status === 'queued').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    dead: jobs.filter(j => j.status === 'dead').length,
  }

  const events = eventsResult.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <AutoRefresh intervalMs={30_000} />

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>모니터</h1>

      {/* 비용 카드 */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-label-alternative)' }}>
          오늘 비용
        </h2>
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--color-line-normal)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700 }}>
              ${todayCost.toFixed(4)}
            </span>
            <span style={{ color: 'var(--color-label-alternative)' }}>
              / ${budgetUsd.toFixed(2)}
            </span>
          </div>
          {/* 진행률 바 */}
          <div style={{ height: '8px', background: 'var(--color-background-alternative)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${budgetPct}%`,
              background: budgetPct >= 80 ? 'var(--color-status-error)' : budgetPct >= 60 ? 'var(--color-status-caution)' : 'var(--color-status-success)',
              borderRadius: '4px',
              transition: 'width 0.3s',
            }} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-alternative)' }}>
            토큰 {todayTokens.toLocaleString()}개 · 카드 {cards.length}개
          </p>
        </div>
      </section>

      {/* 잡 큐 현황 */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-label-alternative)' }}>
          잡 큐
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {([
            { label: '대기', key: 'queued', color: 'var(--color-status-caution)' },
            { label: '처리중', key: 'processing', color: 'var(--color-status-info)' },
            { label: '실패', key: 'failed', color: 'var(--color-status-error)' },
            { label: '중단', key: 'dead', color: '#5a5c63' },
          ] as const).map(({ label, key, color }) => (
            <div key={key} style={{
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--color-line-normal)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{jobCounts[key]}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-label-alternative)', marginTop: '0.25rem' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 이벤트 */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-label-alternative)' }}>
          최근 이벤트
        </h2>
        <div style={{ border: '1px solid var(--color-line-normal)', borderRadius: '12px', overflow: 'hidden' }}>
          {events.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-label-alternative)' }}>
              이벤트가 없습니다.
            </p>
          ) : (
            events.map(evt => {
              const ts = new Date(evt.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const levelColor =
                evt.level === 'error' ? 'var(--color-status-error)'
                : evt.level === 'warn' ? 'var(--color-status-caution)'
                : 'var(--color-label-assistive)'

              return (
                <div key={evt.id} style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  borderBottom: '1px solid var(--color-line-normal)',
                  fontSize: '0.8125rem',
                }}>
                  <span style={{ color: 'var(--color-label-assistive)', flexShrink: 0, fontFamily: 'monospace' }}>{ts}</span>
                  <span style={{ color: levelColor, flexShrink: 0, width: '40px' }}>{evt.level}</span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{evt.type}</span>
                  {evt.card_id !== null ? (
                    <a
                      href={`/cards/${evt.card_id}`}
                      style={{ color: 'var(--color-primary-normal)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {evt.card_id}
                    </a>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
```

**`apps/dashboard/app/(admin)/monitor/AutoRefresh.tsx`**

30초마다 `router.refresh()`를 호출해 Server Component 데이터를 갱신하는 Client Component.

```typescript
'use client'
// 모니터 페이지 자동 갱신 컴포넌트 — N초마다 router.refresh() 호출
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  intervalMs: number
}

export function AutoRefresh({ intervalMs }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
```

## Acceptance Criteria

```bash
pnpm --filter @zettlink/dashboard build
# → 성공, /monitor 라우트 생성 확인

# 수동 확인
# 1. /monitor 접속 → 오늘 비용·잡 큐·이벤트 표시
# 2. 30초 대기 → 데이터 자동 갱신 확인
# 3. 비용이 예산의 80% 이상이면 진행률 바가 빨간색으로 표시되는지 확인
```

## 금지사항

- 3개 데이터 조회를 순차 await로 실행하지 마라. 반드시 `Promise.all` 병렬 실행.
- `AutoRefresh`에서 Supabase를 직접 구독(realtime)하지 마라. `router.refresh()` 기반 폴링으로 충분.
- `useEffect` dependency에 `router` 외 불필요한 값을 넣지 마라.
- `&&` 연산자로 JSX 조건부 렌더링 금지.
