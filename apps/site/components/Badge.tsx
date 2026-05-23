// 공개 사이트 뱃지 컴포넌트 — 태그 표시용
import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outlined' | 'subtle'
  color?: 'primary' | 'positive' | 'cautionary' | 'negative' | 'neutral'
  size?: 'small' | 'medium'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'subtle', color = 'neutral', size = 'medium', className = '', children, ...props }, ref) => {
    const sizeClasses = size === 'small' ? 'px-1 h-5 text-caption1' : 'px-1.5 h-6 text-label2'

    let colorClasses = ''
    if (variant === 'subtle') {
      if (color === 'neutral') colorClasses = 'bg-fill-normal text-label-normal'
      else if (color === 'primary') colorClasses = 'bg-[rgba(0,102,255,0.1)] text-primary-normal'
      else if (color === 'positive') colorClasses = 'bg-[rgba(18,213,137,0.1)] text-status-positive'
      else if (color === 'cautionary') colorClasses = 'bg-[rgba(255,122,0,0.1)] text-status-cautionary'
      else if (color === 'negative') colorClasses = 'bg-[rgba(255,66,66,0.1)] text-status-negative'
    } else if (variant === 'solid') {
      if (color === 'neutral') colorClasses = 'bg-label-normal text-background-normal-normal'
      else if (color === 'primary') colorClasses = 'bg-primary-normal text-white'
    } else if (variant === 'outlined') {
      colorClasses = 'bg-transparent border'
      if (color === 'neutral') colorClasses += ' border-line-normal-normal text-label-normal'
      else if (color === 'primary') colorClasses += ' border-primary-normal text-primary-normal'
    }

    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
          sizeClasses,
          colorClasses,
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </span>
    )
  },
)
Badge.displayName = 'Badge'
