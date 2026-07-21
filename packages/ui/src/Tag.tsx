// 태그 chip 컴포넌트
'use client'

import type { CSSProperties, KeyboardEvent } from 'react'

interface TagProps {
  name: string
  onClick?: () => void
  active?: boolean
}

export function Tag({ name, onClick, active = false }: TagProps) {
  const style: CSSProperties = {
    background: active ? 'var(--color-primary-normal)' : 'var(--color-background-alternative)',
    border: '1px solid var(--color-line-normal)',
    borderRadius: '999px',
    color: active ? 'var(--color-static-white, white)' : 'var(--color-label-normal)',
    cursor: onClick ? 'pointer' : 'default',
    display: 'inline-block',
    fontSize: '0.8125rem',
    fontWeight: 500,
    padding: '0.25rem 0.625rem',
    transition: 'background 0.15s',
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!onClick) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <span
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      style={style}
      tabIndex={onClick ? 0 : undefined}
    >
      {name}
    </span>
  )
}
