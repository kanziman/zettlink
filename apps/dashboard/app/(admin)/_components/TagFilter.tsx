// 태그 칩 필터 — URL 파라미터 기반 클라이언트 컴포넌트
'use client'

import React, { useState } from 'react'

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

const COLLAPSE_LIMIT = 8

export function TagFilter({ tags, activeTag, activeStatus, q }: TagFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3125rem 0.6875rem',
    borderRadius: '8px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    textDecoration: 'none',
    border: '1px solid var(--color-line-normal)',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease-in-out',
  }
  
  const activeStyle: React.CSSProperties = {
    background: 'rgba(3, 105, 161, 0.08)',
    color: 'var(--color-primary-normal)',
    borderColor: 'rgba(3, 105, 161, 0.28)',
  }
  
  const inactiveStyle: React.CSSProperties = {
    background: 'var(--color-background-alternative)',
    color: 'var(--color-label-alternative)',
  }

  const visibleTags = isExpanded ? tags : tags.slice(0, COLLAPSE_LIMIT)
  const hasMore = tags.length > COLLAPSE_LIMIT

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
      <a
        href={buildTagHref(undefined, activeStatus, q)}
        style={{ ...base, ...(activeTag == null ? activeStyle : inactiveStyle) }}
        onMouseEnter={(e) => {
          if (activeTag != null) {
            e.currentTarget.style.background = 'rgba(3, 105, 161, 0.04)'
            e.currentTarget.style.color = 'var(--color-primary-normal)'
          }
        }}
        onMouseLeave={(e) => {
          if (activeTag != null) {
            e.currentTarget.style.background = 'var(--color-background-alternative)'
            e.currentTarget.style.color = 'var(--color-label-alternative)'
          }
        }}
      >
        전체
      </a>
      {visibleTags.map((t) => {
        const isActive = activeTag === t
        return (
          <a
            key={t}
            href={buildTagHref(t, activeStatus, q)}
            style={{ ...base, ...(isActive ? activeStyle : inactiveStyle) }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(3, 105, 161, 0.04)'
                e.currentTarget.style.color = 'var(--color-primary-normal)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--color-background-alternative)'
                e.currentTarget.style.color = 'var(--color-label-alternative)'
              }
            }}
          >
            <span style={{ marginRight: '2px', opacity: 0.5 }}>#</span>
            {t}
          </a>
        )
      })}
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            ...base,
            background: 'transparent',
            color: 'var(--color-primary-normal)',
            borderColor: 'var(--color-line-normal)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(3, 105, 161, 0.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {isExpanded ? '접기 ▴' : `더 보기 (${tags.length - COLLAPSE_LIMIT}) ▾`}
        </button>
      )}
    </div>
  )
}
