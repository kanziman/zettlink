// 공개 사이트 카드 컴포넌트 — 플랫폼 아이콘, 제목, 요약, 태그 표시
import React from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import type { IconName } from './Icon'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  platform?: string
  title?: string
  summary?: string
  tags?: string[]
  date?: string
}

function platformIcon(platform: string): IconName {
  if (platform === 'youtube') return 'youtube'
  if (platform === 'github') return 'github'
  return 'file-text'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, platform, title, summary, tags, date, className = '', children, ...props }, ref) => {
    const base =
      'bg-background-elevated-normal text-label-normal border border-line-normal-normal p-6 rounded-[20px] shadow-normal-small transition-[transform,box-shadow] duration-200 flex flex-col'
    const hover = hoverable ? 'hover:shadow-normal-medium hover:-translate-y-1 cursor-pointer' : ''

    return (
      <div ref={ref} className={[base, hover, className].filter(Boolean).join(' ')} {...props}>
        {title != null ? (
          <>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-primary-normal/10 text-primary-normal flex items-center justify-center">
                <Icon name={platformIcon(platform ?? '')} size={20} />
              </div>
              {date != null && (
                <span className="text-caption1 text-label-assistive">{date}</span>
              )}
            </div>
            <h3 className="text-heading2 font-bold text-label-strong mb-2 line-clamp-2">{title}</h3>
            {summary != null && (
              <p className="text-body1 text-label-neutral mb-6 line-clamp-3 flex-grow">{summary}</p>
            )}
            {tags != null && tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-auto">
                {tags.map((tag) => (
                  <Badge key={tag} variant="subtle" color="neutral">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          children
        )}
      </div>
    )
  },
)
Card.displayName = 'Card'
