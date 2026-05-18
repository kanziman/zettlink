// 상태 표시 뱃지 컴포넌트
import type { CSSProperties } from 'react'

export type Status = 'done' | 'failed' | 'pending' | 'processing' | 'dead' | 'queued'

interface BadgeProps {
  status: Status
  label?: string
}

const statusConfig: Record<Status, { bg: string; color: string; text: string }> = {
  dead: { bg: 'var(--color-status-dead)', color: 'var(--color-static-white, white)', text: '중단' },
  done: { bg: 'var(--color-status-success)', color: 'var(--color-static-white, white)', text: '완료' },
  failed: { bg: 'var(--color-status-error)', color: 'var(--color-static-white, white)', text: '실패' },
  pending: { bg: 'var(--color-line-strong)', color: 'var(--color-label-normal)', text: '대기' },
  processing: { bg: 'var(--color-status-info)', color: 'var(--color-static-white, white)', text: '처리중' },
  queued: { bg: 'var(--color-status-caution)', color: 'var(--color-static-white, white)', text: '큐' },
}

export function Badge({ status, label }: BadgeProps) {
  const config = statusConfig[status]
  const style: CSSProperties = {
    background: config.bg,
    borderRadius: '4px',
    color: config.color,
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.125rem 0.5rem',
  }

  return <span style={style}>{label ?? config.text}</span>
}
