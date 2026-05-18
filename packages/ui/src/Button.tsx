// 공용 버튼 컴포넌트 — primary / ghost / danger variant
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  style,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
  }

  const variantStyle: CSSProperties =
    variant === 'primary'
      ? { background: 'var(--color-primary-normal)', color: 'var(--color-static-white, white)' }
      : variant === 'ghost'
        ? {
            background: 'transparent',
            border: '1px solid var(--color-line-strong)',
            color: 'var(--color-label-normal)',
          }
        : { background: 'var(--color-status-error)', color: 'var(--color-static-white, white)' }

  const sizeStyle: CSSProperties =
    size === 'sm'
      ? { fontSize: '0.875rem', padding: '0.375rem 0.75rem' }
      : { fontSize: '1rem', padding: '0.625rem 1.25rem' }

  return (
    <button style={{ ...baseStyle, ...variantStyle, ...sizeStyle, ...style }} disabled={disabled} {...props}>
      {children}
    </button>
  )
}
