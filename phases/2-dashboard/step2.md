# Step 2: packages-ui

## 읽어야 할 파일

- `CLAUDE.md` — React 컴포넌트 생성 전 /react-best-practices 스킬 호출 CRITICAL 규칙
- `docs/DESIGN.md` — §2 Foundations 전체 (색상, 타이포, 컴포넌트 가이드라인)
- `docs/UI_GUIDE.md` — 컴포넌트 사용 패턴
- `packages/ui/package.json` — 현재 skeleton
- `packages/ui/tsconfig.json` — 현재 설정
- `apps/dashboard/app/globals.css` — step 0에서 정의한 CSS 변수 확인

## 작업

`packages/ui`에 대시보드와 공개 사이트가 공유하는 기본 컴포넌트 4개를 구현한다.
모든 스타일은 CSS 변수(`var(--color-*)`)를 사용하고 Tailwind utility는 레이아웃/간격에만 사용한다.

### 수정할 파일

**`packages/ui/package.json`**

```json
{
  "name": "@zettlink/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19",
    "typescript": "^5"
  }
}
```

**`packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### 생성할 파일

**`packages/ui/src/Button.tsx`**

```typescript
// 공용 버튼 컴포넌트 — primary / ghost / danger variant
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary: 'background:var(--color-primary-normal);color:#fff',
  ghost: 'background:transparent;color:var(--color-label-normal);border:1px solid var(--color-line-strong)',
  danger: 'background:var(--color-status-error);color:#fff',
}

const sizeStyles: Record<Size, string> = {
  sm: 'padding:0.375rem 0.75rem;font-size:0.875rem',
  md: 'padding:0.625rem 1.25rem;font-size:1rem',
}

export function Button({ variant = 'primary', size = 'md', style, children, ...props }: ButtonProps) {
  const baseStyle = 'border-radius:8px;font-weight:600;cursor:pointer;border:none;transition:opacity 0.15s'
  const combined = [baseStyle, variantStyles[variant], sizeStyles[size]].join(';')
  return (
    <button
      style={{ ...(Object.fromEntries(combined.split(';').filter(Boolean).map(s => {
        const [k, ...v] = s.split(':')
        return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.join(':').trim()]
      })) as React.CSSProperties), ...style }}
      {...props}
    >
      {children}
    </button>
  )
}
```

> 참고: inline style 대신 CSS-in-JS 라이브러리가 없으므로 style prop을 직접 조합한다.
> 향후 Tailwind 유틸리티로 교체 가능하나 현재는 CSS 변수 접근성을 위해 이 방식 사용.

실용적인 구현으로 교체: style prop 직접 객체로 작성.

```typescript
// 공용 버튼 컴포넌트 — primary / ghost / danger variant
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', style, disabled, children, ...props }: ButtonProps) {
  const base: CSSProperties = {
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
  }

  const variantStyle: CSSProperties =
    variant === 'primary'
      ? { background: 'var(--color-primary-normal)', color: '#fff' }
      : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--color-label-normal)', border: '1px solid var(--color-line-strong)' }
        : { background: 'var(--color-status-error)', color: '#fff' }

  const sizeStyle: CSSProperties =
    size === 'sm'
      ? { padding: '0.375rem 0.75rem', fontSize: '0.875rem' }
      : { padding: '0.625rem 1.25rem', fontSize: '1rem' }

  return (
    <button style={{ ...base, ...variantStyle, ...sizeStyle, ...style }} disabled={disabled} {...props}>
      {children}
    </button>
  )
}
```

**`packages/ui/src/Badge.tsx`**

카드/잡 status에 따라 색상이 달라지는 뱃지.

```typescript
// 상태 표시 뱃지 컴포넌트
import type { CSSProperties } from 'react'

type Status = 'done' | 'failed' | 'pending' | 'processing' | 'dead' | 'queued'

interface BadgeProps {
  status: Status
  label?: string
}

const statusConfig: Record<Status, { bg: string; color: string; text: string }> = {
  done:       { bg: 'var(--color-status-success)', color: '#fff', text: '완료' },
  failed:     { bg: 'var(--color-status-error)',   color: '#fff', text: '실패' },
  dead:       { bg: 'var(--color-status-dead)',    color: '#fff', text: '중단' },
  pending:    { bg: 'var(--color-line-strong)',     color: 'var(--color-label-normal)', text: '대기' },
  processing: { bg: 'var(--color-status-info)',    color: '#fff', text: '처리중' },
  queued:     { bg: 'var(--color-status-caution)', color: '#fff', text: '큐' },
}

export function Badge({ status, label }: BadgeProps) {
  const cfg = statusConfig[status]
  const style: CSSProperties = {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: cfg.bg,
    color: cfg.color,
  }
  return <span style={style}>{label ?? cfg.text}</span>
}
```

**`packages/ui/src/Tag.tsx`**

태그 chip. 클릭 가능 여부 선택.

```typescript
// 태그 chip 컴포넌트
import type { CSSProperties } from 'react'

interface TagProps {
  name: string
  onClick?: () => void
  active?: boolean
}

export function Tag({ name, onClick, active }: TagProps) {
  const style: CSSProperties = {
    display: 'inline-block',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: onClick ? 'pointer' : 'default',
    background: active ? 'var(--color-primary-normal)' : 'var(--color-background-alternative)',
    color: active ? '#fff' : 'var(--color-label-normal)',
    border: '1px solid var(--color-line-normal)',
    transition: 'background 0.15s',
  }
  return (
    <span style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {name}
    </span>
  )
}
```

**`packages/ui/src/CardRow.tsx`**

카드 리스트의 한 행. 플랫폼 아이콘, 제목, status badge, 날짜, 태그.

```typescript
// 카드 리스트 행 컴포넌트
import type { CSSProperties } from 'react'
import { Badge } from './Badge.js'
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

export function CardRow({ title, url, platform, status, published, tags, createdAt, href }: CardRowProps) {
  const rowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    borderBottom: '1px solid var(--color-line-normal)',
    textDecoration: 'none',
    color: 'inherit',
  }

  const metaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  }

  const dateStr = new Date(createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

  return (
    <a href={href} style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-label-alternative)', width: '60px' }}>
          {platform}
        </span>
        <span style={{ fontWeight: 600, flex: 1 }}>{title ?? url}</span>
        {published ? <span style={{ fontSize: '0.75rem', color: 'var(--color-status-success)' }}>공개</span> : null}
      </div>
      <div style={metaStyle}>
        <Badge status={status as Parameters<typeof Badge>[0]['status']} />
        <span style={{ fontSize: '0.75rem', color: 'var(--color-label-alternative)' }}>{dateStr}</span>
        {tags.map(t => <Tag key={t} name={t} />)}
      </div>
    </a>
  )
}
```

**`packages/ui/src/index.ts`**

```typescript
// packages/ui 공용 컴포넌트 re-export
export { Button } from './Button.js'
export { Badge } from './Badge.js'
export { Tag } from './Tag.js'
export { CardRow } from './CardRow.js'
```

## Acceptance Criteria

```bash
# 타입 체크
pnpm --filter @zettlink/ui typecheck 2>/dev/null || pnpm --filter @zettlink/ui exec tsc --noEmit
# → 에러 없음

# dashboard typecheck (import 확인)
pnpm --filter @zettlink/dashboard typecheck
# → 에러 없음
```

## 금지사항

- Atomic color 값(hex 직접)을 컴포넌트에 하드코딩하지 마라. 반드시 `var(--color-*)` CSS 변수 사용.
- `&&` 연산자로 JSX 조건부 렌더링 금지. `condition ? <el /> : null` 패턴 사용.
- CSS 모듈, styled-components, Emotion 등 외부 CSS-in-JS 라이브러리 도입 금지.
- 컴포넌트 파일 첫 줄에 한국어 역할 주석 필수.
