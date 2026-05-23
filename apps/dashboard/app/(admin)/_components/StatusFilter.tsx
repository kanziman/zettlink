// 상태 탭 필터 — SegmentedControl 형태 서버 컴포넌트

interface StatusFilterProps {
  activeStatus: string
  activeTag: string | undefined
  q: string | undefined
}

function buildStatusHref(status: string, activeTag: string | undefined, q: string | undefined) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (activeTag) params.set('tag', activeTag)
  if (status !== 'all') params.set('status', status)
  return params.toString() ? `/?${params.toString()}` : '/'
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'done', label: '완료' },
  { value: 'failed', label: '실패' },
] as const

export function StatusFilter({ activeStatus, activeTag, q }: StatusFilterProps) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(112, 115, 124, 0.08)',
      borderRadius: '8px',
      padding: '3px',
    }}>
      {STATUS_OPTIONS.map((opt) => {
        const isActive = activeStatus === opt.value
        return (
          <a
            key={opt.value}
            href={buildStatusHref(opt.value, activeTag, q)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textDecoration: 'none',
              background: isActive ? 'var(--color-background-normal)' : 'transparent',
              color: isActive ? 'var(--color-label-strong)' : 'var(--color-label-alternative)',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {opt.label}
          </a>
        )
      })}
    </div>
  )
}
