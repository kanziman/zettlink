// 카드 리스트 행 컴포넌트
import type { CSSProperties } from 'react'
import { Badge, type Status } from './Badge.js'
import { Tag } from './Tag.js'

interface CardRowProps {
  slug: string
  title: string | null
  url: string
  platform: string
  status: string
  published: boolean
  tags: string[]
  createdAt: string
  href: string
}

const supportedStatuses = new Set<string>(['done', 'failed', 'pending', 'processing', 'dead', 'queued'])

function toBadgeStatus(status: string): Status {
  return supportedStatuses.has(status) ? (status as Status) : 'pending'
}

export function CardRow({ title, url, platform, status, published, tags, createdAt, href }: CardRowProps) {
  const rowStyle: CSSProperties = {
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    borderBottom: '1px solid var(--color-line-normal)',
    textDecoration: 'none',
  }

  const metaStyle: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  }

  const date = new Date(createdAt)
  const dateLabel = Number.isNaN(date.getTime())
    ? createdAt
    : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

  return (
    <a href={href} style={rowStyle}>
      <div style={{ alignItems: 'center', display: 'flex', gap: '0.5rem' }}>
        <span style={{ color: 'var(--color-label-alternative)', fontSize: '0.75rem', width: '60px' }}>
          {platform}
        </span>
        <span style={{ flex: 1, fontWeight: 600 }}>{title ?? url}</span>
        {published ? (
          <span style={{ color: 'var(--color-status-success)', fontSize: '0.75rem' }}>공개</span>
        ) : null}
      </div>
      <div style={metaStyle}>
        <Badge status={toBadgeStatus(status)} />
        <span style={{ color: 'var(--color-label-alternative)', fontSize: '0.75rem' }}>{dateLabel}</span>
        {tags.map((tag) => (
          <Tag key={tag} name={tag} />
        ))}
      </div>
    </a>
  )
}
