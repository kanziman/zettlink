// 시스템 모니터 페이지 — 오늘 비용·잡 큐 현황·최근 이벤트 표시
import { config } from '@zettlink/shared'
import { createSupabaseServerClient } from '../../../lib/supabase/server'
import { AutoRefresh } from './AutoRefresh'

export default async function MonitorPage() {
  const supabase = await createSupabaseServerClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // async-parallel: 독립적인 3개 조회를 병렬 실행
  const [costResult, jobsResult, eventsResult] = await Promise.all([
    supabase
      .from('events')
      .select('data')
      .eq('type', 'llm.call')
      .gte('ts', todayStart.toISOString()),
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

  const llmEvents = costResult.data ?? []
  const todayCost = llmEvents.reduce(
    (sum, evt) => sum + (((evt.data as Record<string, unknown>)?.cost_usd as number) ?? 0),
    0,
  )
  const todayTokens = llmEvents.reduce(
    (sum, evt) => sum + (((evt.data as Record<string, unknown>)?.tokens_used as number) ?? 0),
    0,
  )
  const budgetUsd = config.budget.dailyUsd
  const budgetPct = Math.min((todayCost / budgetUsd) * 100, 100)

  const jobs = jobsResult.data ?? []
  const jobCounts = {
    queued: jobs.filter((j) => j.status === 'queued').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    dead: jobs.filter((j) => j.status === 'dead').length,
  }

  const events = eventsResult.data ?? []

  const jobStatItems = [
    { label: '대기', key: 'queued' as const, color: 'var(--color-status-caution)' },
    { label: '처리중', key: 'processing' as const, color: 'var(--color-status-info)' },
    { label: '실패', key: 'failed' as const, color: 'var(--color-status-error)' },
    { label: '중단', key: 'dead' as const, color: 'var(--color-status-dead)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <AutoRefresh intervalMs={30_000} />

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>모니터</h1>

      {/* 오늘 비용 */}
      <section>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            color: 'var(--color-label-alternative)',
          }}
        >
          오늘 비용
        </h2>
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--color-line-normal)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <span style={{ fontSize: '2rem', fontWeight: 700 }}>${todayCost.toFixed(4)}</span>
            <span style={{ color: 'var(--color-label-alternative)' }}>
              / ${budgetUsd.toFixed(2)}
            </span>
          </div>
          {/* 진행률 바 */}
          <div
            style={{
              height: '8px',
              background: 'var(--color-background-alternative)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${budgetPct}%`,
                background:
                  budgetPct >= 80
                    ? 'var(--color-status-error)'
                    : budgetPct >= 60
                      ? 'var(--color-status-caution)'
                      : 'var(--color-status-success)',
                borderRadius: '4px',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-label-alternative)', margin: 0 }}>
            토큰 {todayTokens.toLocaleString()}개 · LLM 호출 {llmEvents.length}회
          </p>
        </div>
      </section>

      {/* 잡 큐 현황 */}
      <section>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            color: 'var(--color-label-alternative)',
          }}
        >
          잡 큐
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {jobStatItems.map(({ label, key, color }) => (
            <div
              key={key}
              style={{
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--color-line-normal)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{jobCounts[key]}</div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-label-alternative)',
                  marginTop: '0.25rem',
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 이벤트 */}
      <section>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            color: 'var(--color-label-alternative)',
          }}
        >
          최근 이벤트
        </h2>
        <div
          style={{
            border: '1px solid var(--color-line-normal)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {events.length === 0 ? (
            <p
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-label-alternative)',
                margin: 0,
              }}
            >
              이벤트가 없습니다.
            </p>
          ) : (
            events.map((evt) => {
              const ts = new Date(evt.ts).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
              const levelColor =
                evt.level === 'error'
                  ? 'var(--color-status-error)'
                  : evt.level === 'warn'
                    ? 'var(--color-status-caution)'
                    : 'var(--color-label-assistive)'

              return (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderBottom: '1px solid var(--color-line-normal)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--color-label-assistive)',
                      flexShrink: 0,
                      fontFamily: 'monospace',
                    }}
                  >
                    {ts}
                  </span>
                  <span style={{ color: levelColor, flexShrink: 0, width: '40px' }}>
                    {evt.level}
                  </span>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{evt.type}</span>
                  {evt.card_id !== null ? (
                    <a
                      href={`/cards/${evt.card_id}`}
                      style={{
                        color: 'var(--color-primary-normal)',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
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
