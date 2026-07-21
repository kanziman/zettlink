// 공개 사이트 버튼 컴포넌트 — TopNavigation 아이콘 버튼 전용
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outlined'
  color?: 'primary' | 'assistive'
  size?: 'small' | 'medium' | 'large'
  leadingContent?: React.ReactNode
  iconOnly?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      color = 'primary',
      size = 'medium',
      leadingContent,
      iconOnly,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    let sizeClasses = ''
    if (size === 'small') sizeClasses = iconOnly ? 'w-8 h-8' : 'px-3 h-8 text-label2'
    else if (size === 'medium') sizeClasses = iconOnly ? 'w-11 h-11' : 'px-4 h-10 text-label1'
    else if (size === 'large') sizeClasses = iconOnly ? 'w-12 h-12' : 'px-5 h-12 text-body1'

    let colorClasses = ''
    if (variant === 'outlined') {
      if (color === 'assistive')
        colorClasses = 'bg-transparent text-label-normal border-line-normal-normal hover:bg-fill-normal disabled:text-label-disable'
      else if (color === 'primary')
        colorClasses = 'bg-transparent text-primary-normal border-primary-normal hover:bg-[rgba(0,102,255,0.04)] disabled:text-label-disable'
    } else {
      if (color === 'assistive')
        colorClasses = 'bg-fill-normal text-label-normal hover:bg-fill-strong disabled:bg-interaction-disable disabled:text-label-disable border-transparent'
      else if (color === 'primary')
        colorClasses = 'bg-primary-normal text-white hover:bg-primary-strong disabled:bg-interaction-disable border-transparent'
    }

    return (
      <button
        ref={ref}
        className={[
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 border cursor-pointer',
          disabled ? 'cursor-not-allowed opacity-80' : '',
          sizeClasses,
          colorClasses,
          className,
        ].filter(Boolean).join(' ')}
        disabled={disabled}
        {...props}
      >
        {leadingContent && <span className="inline-flex">{leadingContent}</span>}
        {!iconOnly && <span>{children}</span>}
        {iconOnly && children}
      </button>
    )
  },
)
Button.displayName = 'Button'
