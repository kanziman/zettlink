// 태그 칩 필터 — URL 파라미터 기반 서버 컴포넌트
import React from 'react'

interface TagFilterProps {
  tags: string[]
  activeTag: string | undefined
  activeStatus: string
  q: string | undefined
}

function buildTagHref(tag: string | undefined, activeStatus: string, q: string | undefined) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  if (activeStatus !== 'all') params.set('status', activeStatus)
  return params.toString() ? `/?${params.toString()}` : '/'
}

export function TagFilter({ tags, activeTag, activeStatus, q }: TagFilterProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    textDecoration: 'none',
    border: '1px solid var(--color-line-normal)',
    whiteSpace: 'nowrap',
  }
  const activeStyle: React.CSSProperties = {
    background: 'rgba(0, 102, 255, 0.1)',
    color: 'var(--color-primary-normal)',
    borderColor: 'rgba(0, 102, 255, 0.4)',
  }
  const inactiveStyle: React.CSSProperties = {
    background: 'var(--color-background-alternative)',
    color: 'var(--color-label-alternative)',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      <a
        href={buildTagHref(undefined, activeStatus, q)}
        style={{ ...base, ...(activeTag == null ? activeStyle : inactiveStyle) }}
      >
        전체
      </a>
      {tags.map((t) => (
        <a
          key={t}
          href={buildTagHref(t, activeStatus, q)}
          style={{ ...base, ...(activeTag === t ? activeStyle : inactiveStyle) }}
        >
          <span style={{ marginRight: '2px', opacity: 0.5 }}>#</span>
          {t}
        </a>
      ))}
    </div>
  )
}
